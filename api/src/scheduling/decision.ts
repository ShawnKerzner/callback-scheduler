import { DateTime } from "luxon";
import { applyCallingWindow, DEFAULT_CALLING_WINDOW } from "./window.js";
import type { CallingWindowConfig } from "./window.js";
import { parseRequestedTime } from "./parser.js";

export interface ScheduleCallbackInput {
  requestedText: string;
  receivedAt: string;
  leadTimezone: string;
  windowConfig?: CallingWindowConfig;
}

export type ScheduleDecision =
  | {
      status: "scheduled";
      requestedLocalDateTime: DateTime;
      scheduledLocalDateTime: DateTime;
      moved: boolean;
      moveReason?: string;
    }
  | {
      status: "not_scheduled";
      reason: string;
    };

/**
 * Pure function: the raw request fields -> one final decision, scheduled
 * or not, with a reason either way. Wires parser -> past-time policy ->
 * window in a fixed order. No DB, no HTTP.
 *
 * Order matters: the past-time check runs on the parser's raw output,
 * before the window is ever applied. A past request is rejected outright,
 * never nudged into some future slot by the window logic -- that would be
 * inventing a time the lead never asked for (rule 2).
 */
export function decideCallback(input: ScheduleCallbackInput): ScheduleDecision {
  const parsed = parseRequestedTime({
    requestedText: input.requestedText,
    receivedAt: input.receivedAt,
    leadTimezone: input.leadTimezone,
  });

  if (parsed.kind === "not_understood") {
    return { status: "not_scheduled", reason: parsed.reason };
  }

  const receivedAtLocal = DateTime.fromISO(input.receivedAt, { zone: "utc" }).setZone(
    input.leadTimezone
  );

  if (parsed.localDateTime < receivedAtLocal) {
    return {
      status: "not_scheduled",
      reason: `Requested time ${parsed.localDateTime.toISO()} is in the past (request received at ${receivedAtLocal.toISO()}).`,
    };
  }

  const windowResult = applyCallingWindow(
    parsed.localDateTime,
    input.windowConfig ?? DEFAULT_CALLING_WINDOW
  );

  return {
    status: "scheduled",
    requestedLocalDateTime: parsed.localDateTime,
    scheduledLocalDateTime: windowResult.scheduledLocalDateTime,
    moved: windowResult.moved,
    moveReason: windowResult.reason,
  };
}
