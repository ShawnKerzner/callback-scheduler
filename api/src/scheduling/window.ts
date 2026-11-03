import { DateTime } from "luxon";

export interface CallingWindowConfig {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  workingDays: number[]; // ISO weekday numbers: 1 = Monday ... 7 = Sunday
}

export const DEFAULT_CALLING_WINDOW: CallingWindowConfig = {
  startHour: 8,
  startMinute: 0,
  endHour: 21,
  endMinute: 0,
  workingDays: [1, 2, 3, 4, 5],
};

export interface WindowResult {
  scheduledLocalDateTime: DateTime;
  moved: boolean;
  reason?: string;
}

const MAX_DAYS_TO_SEARCH = 14;

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function windowBoundsFor(day: DateTime, config: CallingWindowConfig) {
  const start = day.set({
    hour: config.startHour,
    minute: config.startMinute,
    second: 0,
    millisecond: 0,
  });
  const end = day.set({
    hour: config.endHour,
    minute: config.endMinute,
    second: 0,
    millisecond: 0,
  });
  return { start, end };
}

function nextWorkingDayStart(from: DateTime, config: CallingWindowConfig): DateTime {
  let candidate = from.plus({ days: 1 });
  for (let i = 0; i < MAX_DAYS_TO_SEARCH; i++) {
    if (config.workingDays.includes(candidate.weekday)) {
      return candidate.set({
        hour: config.startHour,
        minute: config.startMinute,
        second: 0,
        millisecond: 0,
      });
    }
    candidate = candidate.plus({ days: 1 });
  }
  throw new Error(
    "No working day found within 14 days -- check CallingWindowConfig.workingDays."
  );
}

/**
 * Pure function: a local date-time (already understood, already in the
 * lead's zone) + a window config -> the actual time we're allowed to call,
 * plus whether and why it moved.
 *
 * Scope boundary: this has no idea what "today" is or whether the input is
 * in the past -- it only looks at time-of-day and weekday. Past-time
 * rejection is a separate concern (chunk 4).
 */
export function applyCallingWindow(
  localDateTime: DateTime,
  config: CallingWindowConfig = DEFAULT_CALLING_WINDOW
): WindowResult {
  const { start, end } = windowBoundsFor(localDateTime, config);

  if (localDateTime < start) {
    return {
      scheduledLocalDateTime: start,
      moved: true,
      reason: `Requested time is before the calling window (${formatTime(
        config.startHour,
        config.startMinute
      )}); moved to the start of the window the same day.`,
    };
  }

  if (localDateTime > end) {
    return {
      scheduledLocalDateTime: nextWorkingDayStart(localDateTime, config),
      moved: true,
      reason: `Requested time is after the calling window (${formatTime(
        config.endHour,
        config.endMinute
      )}); moved to the start of the window on the next working day.`,
    };
  }

  return { scheduledLocalDateTime: localDateTime, moved: false };
}
