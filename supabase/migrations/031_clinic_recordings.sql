-- Recordings made by doctors via the in-app teleprompter.
-- Videos live on Google Drive; this table stores the metadata + link.
CREATE TABLE IF NOT EXISTS clinic_recordings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  script_id     UUID REFERENCES scripts(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT '',
  drive_file_id TEXT NOT NULL,
  drive_url     TEXT NOT NULL,
  duration_sec  INTEGER,
  size_bytes    BIGINT,
  status        TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('final', 'deleted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clinic_recordings_clinic_id_idx ON clinic_recordings(clinic_id);
CREATE INDEX IF NOT EXISTS clinic_recordings_created_at_idx ON clinic_recordings(created_at DESC);
