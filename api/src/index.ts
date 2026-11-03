import "dotenv/config";
import { createApp } from "./app.js";
import { loadCallingWindowConfig } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/pool.js";

async function start() {
  await runMigrations(pool);

  const windowConfig = loadCallingWindowConfig();
  const app = createApp(pool, windowConfig);

  const port = Number(process.env.API_PORT) || 3000;
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
