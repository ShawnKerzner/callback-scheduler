export interface CallbackResponse {
  request_id: string;
  lead_id: string;
  lead_timezone: string;
  requested_text: string;
  received_at: string;
  status: "scheduled" | "not_scheduled";
  reason: string | null;
  requested_local_time: string | null; // ISO instant, only when scheduled
  scheduled_local_time: string | null; // ISO instant, only when scheduled
  moved: boolean;
  created_at: string;
}
