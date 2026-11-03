import { BROWSER_TIME_ZONE, formatInZone } from "./formatTime";
import type { CallbackResponse } from "./types";

const cardStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 4,
  padding: "0.75rem 1rem",
  marginTop: "1rem",
  maxWidth: 420,
};

export function CallbackResult({ callback }: { callback: CallbackResponse }) {
  if (callback.status === "not_scheduled") {
    return (
      <div style={{ ...cardStyle, borderColor: "#c0392b" }}>
        <strong>Not scheduled</strong>
        <p>You asked: &quot;{callback.requested_text}&quot;</p>
        <p>{callback.reason}</p>
      </div>
    );
  }

  // requested_local_time / scheduled_local_time are only ever null when
  // not_scheduled (enforced by a DB CHECK constraint -- see chunk 5), so
  // they're guaranteed present here.
  const requestedLeadLocal = formatInZone(callback.requested_local_time!, callback.lead_timezone);
  const scheduledLeadLocal = formatInZone(callback.scheduled_local_time!, callback.lead_timezone);
  const scheduledViewerLocal = formatInZone(callback.scheduled_local_time!, BROWSER_TIME_ZONE);

  return (
    <div style={{ ...cardStyle, borderColor: "#27ae60" }}>
      <strong>Scheduled</strong>
      {callback.moved ? (
        <>
          <p>
            You asked for: {requestedLeadLocal} ({callback.lead_timezone})
          </p>
          <p>
            Scheduled for: {scheduledLeadLocal} ({callback.lead_timezone})
          </p>
          <p style={{ color: "#555" }}>{callback.reason}</p>
        </>
      ) : (
        <p>
          Scheduled for: {scheduledLeadLocal} ({callback.lead_timezone})
        </p>
      )}
      <p style={{ color: "#555" }}>
        In your time zone ({BROWSER_TIME_ZONE}): {scheduledViewerLocal}
      </p>
    </div>
  );
}
