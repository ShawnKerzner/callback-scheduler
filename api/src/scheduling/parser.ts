import { DateTime, IANAZone } from "luxon";

export interface ParseInput {
  requestedText: string;
  receivedAt: string; // ISO-8601 UTC instant, e.g. "2026-11-03T14:20:00Z"
  leadTimezone: string; // IANA zone name, e.g. "America/Chicago"
}

export type ParsedTime =
  | { kind: "understood"; localDateTime: DateTime }
  | { kind: "not_understood"; reason: string };

// Luxon's DateTime.weekday uses ISO 8601 numbering (1 = Monday ... 7 =
// Sunday) -- this map has to agree with that, since we compare directly
// against `now.weekday` below.
const WEEKDAYS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const WEEKDAY_AT_TIME = /^([a-z]+)\s+at\s+(\d{1,2}):(\d{2})$/i;
const TOMORROW_AT_TIME = /^tomorrow\s+at\s+(\d{1,2}):(\d{2})$/i;
const IN_N_UNITS = /^in\s+(\d+)\s+(hour|hours|minute|minutes)$/i;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;
const ISO_WITHOUT_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function notUnderstood(reason: string): ParsedTime {
  return { kind: "not_understood", reason };
}

function understood(localDateTime: DateTime): ParsedTime {
  return { kind: "understood", localDateTime };
}

// Shared by the "tomorrow" and "weekday" branches, which both extract an
// HH:MM pair and need the same validity check.
function parseTimeOfDay(hourStr: string, minuteStr: string): { hour: number; minute: number } | null {
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

// Shared by the "ISO with offset" and "ISO without offset" branches, which
// differ only in how Luxon should resolve the zone.
function parseIso(requestedText: string, leadTimezone: string, hasOffset: boolean): ParsedTime {
  const parsed = hasOffset
    ? DateTime.fromISO(requestedText, { setZone: true })
    : DateTime.fromISO(requestedText, { zone: leadTimezone });
  if (!parsed.isValid) {
    return notUnderstood(`"${requestedText}" looks like an ISO date-time but isn't valid.`);
  }
  return understood(hasOffset ? parsed.setZone(leadTimezone) : parsed);
}

/**
 * Pure function: requestedText + receivedAt + leadTimezone -> a local
 * date-time in the lead's zone, or a reason we couldn't understand it.
 *
 * Scope boundary: this function only decides whether the text is
 * understood. It does NOT reject times that are in the past or outside
 * the calling window — that's the past-time policy and calling window
 * (chunk 3/4). Only the raw ISO path can even produce a past result;
 * every other phrasing resolves to a future instant by construction.
 */
export function parseRequestedTime(input: ParseInput): ParsedTime {
  const { leadTimezone } = input;
  const requestedText = input.requestedText.trim();

  if (!IANAZone.isValidZone(leadTimezone)) {
    return notUnderstood(`"${leadTimezone}" is not a valid IANA time zone.`);
  }

  const receivedAtUtc = DateTime.fromISO(input.receivedAt, { zone: "utc" });
  if (!receivedAtUtc.isValid) {
    return notUnderstood(
      `receivedAt "${input.receivedAt}" is not a valid ISO-8601 timestamp.`
    );
  }

  if (requestedText === "") {
    return notUnderstood("Requested text is empty.");
  }

  const now = receivedAtUtc.setZone(leadTimezone);

  const tomorrowMatch = requestedText.match(TOMORROW_AT_TIME);
  if (tomorrowMatch) {
    const timeOfDay = parseTimeOfDay(tomorrowMatch[1], tomorrowMatch[2]);
    if (!timeOfDay) {
      return notUnderstood(`"${tomorrowMatch[1]}:${tomorrowMatch[2]}" is not a valid time.`);
    }
    const result = now
      .plus({ days: 1 })
      .set({ ...timeOfDay, second: 0, millisecond: 0 });
    return understood(result);
  }

  const inUnitsMatch = requestedText.match(IN_N_UNITS);
  if (inUnitsMatch) {
    const amount = Number(inUnitsMatch[1]);
    const unit = inUnitsMatch[2].toLowerCase().startsWith("hour") ? "hours" : "minutes";
    // Elapsed-time math on the UTC instant, not wall-clock arithmetic, so
    // this stays correct across a DST change.
    const result = receivedAtUtc.plus({ [unit]: amount }).setZone(leadTimezone);
    return understood(result);
  }

  if (ISO_WITH_OFFSET.test(requestedText)) {
    return parseIso(requestedText, leadTimezone, true);
  }

  if (ISO_WITHOUT_OFFSET.test(requestedText)) {
    return parseIso(requestedText, leadTimezone, false);
  }

  const weekdayMatch = requestedText.match(WEEKDAY_AT_TIME);
  if (weekdayMatch) {
    const weekdayName = weekdayMatch[1].toLowerCase();
    const targetWeekday = WEEKDAYS[weekdayName];
    if (!targetWeekday) {
      return notUnderstood(`"${weekdayMatch[1]}" is not a day of the week.`);
    }
    const timeOfDay = parseTimeOfDay(weekdayMatch[2], weekdayMatch[3]);
    if (!timeOfDay) {
      return notUnderstood(`"${weekdayMatch[2]}:${weekdayMatch[3]}" is not a valid time.`);
    }

    const daysUntil = (targetWeekday - now.weekday + 7) % 7;
    let result = now
      .plus({ days: daysUntil })
      .set({ ...timeOfDay, second: 0, millisecond: 0 });

    // Same weekday, but that slot has already passed today -> next week.
    if (daysUntil === 0 && result < now) {
      result = result.plus({ days: 7 });
    }

    return understood(result);
  }

  return notUnderstood(
    `Could not understand "${input.requestedText}" as a supported phrase. ` +
      `Try "<weekday> at HH:MM", "tomorrow at HH:MM", "in N hours/minutes", or an ISO date-time.`
  );
}
