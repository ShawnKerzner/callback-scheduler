import { useState } from "react";
import type { FormEvent } from "react";
import { CallbackResult } from "./CallbackResult";
import { BROWSER_TIME_ZONE } from "./formatTime";
import type { CallbackResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const TIME_ZONES = Intl.supportedValuesOf("timeZone");
const DEFAULT_ZONE = TIME_ZONES.includes(BROWSER_TIME_ZONE) ? BROWSER_TIME_ZONE : "America/Chicago";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; result: CallbackResponse }
  | { status: "error"; message: string };

export function CallbackForm() {
  const [leadId, setLeadId] = useState("lead_demo_1");
  const [leadTimezone, setLeadTimezone] = useState(DEFAULT_ZONE);
  const [requestedText, setRequestedText] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitState({ status: "submitting" });

    const body = {
      request_id: crypto.randomUUID(),
      lead_id: leadId,
      lead_timezone: leadTimezone,
      requested_text: requestedText,
      received_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/callbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        setSubmitState({
          status: "error",
          message: errorBody?.error ?? `Request failed (${res.status}).`,
        });
        return;
      }

      const result = (await res.json()) as CallbackResponse;
      setSubmitState({ status: "success", result });
      setRequestedText("");
    } catch {
      setSubmitState({ status: "error", message: "Could not reach the API. Is it running?" });
    }
  }

  const submitting = submitState.status === "submitting";

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}
      >
        <label>
          Lead id
          <input value={leadId} onChange={(e) => setLeadId(e.target.value)} required />
        </label>

        <label>
          Lead time zone
          <select value={leadTimezone} onChange={(e) => setLeadTimezone(e.target.value)}>
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <label>
          What the lead said
          <input
            value={requestedText}
            onChange={(e) => setRequestedText(e.target.value)}
            placeholder='e.g. "Friday at 15:00"'
            required
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit callback request"}
        </button>
      </form>

      {submitState.status === "error" && (
        <p style={{ color: "crimson" }}>{submitState.message}</p>
      )}
      {submitState.status === "success" && <CallbackResult callback={submitState.result} />}
    </div>
  );
}
