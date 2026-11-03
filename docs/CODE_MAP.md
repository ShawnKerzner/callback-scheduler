# Code Map

One line per file, what it does. Updated every chunk — this is the map for the
live change in the review call.

## Root

- `docker-compose.yml` — wires up `db` (Postgres), `api`, `web`; dev mode with
  volume mounts for hot reload.
- `.env.example` / `.env` — all config, including `CALLING_WINDOW_START` /
  `CALLING_WINDOW_END` (the live-change knob).

## `api/`

- `src/index.ts` — Express app entrypoint. Runs migrations, then starts the
  HTTP server. Currently just `GET /health`.
- `src/db/pool.ts` — the single `pg.Pool`, built from `DATABASE_URL`.
- `src/db/migrate.ts` — migration runner: creates `schema_migrations` if
  missing, applies any new `.sql` file in `api/migrations/` in filename
  order, inside a transaction per file. Exported as `runMigrations()` so
  `index.ts` can run it on startup; also runnable standalone via
  `npm run migrate`.
- `api/migrations/` — empty for now; chunk 5 adds the first real migration
  (the `callbacks` table).
- `src/scheduling/parser.ts` — pure function `parseRequestedTime`: text +
  `received_at` + `lead_timezone` -> a local date-time in the lead's zone,
  or `not_understood` + a reason. No DB, no HTTP. Does not enforce the
  calling window or reject past times — that's chunks 3/4.
- `src/scheduling/parser.test.ts` — 13 unit tests covering all 4 supported
  phrasings, the same-weekday roll-forward rule, a UTC/local day-boundary
  case, a DST-crossing case, and the "no guessing" / invalid-zone cases.
- `src/scheduling/window.ts` — pure function `applyCallingWindow`: a
  local date-time + a `CallingWindowConfig` (window hours, working days)
  -> the actual time we're allowed to call, plus whether/why it moved.
  No DB, no HTTP, no idea what "today" is.
- `src/scheduling/window.test.ts` — 11 unit tests covering both window
  boundaries, before/after moves, weekend-inside vs. weekend-before the
  window, Friday/Saturday-night rollover, a non-Mon-Fri working week, and
  the brief's 09:00-20:00 live-change example.

## `web/`

- `src/main.tsx` — React root, mounts `<App />`.
- `src/App.tsx` — currently a hello page: calls `GET /health` on the API and
  shows reachable/unreachable. Chunk 8 replaces this with the real form.
