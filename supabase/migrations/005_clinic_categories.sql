-- ============================================================
-- Content Machine — Migration 005
-- Adds clinic_categories: per-clinic content categories with
-- trigger keywords, a Drive folder for photo backgrounds, and
-- a CTA template. The post-generation pipeline matches each
-- generated topic against trigger lists to pick a category,
-- then uses its photos and CTA pattern.
-- Run in Supabase SQL Editor after 004.
-- ============================================================

create table if not exists public.clinic_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  slug text not null,
  name text not null,
  emoji text,
  position int not null default 0,
  triggers text[] not null default '{}'::text[],
  drive_folder_id text,
  cta_template text,
  created_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

create index if not exists idx_clinic_categories_clinic
  on public.clinic_categories(clinic_id, position);

-- Link generated slide_sets to the category that produced them
-- (nullable for legacy / unmatched generations).
alter table public.slide_sets
  add column if not exists category_id uuid references public.clinic_categories(id) on delete set null;

create index if not exists idx_slide_sets_category
  on public.slide_sets(category_id);

alter table public.clinic_categories enable row level security;
