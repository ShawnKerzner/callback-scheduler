import cors from "cors";
import express from "express";
import type { Express } from "express";
import type { Pool } from "pg";
import { callbacksRouter } from "./routes/callbacks.js";
import type { CallingWindowConfig } from "./scheduling/window.js";

export function createApp(pool: Pool, windowConfig: CallingWindowConfig): Express {
  const app = express();
  // No auth in scope for this take-home; allow any origin so the web dev
  // server (a different port = different origin) can call the API locally.
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(callbacksRouter(pool, windowConfig));

  return app;
}
