-- Caption style preset for the clips pipeline (HANDOFF §22.2 п.10).
-- Key into CAPTION_STYLES in lib/clips/captionStyles.ts; picked by
-- the team in the /clips video editor tab, applied to every clip
-- processed for the clinic.
alter table clinics
  add column if not exists caption_style text not null default 'classic';
