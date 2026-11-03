# Plan

KompanionAI Callback Scheduler take-home. Budget: 5–7 hours, stop at 7.

## Chunks

| # | Chunk | Status | Time spent |
|---|---|---|---|
| 0 | Scope and architecture | In progress | — |
| 1 | One-command skeleton (docker compose: Postgres + API health + web hello) | Not started | — |
| 2 | Parser (pure function) | Not started | — |
| 3 | Calling window (pure function) | Not started | — |
| 4 | Scheduling decision (pure function, combines 2+3) | Not started | — |
| 5 | Database layer (schema, migration, idempotent insert) | Not started | — |
| 6 | `POST /callbacks` (+ concurrency test) | Not started | — |
| 7 | `GET /callbacks?lead_id=` | Not started | — |
| 8 | React page: form + result | Not started | — |
| 9 | React page: callback list | Not started | — |
| 10 | Wrap-up: change drill, README, design note, time spent | Not started | — |

## Agreed edge cases per chunk

### Chunk 0 — shaping decisions (see Decision Log)
- Past requested time → rejected as not-scheduled, not rescheduled.
- Every outcome (scheduled and not_scheduled) gets a stored row.
- Duplicate `request_id` with a different body → idempotent replay of the
  original, no conflict error.

### Chunk 2 — Parser
(to be filled in chunk 2)

### Chunk 3 — Calling window
(to be filled in chunk 3)

### Chunk 4 — Scheduling decision
(to be filled in chunk 4)

### Chunk 6 — POST /callbacks
(to be filled in chunk 6)

### Chunk 7 — GET /callbacks
(to be filled in chunk 7)

## Decision log

| Decision | Options considered | Why |
|---|---|---|
| Past requested time | (a) reject as not-scheduled (b) bump to next valid window | Chose (a). Bumping invents a time the lead never asked for, which cuts against rule 2 ("never invent a default time") even though it's phrased for unparseable text — the same principle applies to a stale time. Rejecting is also trivial to explain live. |
| Storing not-scheduled results | (a) store every outcome (b) only store successes | Chose (a). Makes "exactly once" uniform across both outcomes — a replayed not-scheduled request just reads back the same row instead of being re-parsed. Also gives `GET /callbacks` real history to show. |
| Duplicate `request_id`, different body | (a) idempotent replay of original (b) 409 on mismatch | Chose (a). `request_id` is the idempotency key, full stop — same model as Stripe-style idempotency keys. Detecting mismatches adds a comparison step and a new error path the brief doesn't ask for. |
| DB access layer | (a) node-postgres (`pg`) + raw SQL (b) Kysely (c) Prisma | Chose (a). "Exactly once" hinges on `INSERT ... ON CONFLICT ... RETURNING` — raw SQL keeps that mechanism fully visible for the review call, with no ORM/builder layer to explain on top of it. |
| HTTP framework | Express vs Fastify vs plain `http` | Express — minimal, ubiquitous, nothing beyond routing to defend. |
| Migrations | Raw numbered `.sql` files + startup runner vs a migration tool | Raw `.sql` — transparent, no tool-specific magic between us and the schema. |
| Test runner | Vitest vs Jest | Vitest — native TS/ESM support, fast, Jest-compatible API. |
| Frontend scaffold | Vite vs Create React App | Vite — CRA is deprecated. |
| Time zone library | Luxon vs date-fns-tz vs Temporal polyfill | Luxon — clean IANA zone handling and DST-safe arithmetic, good fit for "set zone, add duration, format" calls we need in the parser and window logic. (Confirm in chunk 2/3 once we see the actual calls needed.) |

## Time log

| Chunk | Started | Hours |
|---|---|---|
| 0 | 2026-11-03 | — |
