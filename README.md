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

Test runner setup lands in chunk 2 (`cd api && npm test`, once there's logic
worth testing).

Design note lands in chunk 10 (wrap-up).

See `docs/ARCHITECTURE.md` for the request flow and `docs/PLAN.md` for the
chunk-by-chunk build plan and decision log.
