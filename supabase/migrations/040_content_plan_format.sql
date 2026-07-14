-- Add format column to content_plan_topics.
-- Stores the script template name (e.g. "Diagnostic deep-dive") so the
-- Writer uses a specific structural scaffold instead of picking randomly.
ALTER TABLE content_plan_topics
  ADD COLUMN IF NOT EXISTS format text;
