-- Starring + in-place editing of saved scripts.
--   starred    — user-pinned favourites, sorted to the top of Recent
--   updated_at — stamped whenever the text is edited from the UI, so a
--                hand-edited script is distinguishable from raw Writer output
ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_scripts_clinic_starred
  ON public.scripts(clinic_id, starred DESC, created_at DESC);
