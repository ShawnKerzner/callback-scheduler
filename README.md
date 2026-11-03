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

## Docs

- [`DESIGN_NOTE.md`](DESIGN_NOTE.md) — decisions and why, production risks,
  what I'd do with more time, how AI was used, time spent.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the request flow.
- [`docs/PLAN.md`](docs/PLAN.md) — chunk-by-chunk build log and the full
  decision log (every option considered, not just what was chosen).
- [`docs/CODE_MAP.md`](docs/CODE_MAP.md) — one line per file.
