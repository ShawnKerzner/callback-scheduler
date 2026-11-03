import type { Pool } from "pg";

export interface NewCallbackRow {
  requestId: string;
  leadId: string;
  leadTimezone: string;
  requestedText: string;
  receivedAt: string; // ISO-8601 UTC
  status: "scheduled" | "not_scheduled";
  reason: string | null;
  requestedLocalTime: string | null; // ISO, only when status is "scheduled"
  scheduledLocalTime: string | null; // ISO, only when status is "scheduled"
  moved: boolean;
}

export interface CallbackRow {
  request_id: string;
  lead_id: string;
  lead_timezone: string;
  requested_text: string;
  received_at: Date;
  status: "scheduled" | "not_scheduled";
  reason: string | null;
  requested_local_time: Date | null;
  scheduled_local_time: Date | null;
  moved: boolean;
  created_at: Date;
}

export interface InsertResult {
  row: CallbackRow;
  wasReplay: boolean;
}

/**
 * Idempotent insert: request_id is UNIQUE, so a duplicate delivery -- even
 * one racing another insert at the exact same instant from a different
 * connection -- can never create a second row. Postgres resolves the race
 * at the database level; this function's only job on the losing side is to
 * read back the winner's row instead of erroring.
 */
export async function insertOrGetCallback(
  pool: Pool,
  row: NewCallbackRow
): Promise<InsertResult> {
  const insertResult = await pool.query<CallbackRow>(
    `INSERT INTO callbacks (
      request_id, lead_id, lead_timezone, requested_text, received_at,
      status, reason, requested_local_time, scheduled_local_time, moved
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (request_id) DO NOTHING
    RETURNING *`,
    [
      row.requestId,
      row.leadId,
      row.leadTimezone,
      row.requestedText,
      row.receivedAt,
      row.status,
      row.reason,
      row.requestedLocalTime,
      row.scheduledLocalTime,
      row.moved,
    ]
  );

  if (insertResult.rows.length === 1) {
    return { row: insertResult.rows[0], wasReplay: false };
  }

  const existing = await pool.query<CallbackRow>(
    "SELECT * FROM callbacks WHERE request_id = $1",
    [row.requestId]
  );

  if (existing.rows.length === 0) {
    throw new Error(
      `Insert conflicted on request_id "${row.requestId}" but no row was found on re-select -- this should be impossible.`
    );
  }

  return { row: existing.rows[0], wasReplay: true };
}

export async function listCallbacksByLeadId(pool: Pool, leadId: string): Promise<CallbackRow[]> {
  const result = await pool.query<CallbackRow>(
    "SELECT * FROM callbacks WHERE lead_id = $1 ORDER BY received_at DESC",
    [leadId]
  );
  return result.rows;
}
