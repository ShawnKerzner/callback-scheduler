import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Windows host + Docker bind mount doesn't reliably deliver inotify
    // events into the Linux container, so Vite's default watcher misses
    // file changes. Polling is slower but actually detects edits here.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
