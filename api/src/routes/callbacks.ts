import { Router } from "express";
import type { Pool } from "pg";
import type { CallbackRow, NewCallbackRow } from "../db/callbacksRepository.js";
import { insertOrGetCallback } from "../db/callbacksRepository.js";
import { decideCallback } from "../scheduling/decision.js";
import type { CallingWindowConfig } from "../scheduling/window.js";

interface RawCallbackRequest {
  request_id: string;
  lead_id: string;
  lead_timezone: string;
  requested_text: string;
  received_at: string;
}

const REQUIRED_STRING_FIELDS = [
  "request_id",
  "lead_id",
  "lead_timezone",
  "requested_text",
  "received_at",
] as const;

type ValidationResult =
  | { ok: true; data: RawCallbackRequest }
  | { ok: false; error: string };

// Shape validation only -- missing or wrong-type fields get a 400. A
// field that's structurally fine but semantically weird (bad timezone,
// garbled text, a past time) is NOT a 400 -- it's a valid request that
// decideCallback already turns into a normal not_scheduled response.
function validateBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const record = body as Record<string, unknown>;
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = record[field];
    if (typeof value !== "string" || value === "") {
      return { ok: false, error: `"${field}" is required and must be a non-empty string.` };
    }
  }

  return { ok: true, data: record as unknown as RawCallbackRequest };
}

function toResponseBody(row: CallbackRow) {
  return {
    request_id: row.request_id,
    lead_id: row.lead_id,
    lead_timezone: row.lead_timezone,
    requested_text: row.requested_text,
    received_at: row.received_at,
    status: row.status,
    reason: row.reason,
    requested_local_time: row.requested_local_time,
    scheduled_local_time: row.scheduled_local_time,
    moved: row.moved,
    created_at: row.created_at,
  };
}

export function callbacksRouter(pool: Pool, windowConfig: CallingWindowConfig): Router {
  const router = Router();

  router.post("/callbacks", async (req, res) => {
    const validation = validateBody(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { request_id, lead_id, lead_timezone, requested_text, received_at } = validation.data;

    try {
      const decision = decideCallback({
        requestedText: requested_text,
        receivedAt: received_at,
        leadTimezone: lead_timezone,
        windowConfig,
      });

      const newRow: NewCallbackRow =
        decision.status === "scheduled"
          ? {
              requestId: request_id,
              leadId: lead_id,
              leadTimezone: lead_timezone,
              requestedText: requested_text,
              receivedAt: received_at,
              status: "scheduled",
              reason: decision.moveReason ?? null,
              requestedLocalTime: decision.requestedLocalDateTime.toISO(),
              scheduledLocalTime: decision.scheduledLocalDateTime.toISO(),
              moved: decision.moved,
            }
          : {
              requestId: request_id,
              leadId: lead_id,
              leadTimezone: lead_timezone,
              requestedText: requested_text,
              receivedAt: received_at,
              status: "not_scheduled",
              reason: decision.reason,
              requestedLocalTime: null,
              scheduledLocalTime: null,
              moved: false,
            };

      const { row, wasReplay } = await insertOrGetCallback(pool, newRow);
      // Status reflects whether a NEW row was created, not whether
      // scheduling succeeded -- 201 for a fresh insert (scheduled or
      // not_scheduled), 200 for a replay of an existing request_id.
      res.status(wasReplay ? 200 : 201).json(toResponseBody(row));
    } catch (err) {
      console.error("POST /callbacks failed:", err);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  return router;
}
