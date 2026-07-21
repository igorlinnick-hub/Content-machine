-- Live progress of the Canva compose pipeline, written stage-by-stage
-- by the orchestrator so any client can poll where the run currently
-- is (and where it failed). Cleared on success/cancel.
ALTER TABLE slide_sets
  ADD COLUMN IF NOT EXISTS compose_progress jsonb;
