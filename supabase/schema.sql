-- ============================================================
-- Content Machine — Supabase schema (Шаг 1)
-- Run this entire file in Supabase SQL Editor.
-- ============================================================

-- Extensions (usually enabled by default in Supabase, but safe to ensure)
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Клиники
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  niche text default 'regenerative_medicine',
  doctor_name text,
  services text[],
  audience text,
  tone text,
  medical_restrictions text[],
  created_at timestamptz default now()
);

-- Заметки врача (сырые)
create table if not exists public.doctor_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  raw_text text not null,
  source text default 'widget' check (source in ('widget', 'voice', 'text')),
  processed boolean default false,
  created_at timestamptz default now()
);

-- Инсайты (после Analyst)
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  type text check (type in ('story', 'opinion', 'angle', 'hook')),
  content text not null,
  used_count int default 0,
  created_at timestamptz default now()
);

-- Тренды (после Research)
create table if not exists public.trend_signals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  topic text not null,
  why_relevant text,
  hook_angle text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Сгенерированные скрипты
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  variant_id text,
  topic text,
  hook text,
  full_script text not null,
  word_count int,
  critic_score float,
  approved boolean default false,
  google_doc_id text,
  google_doc_url text,
  created_at timestamptz default now()
);

-- Финальные версии (после правок команды)
create table if not exists public.script_finals (
  id uuid primary key default gen_random_uuid(),
  script_id uuid references public.scripts(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete cascade,
  final_text text not null,
  edited_by text,
  diff_processed boolean default false,
  created_at timestamptz default now()
);

-- Few-shot библиотека
create table if not exists public.few_shot_library (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  script_text text not null,
  why_good text,
  topic text,
  score float,
  active boolean default true,
  created_at timestamptz default now()
);

-- Правила из правок
create table if not exists public.diff_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  rule text not null,
  example_before text,
  example_after text,
  priority int default 3,
  active boolean default true,
  created_at timestamptz default now()
);

-- Визуальные слайды
create table if not exists public.slide_sets (
  id uuid primary key default gen_random_uuid(),
  script_id uuid references public.scripts(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete cascade,
  slides jsonb,
  style_template jsonb,
  drive_folder_id text,
  status text default 'pending' check (status in ('pending', 'rendered', 'exported')),
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES (для типичных запросов)
-- ============================================================

create index if not exists idx_doctor_notes_clinic on public.doctor_notes(clinic_id, created_at desc);
create index if not exists idx_insights_clinic_type on public.insights(clinic_id, type);
create index if not exists idx_trend_signals_clinic_expires on public.trend_signals(clinic_id, expires_at);
create index if not exists idx_scripts_clinic on public.scripts(clinic_id, created_at desc);
create index if not exists idx_script_finals_script on public.script_finals(script_id);
create index if not exists idx_few_shot_clinic_active on public.few_shot_library(clinic_id, active);
create index if not exists idx_diff_rules_clinic_active on public.diff_rules(clinic_id, active, priority);
create index if not exists idx_slide_sets_script on public.slide_sets(script_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Политика: каждая сессия видит только свою клинику.
-- clinic_id прокидывается через `set_config('app.clinic_id', '<uuid>', true)`
-- перед запросом (делается в серверном коде Next.js).
-- Service-role ключ обходит RLS, поэтому cron-джобы и миграции работают.

alter table public.clinics          enable row level security;
alter table public.doctor_notes     enable row level security;
alter table public.insights         enable row level security;
alter table public.trend_signals    enable row level security;
alter table public.scripts          enable row level security;
alter table public.script_finals    enable row level security;
alter table public.few_shot_library enable row level security;
alter table public.diff_rules       enable row level security;
alter table public.slide_sets       enable row level security;

-- clinics: изоляция по id
drop policy if exists "clinic_isolation_clinics" on public.clinics;
create policy "clinic_isolation_clinics" on public.clinics
  for all
  using (id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Шаблон политики для всех таблиц с clinic_id
drop policy if exists "clinic_isolation_doctor_notes" on public.doctor_notes;
create policy "clinic_isolation_doctor_notes" on public.doctor_notes
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_insights" on public.insights;
create policy "clinic_isolation_insights" on public.insights
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_trend_signals" on public.trend_signals;
create policy "clinic_isolation_trend_signals" on public.trend_signals
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_scripts" on public.scripts;
create policy "clinic_isolation_scripts" on public.scripts
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_script_finals" on public.script_finals;
create policy "clinic_isolation_script_finals" on public.script_finals
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_few_shot_library" on public.few_shot_library;
create policy "clinic_isolation_few_shot_library" on public.few_shot_library
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_diff_rules" on public.diff_rules;
create policy "clinic_isolation_diff_rules" on public.diff_rules
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

drop policy if exists "clinic_isolation_slide_sets" on public.slide_sets;
create policy "clinic_isolation_slide_sets" on public.slide_sets
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- ============================================================
-- DONE
-- Проверить: select table_name from information_schema.tables
--            where table_schema = 'public';
-- Должно вернуть 9 таблиц.
-- ============================================================
