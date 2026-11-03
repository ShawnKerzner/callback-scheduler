import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type ApiStatus = "checking" | "ok" | "unreachable";

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => (res.ok ? setApiStatus("ok") : setApiStatus("unreachable")))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Callback Scheduler</h1>
      <p>API at {API_BASE_URL}: {apiStatus}</p>
    </main>
  );
}
