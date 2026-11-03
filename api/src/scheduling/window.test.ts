import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { applyCallingWindow, DEFAULT_CALLING_WINDOW } from "./window.js";
import type { CallingWindowConfig } from "./window.js";

const CHICAGO = "America/Chicago";

function at(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: CHICAGO });
}

const SUN_THU: CallingWindowConfig = {
  ...DEFAULT_CALLING_WINDOW,
  workingDays: [7, 1, 2, 3, 4], // Sunday, Monday..Thursday
};

const NINE_TO_TWENTY: CallingWindowConfig = {
  ...DEFAULT_CALLING_WINDOW,
  startHour: 9,
  endHour: 20,
};

describe("applyCallingWindow", () => {
  it("1. exactly at window start -> unchanged", () => {
    const result = applyCallingWindow(at("2026-11-04T08:00:00")); // Wed
    expect(result.moved).toBe(false);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-04T08:00:00").toISO());
  });

  it("2. exactly at window end -> unchanged", () => {
    const result = applyCallingWindow(at("2026-11-04T21:00:00")); // Wed
    expect(result.moved).toBe(false);
  });

  it("3. just before window start -> moved to start, same day", () => {
    const result = applyCallingWindow(at("2026-11-04T07:59:00")); // Wed
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-04T08:00:00").toISO());
  });

  it("4. just after window end -> moved to start of next working day", () => {
    const result = applyCallingWindow(at("2026-11-04T21:01:00")); // Wed -> Thu
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-05T08:00:00").toISO());
  });

  it("5. weekend time inside the window -> kept as requested", () => {
    const result = applyCallingWindow(at("2026-11-07T14:00:00")); // Sat
    expect(result.moved).toBe(false);
  });

  it("6. weekend time before the window -> moved to same day", () => {
    const result = applyCallingWindow(at("2026-11-07T06:00:00")); // Sat
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-07T08:00:00").toISO());
  });

  it("7. Friday night after the window -> Monday", () => {
    const result = applyCallingWindow(at("2026-11-06T22:00:00")); // Fri
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-09T08:00:00").toISO());
  });

  it("8. Saturday night after the window -> Monday (skips Sunday too)", () => {
    const result = applyCallingWindow(at("2026-11-07T23:00:00")); // Sat
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-09T08:00:00").toISO());
  });

  it("9. Friday night with a Sun-Thu working week -> Sunday, not Monday", () => {
    const result = applyCallingWindow(at("2026-11-06T22:00:00"), SUN_THU); // Fri
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-08T08:00:00").toISO());
  });

  it("10a. the brief's own live-change example (09:00-20:00): before start", () => {
    const result = applyCallingWindow(at("2026-11-04T08:30:00"), NINE_TO_TWENTY); // Wed
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-04T09:00:00").toISO());
  });

  it("10b. the brief's own live-change example (09:00-20:00): after end", () => {
    const result = applyCallingWindow(at("2026-11-04T20:30:00"), NINE_TO_TWENTY); // Wed -> Thu
    expect(result.moved).toBe(true);
    expect(result.scheduledLocalDateTime.toISO()).toBe(at("2026-11-05T09:00:00").toISO());
  });
});
