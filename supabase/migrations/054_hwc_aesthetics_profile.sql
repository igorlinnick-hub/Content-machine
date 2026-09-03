-- ============================================================
-- Content Machine — Migration 054
-- Hawaii Wellness Clinic: the aesthetics line joins the profile.
--
-- 043 wrote HWC's profile off the regenerative side of the practice —
-- four pillars, sixteen services, all joints / mental health / weight.
-- The clinic also runs hawaiiwellnessclinic.com/aesthetics, and none of
-- it reached the machine, so:
--   • the planner never wrote an aesthetics topic (topics are grounded in
--     pillars and services);
--   • "Treatment explainer" — the one format that lands on a service the
--     clinic sells — could not land on Botox or microneedling, because it
--     picks from clinics.services and they were not there;
--   • the twelve aesthetic ManyChat keywords added in lib/seeds/
--     cta-keywords.ts had no post to print on.
--
-- Six services, read off the clinic's own page (2026-09-03). Idempotent:
-- each value is appended only if the row does not already carry it, so a
-- second run is a no-op and nothing already in the profile is disturbed.
-- Run in Supabase SQL Editor after 053.
-- ============================================================

-- 1. The fifth pillar.
update public.clinics
   set content_pillars = content_pillars || array['Aesthetics']
 where id = '5065c6ee-7c4b-451b-8dee-3498eb3af674'
   and not ('Aesthetics' = any(content_pillars));

-- 2. The services themselves, named the way the clinic names them.
with incoming(name) as (
  values
    ('Botox'),
    ('Microneedling'),
    ('Lip Filler'),
    ('Sculptra'),
    ('Stem Cell Aesthetics'),
    ('Peptide-Supported Aesthetic Wellness')
)
update public.clinics c
   set services = c.services || coalesce(
         (select array_agg(i.name order by i.name)
            from incoming i
           where not (i.name = any(c.services))),
         '{}'::text[]
       )
 where c.id = '5065c6ee-7c4b-451b-8dee-3498eb3af674';

-- 3. Deep-dive topics — what the Writer is allowed to go mechanism-deep on.
--    Phrased as mechanisms, not as menu items, so the planner builds topics
--    that teach rather than topics that advertise.
with incoming(topic) as (
  values
    ('Botulinum toxin and the nerve-to-muscle signal behind expression lines'),
    ('Microneedling: controlled micro-injury and the collagen response'),
    ('Hyaluronic acid lip filler — volume, water binding, and how it resorbs'),
    ('Sculptra (poly-L-lactic acid) as a collagen stimulator rather than a filler'),
    ('Stem cell and exosome aesthetics for skin quality and renewal'),
    ('Peptides in aesthetic medicine: skin repair, recovery, healthy aging')
)
update public.clinics c
   set deep_dive_topics = c.deep_dive_topics || coalesce(
         (select array_agg(i.topic order by i.topic)
            from incoming i
           where not (i.topic = any(c.deep_dive_topics))),
         '{}'::text[]
       )
 where c.id = '5065c6ee-7c4b-451b-8dee-3498eb3af674';
