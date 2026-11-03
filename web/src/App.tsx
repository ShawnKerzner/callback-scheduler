import { useState } from "react";
import { CallbackForm } from "./CallbackForm";
import { CallbackList } from "./CallbackList";

export default function App() {
  const [leadId, setLeadId] = useState("lead_demo_1");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Callback Scheduler</h1>

      <CallbackForm
        leadId={leadId}
        onLeadIdChange={setLeadId}
        onSubmitted={() => setRefreshKey((key) => key + 1)}
      />

      <h2>Callback history</h2>
      <CallbackList leadId={leadId} refreshKey={refreshKey} />
    </main>
  );
}
