import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// api/src/db -> api/migrations (and api/dist/db -> api/migrations once built)
const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

async function ensureMigrationsTable(db: Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function pendingMigrationFiles(applied: Set<string>): string[] {
  let files: string[];
  try {
    files = readdirSync(MIGRATIONS_DIR);
  } catch {
    return [];
  }
  return files.filter((f) => f.endsWith(".sql") && !applied.has(f)).sort();
}

export async function runMigrations(db: Pool = pool): Promise<string[]> {
  await ensureMigrationsTable(db);

  const { rows } = await db.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations"
  );
  const applied = new Set(rows.map((r) => r.filename));
  const pending = pendingMigrationFiles(applied);

  for (const filename of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [filename]
      );
      await client.query("COMMIT");
      console.log(`[migrate] applied ${filename}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${filename} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  if (pending.length === 0) {
    console.log("[migrate] no pending migrations");
  }

  return pending;
}

// Run directly via `npm run migrate`, as opposed to being imported by index.ts on startup.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
