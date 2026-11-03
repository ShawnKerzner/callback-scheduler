CREATE TABLE callbacks (
  request_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  lead_timezone TEXT NOT NULL,
  requested_text TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('scheduled', 'not_scheduled')),
  reason TEXT,

  requested_local_time TIMESTAMPTZ,
  scheduled_local_time TIMESTAMPTZ,
  moved BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT scheduled_times_match_status CHECK (
    (status = 'scheduled' AND requested_local_time IS NOT NULL AND scheduled_local_time IS NOT NULL)
    OR
    (status = 'not_scheduled' AND requested_local_time IS NULL AND scheduled_local_time IS NULL)
  )
);

CREATE INDEX idx_callbacks_lead_id ON callbacks (lead_id);
