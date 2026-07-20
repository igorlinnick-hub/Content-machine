-- Allow individual weeks in the content plan to be skipped.
-- Skipped weeks are hidden from the plan UI and excluded from rotation.
ALTER TABLE content_plan_weeks
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;
