# Caption style presets + teleprompter Auto-edit wire

**Date:** 2026-07-02
**Track:** 1 (clinic), пп.10-11 of HANDOFF §22.2

## Pattern 1: style presets as pure-data registry

`lib/clips/captionStyles.ts` — one file, pure data (no node deps), imported by
BOTH the server pipeline (ffmpeg libass `force_style`) and the client picker
(CSS preview approximations). Adding a preset = one array entry; the picker,
the API validation, and the pipeline all pick it up automatically.

Fail-open on the DB side: `getClinicCaptionStyle` returns null on ANY error
(including a not-yet-applied migration) → pipeline falls back to the classic
preset. Deploy-before-migrate is safe; output never changes under our feet.

## Pattern 2: bridging two Drive worlds with a copy, not a move

Teleprompter recordings live in `Recordings/{clinic}` (doctor's archive);
the clips pipeline watches `Inbox/`. Auto-edit **copies** the file into Inbox
(`copyFileToInbox`) instead of moving it — the archive stays intact, and the
copy walks the standard pipeline unchanged (zero special-casing in
`processClip`).

Self-healing trigger: the route processes synchronously (maxDuration 300),
but because the copy lands in Inbox *first*, a dropped connection just means
the 30-min cron sweeps it up. The button is an accelerator, not a
single-point-of-failure.

## Gotcha

`upsertPendingClip` dedups on (clinic_id, drive_inbox_file_id) — the copy has
a NEW file id, so re-tapping Auto-edit after a failure creates a second copy
+ second clip row. Acceptable for v1 (failed clips need manual retry anyway),
but a "re-run existing clip" tool should reuse the Inbox file id.
