# launchd never overlaps a StartInterval job — a heartbeat written by the tick dies with the first long tick

**Date:** 2026-08-26 · **Project:** Content machine · **Module:** canva-runner (scripts/canva-runner/run.sh)

## What happened
The poller stamps `compose_progress.poller_ts` on every queued row each 2-min tick so /visual can tell
"runner is gone" from "runner is busy". The comment assumed ticks keep firing during a compose and hit
the single-instance `shlock`. They don't: **launchd does not start a second instance of the same label
while the previous one is still running.** A compose holds `run.sh` for ~25 min → zero ticks → heartbeat
frozen → UI declared the runner dead ~6 min into every build. Visible today because a loaded 8 GB Mac
(12 idle Claude Code processes + the runner) took 10 min to write the first stage; with two posts queued
it reproduces on any machine (the second post is red for the full 25 min).

## Fix
- `run.sh`: background loop `( while :; do sleep 60; heartbeat; done ) &` for exactly as long as
  `claude -p` runs; killed on exit and from the EXIT trap. Touches only `ready_for_canva` rows at the
  queued baseline, never the in-flight row.
- UI (`ComposeWaitingChip`): a claimed row (`status=in_canva`, no stage yet) never gets the heartbeat
  verdict — it says "claimed, session booting" and after 20 min "most likely died, watchdog requeues".
- SKILL.md: `ts` must be `$(date -u …)` — the model typed `22:23:00Z` three minutes before its own
  process started, which skews the 20-min watchdog and the per-step counter.

## Rules extracted
1. Anything "the tick proves liveness" must account for ticks not happening while the job is busy —
   under launchd the busy job IS the only instance. Heartbeat from inside the long-running work.
2. Deploy a running bash script with `cp → tmp && mv` (atomic rename): the running process keeps the
   old inode; no `launchctl bootout` needed, so an in-flight compose survives.
3. Never let a model author a timestamp. `$(date -u +%Y-%m-%dT%H:%M:%SZ)` in the curl body.
4. `claude mcp list` as a pre-flight costs ~5 min on this Mac → the effective tick is 5–8 min, not 2.
   Not fixed yet.
