import { afterEach, describe, expect, it } from "vitest";
import { insertOrGetCallback } from "./callbacksRepository.js";
import type { NewCallbackRow } from "./callbacksRepository.js";
import { pool } from "./pool.js";

function sampleRow(requestId: string, overrides: Partial<NewCallbackRow> = {}): NewCallbackRow {
  return {
    requestId,
    leadId: "lead_test_1",
    leadTimezone: "America/Chicago",
    requestedText: "Friday at 15:00",
    receivedAt: "2026-11-06T16:00:00Z",
    status: "scheduled",
    reason: null,
    requestedLocalTime: "2026-11-06T15:00:00-06:00",
    scheduledLocalTime: "2026-11-06T15:00:00-06:00",
    moved: false,
    ...overrides,
  };
}

afterEach(async () => {
  await pool.query("DELETE FROM callbacks WHERE request_id LIKE 'test_%'");
});

describe("insertOrGetCallback", () => {
  it("1. inserts a fresh row on first delivery", async () => {
    const result = await insertOrGetCallback(pool, sampleRow("test_fresh_1"));
    expect(result.wasReplay).toBe(false);
    expect(result.row.request_id).toBe("test_fresh_1");
    expect(result.row.status).toBe("scheduled");
  });

  it("2. a duplicate request_id with a different body replays the original", async () => {
    const first = await insertOrGetCallback(pool, sampleRow("test_dup_1"));
    const second = await insertOrGetCallback(
      pool,
      sampleRow("test_dup_1", { requestedText: "a totally different text" })
    );

    expect(first.wasReplay).toBe(false);
    expect(second.wasReplay).toBe(true);
    expect(second.row.requested_text).toBe("Friday at 15:00");

    // 3. still exactly one row for this request_id
    const count = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM callbacks WHERE request_id = $1",
      ["test_dup_1"]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it("4. a not_scheduled row stores its reason with both time columns null", async () => {
    const result = await insertOrGetCallback(
      pool,
      sampleRow("test_not_sched_1", {
        status: "not_scheduled",
        reason: "Could not understand the requested time.",
        requestedLocalTime: null,
        scheduledLocalTime: null,
        moved: false,
      })
    );
    expect(result.row.status).toBe("not_scheduled");
    expect(result.row.reason).toBe("Could not understand the requested time.");
    expect(result.row.requested_local_time).toBeNull();
    expect(result.row.scheduled_local_time).toBeNull();
  });
});
