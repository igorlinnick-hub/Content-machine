-- ============================================================
-- Content Machine — Migration 056
-- The objection map, stored: one row per question a patient asks.
--
-- The `Patient question` format (lib/posts/formats.ts) answers ONE
-- question per script. Until now a question could only reach the Writer
-- as free text in a topic hint, which means the answer lands in the
-- library as prose and nothing can be looked up later. What the clinic
-- is actually sold is findability — a coordinator pulling "question 23"
-- into a DM the week it gets asked — and that needs the question to be
-- a row, not a sentence inside a script.
--
-- Method behind the shape (Yedino, docs/objection-maps/METHOD.md):
--   • five groups that repeat from clinic to clinic — see the check
--     constraint below. Clinics answer group 1 well and almost never
--     answer 3, 4 and 5, which are the groups that decide whether the
--     patient pays;
--   • THREE findability states, not two. "Answered somewhere in the feed"
--     is not answered: a reel lives three days, the question is asked
--     every week. The middle state is the most common one and the one
--     the product fixes.
--
-- The question NUMBER is internal — it orders the library and never
-- appears in a script or on a cover.
--
-- Idempotent. Run in Supabase SQL Editor after 055.
-- ============================================================

create table if not exists public.clinic_objections (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,

  -- Position in this clinic's map. Internal ordering only.
  number       smallint not null,

  -- 1 Do I even have this · 2 Can it be fixed · 3 Is it safe
  -- 4 What does it cost and how long · 5 Why you and not someone else
  group_no     smallint not null check (group_no between 1 and 5),

  -- The question in the patient's own words — this string is the hook of
  -- the script, so it is stored the way a patient says it, never the
  -- clinical paraphrase.
  question     text not null,

  -- Findability, not "have we ever said it".
  state        text not null default 'unanswered'
               check (state in ('unanswered', 'answered_unfindable', 'findable')),

  -- Free-form: where the existing answer lives, why it is hard to find,
  -- what the reviews say about it.
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (clinic_id, number)
);

create index if not exists clinic_objections_clinic_group_idx
  on public.clinic_objections (clinic_id, group_no, number);

-- Which question a script answers. Null for every script that is not a
-- Patient question — the column is the library index, not a requirement.
-- on delete set null: retiring a question must never delete the script
-- that answered it.
alter table public.scripts
  add column if not exists objection_id uuid
  references public.clinic_objections(id) on delete set null;

create index if not exists scripts_objection_idx
  on public.scripts (objection_id)
  where objection_id is not null;

-- Answered = a script exists for that question. The planner reads this
-- to pick the next unanswered question instead of inventing a topic,
-- which is what makes a shooting day "twenty answers in a row".
comment on column public.scripts.objection_id is
  'clinic_objections.id this script answers — the library index for the Patient question format';

notify pgrst, 'reload schema';
