# Callback Scheduler

KompanionAI take-home: schedules exactly one callback when a lead asks to be
called back, respecting a calling window and understanding only the time
phrasings it's confident about.

## Run it

```bash
cp .env.example .env
docker compose up -d --build
```

This starts three containers: Postgres (`db`), the API (`api`, runs pending
migrations on startup then listens on `API_PORT`, default `3000`), and the
web page (`web`, Vite dev server on `WEB_PORT`, default `5174`).

- API health check: `curl http://localhost:3000/health`
- Web page: http://localhost:5174

If `5174` is already taken on your machine, change `WEB_PORT` in `.env` and
re-run `docker compose up -d --build`.

## Test

With the stack running (`docker compose up -d`):

```bash
docker compose exec api npm test
```

44 tests: pure-function unit tests for the parser, calling window, and
scheduling decision; integration tests for the database layer (idempotent
insert) and the HTTP routes (including a real concurrency test — two
literal simultaneous requests for the same `request_id`) against the real
Postgres container.

## API

- `POST /callbacks` — schedules a callback or explains why it couldn't.
  `201` on a fresh request, `200` on a replay of an existing `request_id`,
  `400` only for a structurally invalid body.
- `GET /callbacks?lead_id=` — a lead's callback history, newest first.
  `400` if `lead_id` is missing, `200` + `[]` if the lead has none yet.

## What I'd build next

Two foundational pieces first, then four feature ideas that build on each
other:

- **The dialer worker.** Storing a scheduled callback is explicitly the end
  of the flow for this brief — nothing watches the table and actually
  places the call. That's the one piece that turns this from "a scheduler"
  into a system that actually calls people back. It needs its own
  "exactly once" thinking (never dial the same lead twice for one
  scheduled callback, even across a crash/restart) and a policy for what
  happens on no-answer or voicemail.
- **Basic observability.** Right now there's no visibility into real
  traffic — how often `requested_text` fails to parse, which phrasings
  actually show up, how often the window moves a request. That data would
  directly justify *which* phrasings below are worth building, instead of
  guessing.

Then, in the order I'd actually build them:

1. **More forgiving phrasing.** Most people don't talk in 24-hour time —
   "Tuesday at 5," "quarter past 3," "two days from now" should all work,
   not just the 4 strict formats the brief requires.
2. **Voice-to-text input**, replacing the form's text box with an actual
   microphone — speech converted to text feeding the exact same parser,
   unchanged. This is the natural next step toward how the real product
   works: the brief's own framing is a lead saying it out loud on a call.
3. **Calendar invite integration** (Google Calendar/Gmail) — once a
   callback is scheduled, actually send the invite instead of just storing
   a row.
4. **Scheduling-pattern analytics**, by time of day and by lead time zone —
   since every outcome is already stored (not just successes, see
   `docs/PLAN.md`'s decision log), the data for this already exists; it's
   a read, not a new capture mechanism. Useful for an AI BDR to learn the
   best windows to call.

## Docs

- [`DESIGN_NOTE.md`](DESIGN_NOTE.md) — decisions and why, production risks,
  what I'd do with more time, how AI was used, time spent.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the request flow.
- [`docs/PLAN.md`](docs/PLAN.md) — chunk-by-chunk build log and the full
  decision log (every option considered, not just what was chosen).
- [`docs/CODE_MAP.md`](docs/CODE_MAP.md) — one line per file.
