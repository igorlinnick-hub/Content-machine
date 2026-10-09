# Video feed — TikTok + Instagram Reels through Buffer

For whoever produces videos ahead of time (the My Bots video pipeline, a cron
agent, a person). You hand over finished files; Content Machine does the rest.

## The deal

```
your pipeline ──► node scripts/feed-video.mjs ──► buffer_feed (Supabase)
                                                      │  daily 16:30 UTC
                                                      ▼
                                   /api/cron/buffer-feed ──► Buffer ──► TikTok / IG Reels
```

- Buffer free plan holds **10 scheduled posts per channel** at a time. That caps
  the queue, not the total: each post that goes out frees a slot and the feeder
  refills it the same day. Queue a month (or more) in `buffer_feed`; Buffer
  only ever sees the next 10.
- One video a day per channel is well inside that. Above ~10 a day the feeder
  must tick more often (one pg_cron line, Igor runs it).
- Order is kept per channel: a stuck TikTok row holds back later TikTok rows,
  never an Instagram carousel.

## Queue videos

```bash
cd ~/Code/Content-machine

# one video
node scripts/feed-video.mjs add --brand hiredrop --video out/day01.mp4 \
  --caption @out/day01.txt --at 2026-10-12T16:00:00Z --channels tiktok,instagram

# a month at once
node scripts/feed-video.mjs plan out/november.json
node scripts/feed-video.mjs list --brand hiredrop     # what's queued, status, errors
```

`november.json`:

```json
{
  "brand": "hiredrop",
  "items": [
    { "video": "day01.mp4", "caption": "…", "at": "2026-11-01T16:00:00Z",
      "channels": ["tiktok", "instagram"], "cover": "day01.jpg", "ai": false, "source": "nov-01" }
  ]
}
```

- `video` / `cover`: local path (relative to the json) or a public https URL.
  Local files are uploaded to the brand's public bucket (`hiredrop-posts/videos/`).
- `channels`: default `["tiktok"]`. Add `"instagram"` to post the same file as a Reel.
- `source`: stable id; default = file name. Re-running the same plan skips rows
  already queued, so a cron agent can run it repeatedly.
- `at`: ISO UTC. 16:00 UTC = 06:00 HST = noon ET (the HireDrop slot).
- `--dry`: validate everything, upload and write nothing.

## What the file must be

| | Rule | Why |
|---|---|---|
| Shape | 1080×1920, 9:16, H.264 mp4 | script warns otherwise |
| Length | ≥ 3 s | TikTok rejects shorter |
| **Audio** | **bake the music in** | trending sounds can't be added through the API — whatever audio is in the file is what posts. The HireDrop reels so far were cut silent "for trending audio in-app" — that doesn't work on autopilot. Use royalty-free / TikTok-commercial-safe tracks. |
| Caption | English passes `scripts/slop-check.mjs` | checked automatically; `--force` overrides |
| AI label | leave off (default). HireDrop videos = Igor's own b-roll + AI-made subtitles — not AI video (Igor 2026-10-09). `"ai": true` only if a clip ever uses generated footage (Seedance, avatars) | TikTok's label is for realistic AI imagery/voice, not for captions |
| Cover | optional jpg/png | otherwise the platform picks a frame |

## Status (2026-10-09)

- Buffer accepted a TikTok video draft and an Instagram Reel draft built exactly
  like the feeder builds them (video fetched, 10 s 1080×1920 read back, no error);
  drafts deleted. **No video has been published live yet** — the first real row is
  the test. Check it with `list` after its time; a failure lands in `last_error`
  and pushes admins after 3 tries.
- Writing to `buffer_feed` from a Claude session may be stopped by the safety
  classifier (it stopped `meta_posts` inserts before). Then Igor runs the command
  with `!`.
