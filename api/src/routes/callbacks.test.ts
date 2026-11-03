import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { pool } from "../db/pool.js";
import { DEFAULT_CALLING_WINDOW } from "../scheduling/window.js";

const app = createApp(pool, DEFAULT_CALLING_WINDOW);

function sampleBody(requestId: string, overrides: Record<string, unknown> = {}) {
  return {
    request_id: requestId,
    lead_id: "lead_test_http_1",
    lead_timezone: "America/Chicago",
    requested_text: "Friday at 15:00",
    received_at: "2026-11-06T16:00:00Z",
    ...overrides,
  };
}

afterEach(async () => {
  await pool.query("DELETE FROM callbacks WHERE request_id LIKE 'test_http_%'");
});

describe("POST /callbacks", () => {
  it("1. missing request_id -> 400", async () => {
    const body = sampleBody("test_http_missing") as Record<string, unknown>;
    delete body.request_id;
    const res = await request(app).post("/callbacks").send(body);
    expect(res.status).toBe(400);
  });

  it("2. received_at as a number -> 400", async () => {
    const res = await request(app)
      .post("/callbacks")
      .send(sampleBody("test_http_badtype", { received_at: 12345 }));
    expect(res.status).toBe(400);
  });

  it("3. future, in-window -> 201 scheduled, not moved", async () => {
    const res = await request(app).post("/callbacks").send(sampleBody("test_http_scheduled_1"));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("scheduled");
    expect(res.body.moved).toBe(false);
  });

  it("4. future, outside window -> 201 scheduled, moved", async () => {
    const res = await request(app)
      .post("/callbacks")
      .send(sampleBody("test_http_moved_1", { requested_text: "Friday at 22:00" }));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("scheduled");
    expect(res.body.moved).toBe(true);
  });

  it("5. unparseable text -> 201 not_scheduled", async () => {
    const res = await request(app)
      .post("/callbacks")
      .send(sampleBody("test_http_notsched_1", { requested_text: "sometime next week" }));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("not_scheduled");
  });

  it("6. duplicate delivered sequentially -> 200, matches the first response exactly", async () => {
    const first = await request(app).post("/callbacks").send(sampleBody("test_http_dup_1"));
    const second = await request(app)
      .post("/callbacks")
      .send(sampleBody("test_http_dup_1", { requested_text: "a different text entirely" }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it("7. duplicate delivered concurrently -> identical responses, exactly one row", async () => {
    const body = sampleBody("test_http_concurrent_1");
    const [res1, res2] = await Promise.all([
      request(app).post("/callbacks").send(body),
      request(app).post("/callbacks").send(body),
    ]);

    // Exactly one of the two actually inserted (201); the other read the
    // winner's row back (200) -- never both 201, never both 200.
    expect([res1.status, res2.status].sort()).toEqual([200, 201]);
    expect(res1.body).toEqual(res2.body);

    const count = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM callbacks WHERE request_id = $1",
      ["test_http_concurrent_1"]
    );
    expect(count.rows[0].count).toBe(1);
  });
});

describe("GET /callbacks", () => {
  it("1. missing lead_id -> 400", async () => {
    const res = await request(app).get("/callbacks");
    expect(res.status).toBe(400);
  });

  it("2. lead_id with no rows -> 200, empty array", async () => {
    const res = await request(app).get("/callbacks").query({ lead_id: "test_http_ghost_lead" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("3. returns only the requested lead's rows, newest received_at first", async () => {
    const leadA = "test_http_lead_a";
    const leadB = "test_http_lead_b";

    await request(app)
      .post("/callbacks")
      .send(
        sampleBody("test_http_list_a_older", {
          lead_id: leadA,
          received_at: "2026-11-03T10:00:00Z",
        })
      );
    await request(app)
      .post("/callbacks")
      .send(
        sampleBody("test_http_list_a_newer", {
          lead_id: leadA,
          received_at: "2026-11-04T10:00:00Z",
          requested_text: "sometime next week", // not_scheduled, on purpose
        })
      );
    await request(app)
      .post("/callbacks")
      .send(
        sampleBody("test_http_list_b", {
          lead_id: leadB,
          received_at: "2026-11-05T10:00:00Z",
        })
      );

    const res = await request(app).get("/callbacks").query({ lead_id: leadA });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // newest received_at first
    expect(res.body[0].request_id).toBe("test_http_list_a_newer");
    expect(res.body[0].status).toBe("not_scheduled");
    expect(res.body[1].request_id).toBe("test_http_list_a_older");
    // lead B's row never appears
    expect(res.body.some((row: { request_id: string }) => row.request_id === "test_http_list_b")).toBe(
      false
    );
  });
});
