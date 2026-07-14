-- Track content plan generation state so the client can poll for completion.
-- Values: null = idle, 'generating' = in progress, 'error' = last attempt failed.
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS plan_status text,
  ADD COLUMN IF NOT EXISTS plan_error text;
