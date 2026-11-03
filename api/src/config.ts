import { DEFAULT_CALLING_WINDOW } from "./scheduling/window.js";
import type { CallingWindowConfig } from "./scheduling/window.js";

function parseHourMinute(value: string, varName: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${varName}="${value}" is not in HH:MM format`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Reads the calling window from env (CALLING_WINDOW_START/END), falling
 * back to the Mon-Fri 08:00-21:00 default if unset. This is the live
 * "move the window to 09:00-20:00" change: edit .env, restart -- no code
 * change. Working days aren't env-configurable (nothing in the brief asks
 * for it); that would be the same shape of change, just adding a
 * CALLING_WORKING_DAYS var here.
 */
export function loadCallingWindowConfig(): CallingWindowConfig {
  const startEnv = process.env.CALLING_WINDOW_START;
  const endEnv = process.env.CALLING_WINDOW_END;

  if (!startEnv || !endEnv) {
    return DEFAULT_CALLING_WINDOW;
  }

  const start = parseHourMinute(startEnv, "CALLING_WINDOW_START");
  const end = parseHourMinute(endEnv, "CALLING_WINDOW_END");

  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    workingDays: DEFAULT_CALLING_WINDOW.workingDays,
  };
}
