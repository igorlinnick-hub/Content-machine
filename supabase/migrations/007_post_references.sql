-- ============================================================
-- Content Machine — Migration 007
-- Adds post_references: per-clinic library of "golden post"
-- visual references (PNG slides). Admin uploads the real
-- carousel slides they want the AI to mirror — cover / body /
-- CTA layouts, brand-correct logos, etc. Future slide-rebuild
-- (HANDOFF §16 mandate) will feed these into a multimodal
-- pass so the writer + renderer can imitate the layout
-- without copying 1:1.
-- Run in Supabase SQL Editor after 006.
-- ============================================================

create table if not exists public.post_references (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  image_url text not null,
  storage_path text,
  label text,
  mode text check (mode in ('photo', 'clean')),
  role text check (role in ('cover', 'body', 'cta', 'full_post')),
  category_slug text,
  notes text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_references_clinic
  on public.post_references(clinic_id, position);

create index if not exists idx_post_references_clinic_active
  on public.post_references(clinic_id, active)
  where active = true;

alter table public.post_references enable row level security;

drop policy if exists "clinic_isolation_post_references" on public.post_references;
create policy "clinic_isolation_post_references" on public.post_references
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Public bucket: service-role uploads, public reads so future
-- multimodal API calls can fetch the PNG by URL.
insert into storage.buckets (id, name, public)
values ('post-references', 'post-references', true)
on conflict (id) do nothing;
