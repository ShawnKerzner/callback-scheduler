import { describe, expect, it } from "vitest";
import { decideCallback } from "./decision.js";

const CHICAGO = "America/Chicago";
const TOKYO = "Asia/Tokyo";

describe("decideCallback", () => {
  it("1. future, in-window -> scheduled, not moved", () => {
    const result = decideCallback({
      requestedText: "Friday at 15:00",
      receivedAt: "2026-11-06T16:00:00Z", // Fri 10:00 CST
      leadTimezone: CHICAGO,
    });
    expect(result.status).toBe("scheduled");
    if (result.status !== "scheduled") throw new Error("unreachable");
    expect(result.moved).toBe(false);
    expect(result.requestedLocalDateTime.toISO()).toBe(result.scheduledLocalDateTime.toISO());
  });

  it("2. future, outside window -> scheduled, moved to next working day", () => {
    const result = decideCallback({
      requestedText: "Friday at 22:00",
      receivedAt: "2026-11-06T16:00:00Z", // Fri 10:00 CST
      leadTimezone: CHICAGO,
    });
    expect(result.status).toBe("scheduled");
    if (result.status !== "scheduled") throw new Error("unreachable");
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toFormat("yyyy-MM-dd'T'HH:mm:ss")).toBe(
      "2026-11-09T08:00:00" // Monday
    );
  });

  it("3. unparseable text -> not_scheduled, window never consulted", () => {
    const result = decideCallback({
      requestedText: "sometime next week",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    expect(result.status).toBe("not_scheduled");
    if (result.status !== "not_scheduled") throw new Error("unreachable");
    expect(result.reason).toContain("Could not understand");
  });

  it("4. understood but in the past -> not_scheduled", () => {
    const result = decideCallback({
      requestedText: "2026-11-01T09:00:00-06:00",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    expect(result.status).toBe("not_scheduled");
    if (result.status !== "not_scheduled") throw new Error("unreachable");
    expect(result.reason).toContain("in the past");
  });

  it("5. invalid lead_timezone -> not_scheduled, parser's reason passed through", () => {
    const result = decideCallback({
      requestedText: "Friday at 15:00",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: "Americaa/Chicago",
    });
    expect(result.status).toBe("not_scheduled");
    if (result.status !== "not_scheduled") throw new Error("unreachable");
    expect(result.reason).toContain("Americaa/Chicago");
  });

  it("6. past time that's also outside window hours -> rejected for being past, not window-adjusted", () => {
    const result = decideCallback({
      requestedText: "2026-11-01T23:30:00-06:00", // past AND after 21:00
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    expect(result.status).toBe("not_scheduled");
    if (result.status !== "not_scheduled") throw new Error("unreachable");
    expect(result.reason).toContain("in the past");
    expect(result.reason).not.toContain("calling window");
  });

  it("7. non-US lead zone, future, in-window -> scheduled correctly", () => {
    const result = decideCallback({
      requestedText: "tomorrow at 10:00",
      receivedAt: "2026-11-03T14:20:00Z", // 23:20 JST
      leadTimezone: TOKYO,
    });
    expect(result.status).toBe("scheduled");
    if (result.status !== "scheduled") throw new Error("unreachable");
    expect(result.moved).toBe(false);
    expect(result.scheduledLocalDateTime.toFormat("yyyy-MM-dd'T'HH:mm:ss")).toBe(
      "2026-11-04T10:00:00"
    );
    expect(result.scheduledLocalDateTime.zoneName).toBe(TOKYO);
  });
});
