-- Per-clinic Drive workspace (HANDOFF §22.2 п.7). Provisioned
-- automatically on clinic creation:
--   {GOOGLE_DRIVE_CLINICS_ROOT_ID}/{Clinic — Doctor}/Inbox|Originals|Finals
-- NULL columns = legacy global env folders (HWC keeps working as-is
-- until provisioned).
alter table clinics
  add column if not exists drive_root_folder_id text,
  add column if not exists drive_inbox_folder_id text,
  add column if not exists drive_originals_folder_id text,
  add column if not exists drive_finals_folder_id text;
