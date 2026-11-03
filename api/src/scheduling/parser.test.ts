import { describe, expect, it } from "vitest";
import { parseRequestedTime } from "./parser.js";

const CHICAGO = "America/Chicago";

function expectUnderstoodAt(
  result: ReturnType<typeof parseRequestedTime>,
  expectedLocalWallClock: string,
  expectedZone: string
) {
  if (result.kind !== "understood") {
    throw new Error(`expected understood, got not_understood: ${result.reason}`);
  }
  expect(result.localDateTime.toFormat("yyyy-MM-dd'T'HH:mm:ss")).toBe(
    expectedLocalWallClock
  );
  expect(result.localDateTime.zoneName).toBe(expectedZone);
}

describe("parseRequestedTime", () => {
  it("1. weekday at HH:MM, same weekday, before the time -> today", () => {
    const result = parseRequestedTime({
      requestedText: "Friday at 15:00",
      receivedAt: "2026-11-06T16:00:00Z", // Fri 10:00 CST
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-06T15:00:00", CHICAGO);
  });

  it("2. weekday at HH:MM, same weekday, after the time -> next week", () => {
    const result = parseRequestedTime({
      requestedText: "Friday at 15:00",
      receivedAt: "2026-11-06T22:00:00Z", // Fri 16:00 CST
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-13T15:00:00", CHICAGO);
  });

  it("3. weekday at HH:MM, a different day of the week -> next occurrence", () => {
    const result = parseRequestedTime({
      requestedText: "Monday at 09:00",
      receivedAt: "2026-11-04T18:00:00Z", // Wed 12:00 CST
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-09T09:00:00", CHICAGO);
  });

  it("4. tomorrow at HH:MM, said late at night -> correct local calendar day", () => {
    const result = parseRequestedTime({
      requestedText: "tomorrow at 08:30",
      receivedAt: "2026-11-05T05:50:00Z", // Nov 4, 23:50 CST (already Nov 5 in UTC)
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-05T08:30:00", CHICAGO);
  });

  it("5. in N hours -> elapsed real time, not wall-clock arithmetic", () => {
    const result = parseRequestedTime({
      requestedText: "in 2 hours",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    if (result.kind !== "understood") throw new Error(result.reason);
    expect(result.localDateTime.toUTC().toISO({ suppressMilliseconds: true })).toBe(
      "2026-11-03T16:20:00Z"
    );
    expectUnderstoodAt(result, "2026-11-03T10:20:00", CHICAGO);
  });

  it("6. in N minutes -> elapsed real time", () => {
    const result = parseRequestedTime({
      requestedText: "in 45 minutes",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    if (result.kind !== "understood") throw new Error(result.reason);
    expect(result.localDateTime.toUTC().toISO({ suppressMilliseconds: true })).toBe(
      "2026-11-03T15:05:00Z"
    );
    expectUnderstoodAt(result, "2026-11-03T09:05:00", CHICAGO);
  });

  it("7. ISO date-time with an explicit offset -> unambiguous instant", () => {
    const result = parseRequestedTime({
      requestedText: "2026-11-06T15:00:00-06:00",
      receivedAt: "2026-11-01T00:00:00Z",
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-06T15:00:00", CHICAGO);
  });

  it("8. ISO date-time with no offset -> interpreted in lead_timezone", () => {
    const result = parseRequestedTime({
      requestedText: "2026-11-06T15:00:00",
      receivedAt: "2026-11-01T00:00:00Z",
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-06T15:00:00", CHICAGO);
  });

  it("9. unrecognized text -> not_understood", () => {
    const result = parseRequestedTime({
      requestedText: "sometime next week",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    expect(result.kind).toBe("not_understood");
  });

  it("10. empty string -> not_understood", () => {
    const result = parseRequestedTime({
      requestedText: "",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    expect(result.kind).toBe("not_understood");
  });

  it("11. invalid IANA time zone -> not_understood, names the bad zone", () => {
    const result = parseRequestedTime({
      requestedText: "Friday at 15:00",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: "Americaa/Chicago",
    });
    expect(result.kind).toBe("not_understood");
    if (result.kind === "not_understood") {
      expect(result.reason).toContain("Americaa/Chicago");
    }
  });

  it("12. in N hours across a DST change -> correct elapsed time, not naive clock math", () => {
    const result = parseRequestedTime({
      requestedText: "in 2 hours",
      receivedAt: "2026-03-08T07:00:00Z", // 01:00 CST, just before spring-forward
      leadTimezone: CHICAGO,
    });
    if (result.kind !== "understood") throw new Error(result.reason);
    expect(result.localDateTime.toUTC().toISO({ suppressMilliseconds: true })).toBe(
      "2026-03-08T09:00:00Z"
    );
    // Naive wall-clock +2h would say 03:00; the DST skip means it's really 04:00 CDT.
    expectUnderstoodAt(result, "2026-03-08T04:00:00", CHICAGO);
  });

  it("13. ISO date-time already in the past -> still understood (past-time policy is a later chunk)", () => {
    const result = parseRequestedTime({
      requestedText: "2026-11-01T09:00:00-06:00",
      receivedAt: "2026-11-03T14:20:00Z",
      leadTimezone: CHICAGO,
    });
    expectUnderstoodAt(result, "2026-11-01T09:00:00", CHICAGO);
  });
});
