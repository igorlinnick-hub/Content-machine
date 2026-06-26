-- 034_clinic_groups.sql
-- Adds a parent brand/group layer above individual doctor rows in `clinics`.
-- Each clinic_groups row = a real-world clinic brand (name + logo).
-- Each clinics row = one doctor within that brand.
-- Existing data: backfill each clinic into its own group (1:1 for now).

CREATE TABLE IF NOT EXISTS clinic_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  logo_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES clinic_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clinics_group_id_idx ON clinics(group_id);

-- Backfill: create one group per existing clinic row and link it.
DO $$
DECLARE
  r             RECORD;
  new_group_id  UUID;
BEGIN
  FOR r IN
    SELECT id, name, logo_url FROM clinics WHERE group_id IS NULL
  LOOP
    INSERT INTO clinic_groups (name, logo_url)
    VALUES (r.name, r.logo_url)
    RETURNING id INTO new_group_id;

    UPDATE clinics SET group_id = new_group_id WHERE id = r.id;
  END LOOP;
END $$;

-- RLS: service role bypasses (same pattern as scheduled_posts, migration 032).
ALTER TABLE clinic_groups ENABLE ROW LEVEL SECURITY;
-- No row-level policies → only service-role key (used by Next.js) can access.
