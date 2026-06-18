-- Distinguish doctor talking-head shots from clinic b-roll formats that MAs film.
ALTER TABLE studio_videos
  ADD COLUMN IF NOT EXISTS shot_type text NOT NULL DEFAULT 'doctor';
