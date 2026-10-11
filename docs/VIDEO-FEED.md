# Video feed — TikTok + Instagram Reels through Buffer

For whoever produces videos ahead of time (the My Bots video pipeline, a cron
agent, a person). You hand over finished files; Content Machine does the rest.

## The deal

```
My Bots: "передай в content machine"  (skill cm-video-handoff, ~/.claude/skills/)
   │  writes <name>.caption.txt per video, copies both into inbox/hiredrop/
   ▼
node scripts/feed-video.mjs drop inbox/hiredrop --brand hiredrop
   │  upload → hiredrop-posts/videos/ ; date = every other day after the last video, 16:00 UTC
   ├──► buffer_feed  (tiktok)    ── /api/cron/buffer-feed daily 16:30 UTC ──► Buffer ──► TikTok
   └──► meta_posts   (instagram) ── /api/cron/meta-publish every 5 min ─────► Meta API ──► Reel
```

- **TikTok goes through Buffer** — the free plan holds 10 scheduled posts per
  channel at a time. That caps the queue, not the total: each post that goes out
  frees a slot and the feeder refills it the same day.
- **Instagram goes straight to Meta** (system-user token, no Buffer). Meta
  processes a Reel for about a minute (measured 55 s for a 10 s clip); the
  publisher saves the container and finishes on a later tick, up to 60 min.
- Dates: `drop` puts each video `--every` (default 2) days after the latest video
  already queued, at `--hour` (16) UTC, and moves it a day when Instagram already
  has a post that day (carousels), so the grid gets one post a day.

## Queue videos

```bash
cd ~/Code/Content-machine

# the normal way: folder of NN-slug.mp4 + NN-slug.caption.txt (+ optional NN-slug.jpg cover)
node scripts/feed-video.mjs drop inbox/hiredrop --brand hiredrop [--dry] [--every 2] [--channels tiktok]
node scripts/feed-video.mjs list --brand hiredrop     # both queues: date, status, permalink, errors

# explicit dates instead
node scripts/feed-video.mjs add --brand hiredrop --video day01.mp4 --caption @day01.txt --at 2026-11-01T16:00:00Z
node scripts/feed-video.mjs plan november.json        # [{ video, caption, at, channels?, cover?, source? }]
```

- A video without its caption file waits in the inbox; queued files move to `inbox/hiredrop/queued/`.
- The base file name is the id `video:<name>`;
  the same name is never queued twice, so keep names unique across months.
- Channels default to `tiktok,instagram`.

## What the file must be

| | Rule | Why |
|---|---|---|
| Shape | 1080×1920, 9:16, H.264 mp4 | script warns otherwise |
| Length | ≥ 3 s | TikTok rejects shorter |
| **Audio** | **bake the music in** | trending sounds can't be added through the API — whatever audio is in the file is what posts. The HireDrop reels so far were cut silent "for trending audio in-app" — that doesn't work on autopilot. Use royalty-free / TikTok-commercial-safe tracks. |
| Caption | English passes `scripts/slop-check.mjs`; HireDrop format and facts — see the skill `cm-video-handoff` | checked automatically; `--force` overrides |
| AI label | leave off (default). HireDrop videos = Igor's own b-roll + AI-made subtitles — not AI video (Igor 2026-10-09). `"ai": true` only if a clip ever uses generated footage (Seedance, avatars) | TikTok's label is for realistic AI imagery/voice, not for captions |
| Cover | optional jpg/png | otherwise the platform picks a frame |

## Status (2026-10-11)

- TikTok: Buffer accepted a video draft built exactly like the feeder builds it
  (video fetched, 10 s 1080×1920 read back); draft deleted.
- Instagram: Meta created a REELS container from the same file and reached
  FINISHED in 55 s; never published (expires by itself).
- **No video has been published live yet** — the first real one is the test.
  Check with `list` after its time.
- A Claude session may be stopped from writing `buffer_feed` / `meta_posts` by the
  safety classifier; then Igor runs the `drop` command with `!`.
- A launchd watcher on the inbox was considered and not installed (Claude may not
  add login agents). The skill runs `drop` itself, so it isn't needed.
