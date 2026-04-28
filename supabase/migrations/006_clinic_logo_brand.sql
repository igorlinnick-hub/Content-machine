-- ============================================================
-- Content Machine — Migration 006
-- Adds per-clinic logo: clinics.logo_url + a public Supabase
-- Storage bucket `clinic-logos`. Admin uploads via the Brand
-- card on /dashboard; the URL is baked into every rendered
-- slide via lib/visual/store.loadStyleTemplate fallback.
-- Run in Supabase SQL Editor after 005.
-- ============================================================

alter table public.clinics
  add column if not exists logo_url text;

-- Public bucket: service-role uploads (bypasses RLS), public reads
-- so Puppeteer / browsers can fetch the logo when rendering slides.
insert into storage.buckets (id, name, public)
values ('clinic-logos', 'clinic-logos', true)
on conflict (id) do nothing;
