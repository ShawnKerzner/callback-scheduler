// Every stored time is a UTC instant (see docs/PLAN.md chunk 5), so any
// viewer's local time -- the lead's or someone else's -- is just a
// different formatting of the same instant, never a separate value to
// fetch or store.
export function formatInZone(isoInstant: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoInstant));
}

export const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
