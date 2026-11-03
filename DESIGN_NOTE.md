# Design note

## Main decisions and why

- **Exactly once lives at the database level**, not the application level: `request_id` is the primary key, and inserts use `INSERT ... ON CONFLICT (request_id) DO NOTHING RETURNING *`. Two concurrent deliveries race at the Postgres row-lock level — Postgres guarantees exactly one wins; the loser re-reads the winner's row. No app-level locking or check-then-insert, which would be a race condition under real concurrency. Proven with a real concurrency test (two literal simultaneous HTTP requests), not just reasoning about it.
- **Every outcome is stored**, scheduled or not — a duplicate of a `not_scheduled` request replays the same answer instead of being re-parsed, and `GET /callbacks` shows real history either way.
- **Duplicate `request_id` with a different body replays the original**, full stop — same model as a payment-provider idempotency key. The second body is simply never looked at once the first has been committed.
- **Past requested times are rejected outright**, never rescheduled — nudging a past time into some future slot would mean inventing a time the lead never asked for, which is exactly what "no guessing" forbids. The past-time check runs on the parser's raw output, before the calling window is ever applied.
- **A hand-written parser**, not a library or an LLM — "no guessing" needs to be the *default* behavior for unmatched text, not a filter bolted onto something built to always produce a best guess (a general NLP library) or something non-deterministic and network-dependent (an LLM). Only 4 phrasings are required, so hand-rolling is cheap and every accept/reject decision is a line of code, not a third party's heuristic.
- **`in N hours/minutes` is a duration promise**, computed as elapsed time on the UTC instant, not wall-clock arithmetic — correct across a DST change (same reasoning as a 2-hour flight crossing a DST boundary landing after 2 real hours in the air, not at "departure + 2" on the ground clock).
- **The calling window and working days live in one config object**, read from env at startup — the literal hook for "move the window to 09:00–20:00" live: a two-line `.env` edit and a restart, zero code changes.
- **Stored times are UTC instants, never zone-baked strings.** `lead_timezone` is stored once, separately. Any viewer's local time — the lead's or someone else's — is a different *question asked of the same number*, never a second stored value. This is what makes "scheduled time in the lead's zone, and in the viewer's zone" a formatting detail in the frontend, not a backend feature.

Full option-by-option reasoning for every decision, including the ones above and several smaller ones (HTTP framework, DB access layer, status-code semantics, test strategy), is in `docs/PLAN.md`'s decision log.

## What could go wrong in production, and what I'd add before going live

- **No auth, and CORS is wide open.** Anyone who can reach the API can submit on behalf of any `lead_id` or read any lead's history via `GET /callbacks?lead_id=`. Out of scope for this brief, but the first thing I'd add: authenticated callers, and per-lead authorization on the GET route.
- **No rate limiting.** `POST /callbacks` has no abuse protection — a bad actor (or a buggy retry loop) could flood the table with distinct `request_id`s, since the idempotency guarantee only dedupes *identical* ids, not spam.
- **No pagination on `GET /callbacks`.** Fine for a demo; a lead with years of history would return an unbounded response.
- **Plain `console.log`/`console.error`, no structured logging or metrics.** In production I'd want structured logs, an error tracker, and basic metrics (scheduled vs. not_scheduled rate, parse-failure rate, latency) to actually see what leads are asking for and failing to get understood.
- **The exactly-once guarantee depends on well-behaved callers.** It only holds if a retry reuses the same `request_id`. A caller with a bug that mints a new id on every retry would create duplicate callbacks — nothing on our side can distinguish that from a genuinely new request, since we have no way to know the caller's intent beyond the id they send.
- **Public holidays aren't considered** in the calling window — explicitly out of scope per the brief, but a real deployment would need one.

## What I'd do with more time

Full roadmap (foundational pieces first, then features) is in the
README's ["What I'd build next"](README.md#what-id-build-next) section —
the dialer worker, observability, more forgiving phrasing, voice-to-text
input, calendar invite integration, and scheduling-pattern analytics.

Smaller engineering housekeeping, not covered there:

- A `leads` table (even a minimal one) instead of a bare `lead_id` string, to support a non-typo-prone picker in the UI and basic lead metadata.
- A CI pipeline running the test suite on every push.
- Frontend automated tests — explicitly optional per the brief, skipped to spend the time budget on the backend logic and the live-demo rehearsal instead.

## How I used AI, and where I corrected it

I used Claude Code (Sonnet) to implement the entire codebase, chunk by chunk, under a strict process: for every real decision it gave me 2–3 options with trade-offs and a recommendation, I decided; it showed real evidence (test output, `curl`, `psql`, screenshots) rather than asserting things worked; and I asked it to walk back through its own code at least twice for a critical read (it flagged and fixed duplicated validation logic in the parser on its own, after I asked whether the code looked "too nested" — its reasoning for keeping the function flat rather than splitting it into five smaller ones held up, documented in `docs/PLAN.md`).

No AI-suggested design decision was overridden outright in the end — several were challenged and defended before I accepted them (the parser's single-function structure; treating `in N hours` as elapsed time rather than wall-clock arithmetic, which it had initially asserted as settled fact instead of flagging as a real decision, and corrected once I pushed back). `docs/AI_CORRECTIONS.md` is the running log for this and is currently empty, accurately — not because nothing was questioned, but because nothing was ultimately overridden.
