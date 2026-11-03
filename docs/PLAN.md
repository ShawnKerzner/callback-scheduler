# Plan

KompanionAI Callback Scheduler take-home. Budget: 5–7 hours, stop at 7.

## Chunks

| # | Chunk | Status | Time spent |
|---|---|---|---|
| 0 | Scope and architecture | Done | — |
| 1 | One-command skeleton (docker compose: Postgres + API health + web hello) | Done | — |
| 2 | Parser (pure function) | Done | — |
| 3 | Calling window (pure function) | Done | — |
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
- Weekday + time, same weekday, before the time today -> today.
- Weekday + time, same weekday, after the time today -> rolls to next week
  (decision: the parser resolves this itself rather than leaving a
  same-day-but-past result for the past-time policy to catch).
- Weekday + time, any other day -> next occurrence (1-6 days out).
- `tomorrow at HH:MM` computed from the lead's *local* calendar date
  (converted from `received_at` via `leadTimezone`), not the UTC date.
- `in N hours` / `in N minutes` -> decision: this is a *duration* promise
  ("wait this long"), not a clock-face target, so it's computed as
  elapsed real time on the UTC instant, not wall-clock arithmetic. On a
  DST night this can land on a different clock number than naive
  "add N to the hour" would (e.g. 1:00am + "in 2 hours" lands on 4:00am,
  not 3:00am, the same way a 2-hour flight that crosses a DST boundary
  lands after 2 real hours in the air, not when the ground clock says
  +2) -- see test 12.
- ISO date-time with an explicit offset/`Z` -> unambiguous instant.
- ISO date-time with no offset -> decision: interpreted as wall-clock time
  *in the lead's time zone*, consistent with every other phrasing.
- Unmatched text (any string matching none of the 4 patterns) ->
  `not_understood` by construction, not a special case.
- Invalid `lead_timezone` -> `not_understood`, reason names the bad zone.
  Caught here (first place the zone is actually used), not at the HTTP
  layer.
- Scope boundary: an ISO date-time that's already in the past is still
  `understood` by the parser — rejecting past times is the past-time
  policy's job (chunk 4), not the parser's. This is also why "already in
  the past" only realistically happens on the raw-ISO path; every other
  phrasing resolves to the future by construction.

13 unit tests cover all of the above, including a DST-crossing `in 2
hours` and a `tomorrow` said at 23:50 local that crosses the UTC day
boundary — see `api/src/scheduling/parser.test.ts`.

### Chunk 3 — Calling window
(to be filled in chunk 3)

### Chunk 3 — Calling window
- Window boundaries are inclusive on both ends (08:00 and 21:00 exactly
  are both allowed) -- settled directly by the brief's wording ("before
  08:00" / "after 21:00" are strict).
- Config is one object (window hours + working days together), not
  hardcoded Mon-Fri, so the live-change drill (window or working-day
  changes) only ever touches a config value.
- "Move to same day" (before-window case) has no working-day qualifier
  -- applies even on a weekend. "Move to next working day" (after-window
  case) is the only branch that skips non-working days.
- Pure function has no concept of "today" or past times -- scope stays
  separate from chunk 4's past-time policy.
- Safety guard: next-working-day search is capped at 14 days and throws
  rather than looping forever on a nonsensical config (e.g. empty
  `workingDays`).

11 tests cover both boundaries, before/after in both directions, a
weekend inside vs. before the window, Friday/Saturday-night rollover
skipping the weekend, a non-Mon-Fri working week (proving config, not
hardcoding, drives the skip), and the brief's own 09:00-20:00 live-change
example. See `api/src/scheduling/window.test.ts`.

### Chunk 4 — Scheduling decision
(to be filled in chunk 4)

### Chunk 6 — POST /callbacks
(to be filled in chunk 6)

### Chunk 7 — GET /callbacks
(to be filled in chunk 7)

### Chunk 8 — React form
- `requested_text` stays a free-text input, not a time picker, and the
  frontend does not pre-validate it against the calling window. The real
  input in production is a lead's spoken words on a call, which can't be
  constrained by a UI widget; restricting the form would duplicate the
  window logic client-side (two sources of truth) and would make it
  impossible to demo the window-move / not-scheduled behavior through the
  page. The API is the only place the window rule lives.
- When a request is moved, show both times clearly inline on the result
  (not a modal): "You asked for: X. Scheduled for: Y — outside calling
  hours, moved to the next available time." This is exactly why the
  brief requires storing both the requested and scheduled time.
- The client generates a fresh `request_id` (e.g. `crypto.randomUUID()`) on
  every form submission — never reused across a failed attempt and its
  retry. A `not_scheduled` result is terminal for its `request_id` (replay
  logic would just hand back the same failure), so "fix the wording and
  resubmit" only works as a brand-new request with a new id.

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
| Parsing approach | (a) hand-written strict parser (b) chrono-node (c) LLM | Chose (a). "No guessing" has to be the *default* behavior of unmatched input, not a filter bolted onto a library that's built to always guess (chrono-node) or a non-deterministic model call that needs network (LLM, which also conflicts with "tests must run without network access"). Only 4 phrasings are required, so hand-rolling is cheap, and every accept/reject decision is a line of code defensible line-by-line in the review call. |
| "In N hours/minutes" across DST | (a) elapsed real time on the UTC instant (b) naive wall-clock + N | Chose (a). Treated "in N hours" as a duration promise (wait N real hours), not a clock-face target — same reasoning as a 2-hour flight crossing a DST change landing after 2 real hours in the air, not at "departure time + 2" on the ground clock. (b) would mean a lead who said "in 2 hours" on a spring-forward night actually only waited 1 real hour. |
| Web dev port | Vite default 5173 vs 5174 | 5174. Discovered during chunk 1 evidence: another project's dev server on this machine already owns 5173 on `127.0.0.1`/`::1`, and Docker's forwarded port lost to it under `localhost`. Moved our port rather than touching an unrelated process. |
| CORS on the API | Open (`cors()`, any origin) vs restricted to the web dev origin | Open. Auth is explicitly out of scope and this is local-only; a same-origin or allow-list policy would be real production hygiene but adds nothing here except another env var to keep in sync between `api` and `web`. Worth flagging as a "before going live" item in the design note. |

## Time log

| Chunk | Started | Hours |
|---|---|---|
| 0 | 2026-11-03 | — |
