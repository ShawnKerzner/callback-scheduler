import { useEffect, useState } from "react";
import { CallbackResult } from "./CallbackResult";
import type { CallbackResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type ListState =
  | { status: "loading" }
  | { status: "loaded"; callbacks: CallbackResponse[] }
  | { status: "error"; message: string };

export function CallbackList({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    if (leadId === "") {
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`${API_BASE_URL}/callbacks?lead_id=${encodeURIComponent(leadId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status}).`);
        }
        return (await res.json()) as CallbackResponse[];
      })
      .then((callbacks) => {
        if (!cancelled) setState({ status: "loaded", callbacks });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Could not reach the API." });
      });

    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey]);

  if (leadId === "") {
    return <p>Enter a lead id above to see their callback history.</p>;
  }

  if (state.status === "loading") {
    return <p>Loading callbacks...</p>;
  }

  if (state.status === "error") {
    return <p style={{ color: "crimson" }}>{state.message}</p>;
  }

  if (state.callbacks.length === 0) {
    return <p>No callbacks yet for {leadId}.</p>;
  }

  return (
    <div>
      {state.callbacks.map((callback) => (
        <CallbackResult key={callback.request_id} callback={callback} />
      ))}
    </div>
  );
}
