-- Add full_name to clinics: the long-form display name shown to doctors / marketing team.
-- Existing rows default to the short name (name column) until admin fills it in via Edit profile.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS full_name TEXT;
