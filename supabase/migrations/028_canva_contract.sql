-- ============================================================
-- Content Machine — Migration 028
-- Locks the contract-seam with the Canva runner ("canva-bot").
--
-- Decisions (council, 2026-06-17):
--   1. Render write-back goes into ONE column, render_result JSONB.
--      The runner writes:
--        {
--          "schema_version": 1,
--          "channel": "carousel",
--          "canva_edit_url": "...",
--          "outputs": [{"kind":"slide","page":1,"url":"<png>"}, ...],
--          "assets_used": ["MAHM..."],
--          "cost_usd": 0.24,
--          "ts": "..."
--        }
--      schema_version lets us evolve the shape without migrations.
--      Two separate columns (canva_design_url + compose_status from
--      migration 027) were a pre-contract sketch — drop them.
--
--   2. Status enum aligned with the spec:
--        pending          (system)
--        review           (human / medical — renamed from needs_review)
--        blocked          (marketer fixes findings)
--        ready_for_canva  (queued for runner)
--        in_canva         (runner working)
--        visuals_ready    (marketer reviews)
--        approved         (marketer ack — NOT auto-publish)
--        published        (manual flip after IG/Buffer post)
--      Renames the live 'needs_review' rows to 'review' here. No
--      DB CHECK constraint (per migration 025 lesson — app validates).
--
--   3. Runner idempotency: the compose endpoint uses an atomic
--      UPDATE … WHERE status='ready_for_canva' RETURNING id pattern
--      so two pings can't race into two designs. Pure SQL pattern,
--      no schema needed.
--
--   4. Migration 027's index on (clinic_id, compose_status) is
--      orphaned by this drop — replaced by an index on the new
--      'status' values the runner actually polls.
-- ============================================================

-- Step 1: rename live rows that use the old word.
update public.slide_sets
  set status = 'review'
  where status = 'needs_review';

-- Step 2: tear down migration 027 columns + index.
drop index if exists public.slide_sets_compose_status_idx;

alter table public.slide_sets
  drop column if exists canva_design_url,
  drop column if exists compose_status,
  drop column if exists compose_error;

-- Step 3: bring up the single contract column + a runner-poll index.
alter table public.slide_sets
  add column if not exists render_result jsonb;

-- The runner polls "give me ready_for_canva rows for clinic X" on a
-- short interval; the marketer UI polls "what's the status of this
-- one row" on the GET path which uses the PK. So we only need the
-- clinic+status index, not on render_result.
create index if not exists slide_sets_status_clinic_idx
  on public.slide_sets (clinic_id, status, created_at desc);
