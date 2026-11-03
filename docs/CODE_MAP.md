# Code Map

One line per file, what it does. Updated every chunk — this is the map for the
live change in the review call.

## Root

- `docker-compose.yml` — wires up `db` (Postgres), `api`, `web`; dev mode with
  volume mounts for hot reload.
- `.env.example` / `.env` — all config, including `CALLING_WINDOW_START` /
  `CALLING_WINDOW_END` (the live-change knob).

## `api/`

- `src/index.ts` — startup only: runs migrations, loads the window config,
  builds the app via `createApp`, starts listening.
- `src/app.ts` — builds the Express app (middleware, routes) given a
  `Pool` and a `CallingWindowConfig`. Split from `index.ts` so tests can
  import it directly without a running server.
- `src/config.ts` — `loadCallingWindowConfig`: reads
  `CALLING_WINDOW_START`/`CALLING_WINDOW_END` from env, falls back to the
  Mon-Fri 08:00-21:00 default. This is the live "move the window" hook.
- `src/routes/callbacks.ts` — `POST /callbacks`: validates request shape
  (400 only for structurally broken input), calls `decideCallback`, then
  `insertOrGetCallback`. 201 for a fresh insert, 200 for a replay,
  regardless of scheduled vs. not_scheduled. `GET /callbacks?lead_id=`:
  400 if missing, otherwise 200 + an array (empty if no rows), newest
  `received_at` first.
- `src/routes/callbacks.test.ts` — 10 tests: POST validation (400s),
  both scheduling outcomes over real HTTP, a sequential duplicate, a
  real concurrent duplicate (proving exactly one insert), and GET's
  missing-param/empty/ordering/lead-isolation cases.
- `src/db/pool.ts` — the single `pg.Pool`, built from `DATABASE_URL`.
- `src/db/migrate.ts` — migration runner: creates `schema_migrations` if
  missing, applies any new `.sql` file in `api/migrations/` in filename
  order, inside a transaction per file. Exported as `runMigrations()` so
  `index.ts` can run it on startup; also runnable standalone via
  `npm run migrate`.
- `api/migrations/0001_create_callbacks.sql` — the `callbacks` table:
  `request_id` as primary key, `status` + `reason`, requested/scheduled
  times as `TIMESTAMPTZ` (null together exactly when not_scheduled, a
  CHECK constraint enforces it), `moved`, an index on `lead_id`.
- `src/db/callbacksRepository.ts` — `insertOrGetCallback`: the
  idempotent insert (`ON CONFLICT (request_id) DO NOTHING RETURNING *`,
  re-select on conflict). This is where "exactly once" actually lives.
  `listCallbacksByLeadId`: plain SELECT, filtered by lead_id, newest
  `received_at` first.
- `src/db/callbacksRepository.test.ts` — 3 integration tests against
  real Postgres: fresh insert, duplicate-with-different-body replay
  (proves the original wins and only one row exists), and a
  not_scheduled row's null time columns.
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
- `src/scheduling/decision.ts` — pure function `decideCallback`: wires
  parser -> past-time check -> window in a fixed order into one result,
  `{ status: "scheduled", ... }` or `{ status: "not_scheduled", reason }`.
  No DB, no HTTP. Called by `routes/callbacks.ts`.
- `src/scheduling/decision.test.ts` — 7 unit tests covering both window
  outcomes end to end, unparseable text, past-time rejection (including
  a past time that's also outside window hours, proving the check order),
  an invalid zone, and a non-US lead zone (Tokyo).

## `web/`

- `src/main.tsx` — React root, mounts `<App />`.
- `src/App.tsx` — owns `leadId` and a `refreshKey` counter; renders
  `<CallbackForm />` and `<CallbackList />`, wired to the same `leadId`.
- `src/CallbackForm.tsx` — the form: lead id (controlled via props, free
  text), lead time zone (`<select>` of every IANA zone via
  `Intl.supportedValuesOf`), requested text (free text). Generates a
  fresh `request_id` and `received_at` per submit, POSTs to the API,
  renders `<CallbackResult />` with whatever came back, then calls
  `onSubmitted()`.
- `src/CallbackList.tsx` — fetches `GET /callbacks?lead_id=` whenever
  `leadId` or `refreshKey` changes; renders one `<CallbackResult />` per
  row (no new per-row logic). Handles loading/empty/error states.
- `src/CallbackResult.tsx` — reusable display for one callback: the
  not_scheduled-with-reason case, or the scheduled case (lead-local
  requested/scheduled times, viewer-local scheduled time, move reason
  when `moved`). Chunk 9 reuses this per list row.
- `src/formatTime.ts` — `formatInZone` (Intl.DateTimeFormat wrapper) and
  `BROWSER_TIME_ZONE` (the viewer's own zone, resolved once).
- `src/types.ts` — `CallbackResponse`, matching the API's JSON shape.
