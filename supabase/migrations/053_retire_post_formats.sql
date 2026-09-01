-- Retire four post formats (Igor 2026-08-31). Catalog: lib/posts/formats.ts.
--
-- "System critique" + "Expert secrets" ran on "mainstream care / other doctors
-- are wrong", which POST-CRAFT §1 forbids. "Medicine philosophy" made the
-- doctor the hero of the topic, against the planner's binding topic rule.
-- "Diagnostic deep-dive" duplicated "Educational explainer", which now carries
-- its symptom-entry door.
--
-- Dropping them from the TS catalog is not enough on its own:
--   1. `ensureDefaultScriptTemplates` only ever INSERTs, so every clinic still
--      holds active `script_templates` rows for the retired names, and the
--      Writer's ad-hoc path reads those rows straight out of the table.
--   2. Plan topics already pinned to a retired format would resolve to no
--      catalog entry at generation time.
-- Deactivate, don't delete: a clinic that edited one of these scaffolds keeps
-- its row, and nothing that already shipped loses its provenance.

update public.script_templates
   set active = false
 where active
   and name in (
     'System critique',
     'Diagnostic deep-dive',
     'Expert secrets',
     'Medicine philosophy'
   );

-- Remap only PENDING topics. A 'done' / 'skipped' row records how a post that
-- already exists was actually written — rewriting it would falsify history.
update public.content_plan_topics
   set format = 'Myth-busting'
 where status = 'pending' and format = 'System critique';

update public.content_plan_topics
   set format = 'Educational explainer'
 where status = 'pending' and format in ('Diagnostic deep-dive', 'Medicine philosophy');

update public.content_plan_topics
   set format = 'Practical tips'
 where status = 'pending' and format = 'Expert secrets';
