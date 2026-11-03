import "dotenv/config";
import cors from "cors";
import express from "express";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/pool.js";

const app = express();
// No auth in scope for this take-home; allow any origin so the web dev
// server (a different port = different origin) can call the API locally.
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await runMigrations(pool);

  const port = Number(process.env.API_PORT) || 3000;
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
