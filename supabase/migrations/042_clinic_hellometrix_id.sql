-- Link Content Machine clinic to its Hellometrix client UUID.
-- Used by the published-posts adapter to pull Instagram history for the planner.
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS hellometrix_client_id uuid;

-- Backfill HWC (Dr. Shawn regenmed clinic)
UPDATE clinics
  SET hellometrix_client_id = 'af0fa26e-26d7-4325-a63f-a1226d39ed9d'
  WHERE name = 'hawaiiwellness' OR name ILIKE '%hawaii%wellness%';
