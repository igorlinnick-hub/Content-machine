-- ============================================================
-- Content Machine — Migration 047
-- Storage bucket for slides rendered in-house (lib/render/*).
--
-- Why this exists: until now a composed carousel lived only in
-- Canva, and render_result.outputs[].url pointed at Canva's
-- export links — which EXPIRE (verified 2026-08-13: exports
-- written the previous evening already returned AccessDenied,
-- so /visual could never show a preview of a finished post).
-- Slides we render ourselves are uploaded here and the public
-- URL is permanent.
--
-- Public bucket: service-role writes, public reads (same shape
-- as post-references in 007) so the workspace, Buffer and any
-- multimodal call can fetch a page by URL without signing.
-- Run in Supabase SQL Editor after 046.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('post-slides', 'post-slides', true)
on conflict (id) do nothing;

-- Preview slot for the in-house renderer. Deliberately NOT render_result:
-- while the renderer is being judged against Canva, a local render must not
-- overwrite the Canva carousel a post already has, and the compose/queue
-- status machine must stay untouched. Same JSON shape as render_result plus
-- `renderer`, `skin` and any `overflow` pages the auto-fit had to squeeze.
alter table public.slide_sets
  add column if not exists render_preview jsonb;
