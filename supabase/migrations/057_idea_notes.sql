-- ============================================================
-- Content Machine — Migration 057
-- Notes: the idea scratchpad that lives next to Generate.
--
-- Why a new table instead of reusing doctor_notes: doctor_notes is a
-- one-way feed into the Analyst (write once, processed=true, never
-- read back by a human). Notes is a workspace — you re-open, re-edit
-- and re-organize the same note for weeks. Different lifecycle, so a
-- different table; the two do not talk to each other.
--
-- The contract that shapes the columns: the AI may fix spelling,
-- grammar and layout, never the thinking. So we keep BOTH texts —
-- `raw_body` is exactly what was typed or read off the paper, `body`
-- is the tidied version. Nothing the machine does is destructive:
-- the original is one toggle away, forever.
-- Run in Supabase SQL Editor after 056.
-- ============================================================

create table if not exists public.idea_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  -- Short label the tidy pass derives from the content. Editable.
  title text,
  -- What you read and edit in the app: tidied if the pass ran, a copy
  -- of raw_body otherwise.
  body text not null,
  -- Untouched input. Typed dump, or the verbatim transcription of the
  -- photographed page. Never rewritten after insert.
  raw_body text not null,
  -- 'typed'  — written in the composer
  -- 'photo'  — photographed paper, transcribed by the vision pass
  source text not null default 'typed' check (source in ('typed', 'photo')),
  -- 'raw'     — never tidied (agents off, or the user undid the tidy)
  -- 'tidied'  — body is the model's organized version of raw_body
  -- 'failed'  — the pass errored; body still holds the raw text
  tidy_status text not null default 'raw'
    check (tidy_status in ('raw', 'tidied', 'failed')),
  -- What the pass could not read (handwriting) or could not place.
  -- Shown as a quiet footnote so nothing silently disappears.
  tidy_flags text[] not null default '{}',
  -- The photographed page(s), kept so you can check the transcription
  -- against the paper. Public URLs, same shape as post_references.
  image_urls text[] not null default '{}',
  storage_paths text[] not null default '{}',
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_idea_notes_clinic
  on public.idea_notes(clinic_id, pinned desc, updated_at desc);

alter table public.idea_notes enable row level security;

drop policy if exists "clinic_isolation_idea_notes" on public.idea_notes;
create policy "clinic_isolation_idea_notes" on public.idea_notes
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);

-- Photographed pages. Public bucket, service-role writes — same shape
-- as post-references (007) and post-slides (047), so the app and any
-- multimodal call can fetch a page by URL without signing.
insert into storage.buckets (id, name, public)
values ('note-photos', 'note-photos', true)
on conflict (id) do nothing;
