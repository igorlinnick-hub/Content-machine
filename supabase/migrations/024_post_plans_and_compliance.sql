-- ============================================================
-- Content Machine — Migration 024
-- Script-factory architecture (HANDOFF-POSTS.md §22):
--   - slide_sets.status vocabulary extended for compliance + Canva-bot lifecycle
--   - slide_sets.compliance JSONB stores the gate's verdict + findings
--   - slide_sets.plan_id text references the editorial plan handle ("POST 18")
--   - content_plan_topics extended with plan_handle + cycle_position for cron rotation
--
-- Run in Supabase SQL Editor after 022.
-- ============================================================

-- ─── slide_sets.compliance + plan_id ─────────────────────────
alter table public.slide_sets
  add column if not exists compliance jsonb,
  add column if not exists plan_id text;

create index if not exists idx_slide_sets_status
  on public.slide_sets(status);
create index if not exists idx_slide_sets_plan_id
  on public.slide_sets(plan_id);

-- Status vocabulary documentation. We do NOT add a CHECK constraint so
-- legacy rows keep working — vocab is enforced by lib/posts/pipeline.ts
-- at write-time. Allowed values:
--   'pending'           — generate request received, pipeline running
--   'blocked'           — compliance returned REMOVE or REWORD
--   'ready_for_canva'   — compliance PASS, Canva bot eligible to consume
--   'in_canva'          — Canva bot started assembly (optional)
--   'published'         — final state after manual approval + IG publish
--   'rendered'          — legacy: rendered to PNG, awaiting marketing review
--   'exported'          — legacy: downloaded ZIP

-- ─── content_plan_topics.plan_handle + cycle_position ────────
-- plan_handle: stable human-readable identifier ("POST 18"). Matches
-- the JSON field "plan_id" in the target output shape (§15).
-- cycle_position: 1..24 within the active 8-week editorial cycle.
-- The cron picks the smallest cycle_position whose slide_set isn't yet
-- ready_for_canva for the current cycle.
alter table public.content_plan_topics
  add column if not exists plan_handle text,
  add column if not exists cycle_position integer;

create index if not exists idx_content_plan_topics_cycle
  on public.content_plan_topics(clinic_id, cycle_position)
  where cycle_position is not null;
