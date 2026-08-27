#!/bin/bash
# Canva compose runner poller — the "Canva-bot" from HANDOFF §22.7.
# Cheap Supabase check every launchd tick; only spawns the Claude runner
# (canva-compose-runner skill) when a post is actually queued.
# Install: scripts/canva-runner/install.sh
set -u
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/Library/Application Support/HWC/canva-runner.log"
LOCK="$HOME/.hwc-canva-runner.lock"
# launchd agents cannot read ~/Documents (macOS TCC) — creds live in the
# runner's own config dir instead. install.sh keeps this file in place.
ENVF="$HOME/Library/Application Support/HWC/canva-runner/env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

URL=$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$ENVF" | cut -d= -f2- | tr -d '"')
KEY=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' "$ENVF" | cut -d= -f2- | tr -d '"')
if [ -z "$URL" ] || [ -z "$KEY" ]; then log "no supabase creds"; exit 1; fi

# ── Heartbeat ───────────────────────────────────────────────────────────
# Stamps poller_ts on every queued row, every tick. The UI reads it: a
# poller_ts that stopped advancing means the launchd agent is GONE, which is
# a different problem from "the runner is busy" and needs a different fix, so
# the queued post says so instead of counting elapsed minutes at a robot that
# is not there.
#
# Why this exists: on 2026-08-24 the agent was bootstrapped into a Claude
# session's domain (the old `launchctl load` in install.sh) and died with that
# session at 14:06. Every "paused, here's why" notice this script can send is
# sent FROM A TICK — no ticks, no notice, so the queue sat silent for two days
# (Igor 2026-08-26). A heartbeat is the one signal whose absence is itself the
# message.
#
# Runs BEFORE the early exits on purpose: a tick that bails — quota cooldown,
# pre-flight skip, empty queue — is still a live poller and must say so.
# It cannot cover a compose in flight by itself: launchd does not tick while
# this script is busy — see the background loop around the claude call below.
TICK="$HOME/Library/Application Support/HWC/canva-runner/last-tick"
heartbeat() {
  local NOW; NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  date +%s > "$TICK"
  # Queued rows AND claimed rows that have not reported a stage yet: after the
  # claim the runner's session boots for 2–10 min before its first write, and
  # a poller_ts frozen at claim time made /visual cry "not ticking" at a
  # runner that was working (Igor 2026-08-26, twice in one afternoon).
  curl -s --max-time 20 "$URL/rest/v1/slide_sets?select=id,compose_progress&status=in.(ready_for_canva,in_canva)" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" 2>/dev/null \
    | python3 -c '
import sys, json
now = sys.argv[1]
try:
    rows = json.load(sys.stdin)
except Exception:
    rows = []
if not isinstance(rows, list):
    rows = []
for r in rows:
    cp = r.get("compose_progress") or {}
    # Only the queued baseline is ours to touch — never stomp a live stage,
    # a blocked notice or a recorded error.
    if cp.get("stage") not in (None, "", "queued"):
        continue
    payload = {"stage": "queued", "ts": cp.get("ts") or now, "poller_ts": now}
    # Compare-and-set guard for the PATCH: the runner may write its first
    # stage between this read and our write, and a heartbeat must never
    # revert `load:start` (+ edit_url) back to `queued`. The filter makes
    # the PATCH a no-op unless the row is still at the baseline.
    guard = "compose_progress->>stage=eq.queued" if cp.get("stage") == "queued" else "compose_progress->>stage=is.null"
    print(r["id"] + " " + guard + " " + json.dumps(payload, separators=(",", ":")))
' "$NOW" 2>/dev/null | while read -r RID GUARD CP; do
    [ -z "$RID" ] && continue
    curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?id=eq.$RID&$GUARD" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d "{\"compose_progress\":$CP}" >/dev/null
  done
}
heartbeat

# single instance
if ! /usr/bin/shlock -f "$LOCK" -p $$; then
  exit 0
fi
HB_PID=""
trap 'rm -f "$LOCK"; [ -n "$HB_PID" ] && kill "$HB_PID" 2>/dev/null' EXIT

# Where the app lives + the secret that authenticates this machine into its
# internal endpoints (same var the arsenal skill uses). Missing secret → the
# push below is skipped, everything else still works.
APP_URL=$(grep -m1 '^APP_URL=' "$ENVF" | cut -d= -f2- | tr -d '"')
[ -z "$APP_URL" ] && APP_URL="https://content-machine-gules.vercel.app"
CM_SECRET=$(grep -m1 '^CONTENT_MACHINE_SECRET=' "$ENVF" | cut -d= -f2- | tr -d '"')
# Remembers the last reason we pushed, so a 2-min poll doesn't become a
# 2-min notification loop. Cleared the moment the queue starts moving again.
NOTIFIED="$HOME/Library/Application Support/HWC/canva-runner/blocked-notified"

jsonstr() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }

# Mark every queued row with a "paused, here's why" notice so /visual shows the
# real reason instead of an eternal "Queued" chip. Same shape the Replicate
# 402 branch below writes; the UI renders compose_progress.stage == 'blocked'.
#
# ...and push it to Igor's phone. The banner alone was a channel nobody
# watched: on 2026-08-24 the Canva token expired mid-compose and the queue sat
# parked for an hour because the only signal was a page you had to open
# (HANDOFF §22.7). Push fires once per distinct reason, never on repeat ticks.
mark_blocked() {
  curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?status=eq.ready_for_canva" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"compose_progress\":{\"stage\":\"blocked\",\"error\":$(jsonstr "$1"),\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" >/dev/null

  if [ -n "$CM_SECRET" ] && [ "$(cat "$NOTIFIED" 2>/dev/null)" != "$1" ]; then
    if curl -s --max-time 20 -o /dev/null -w '%{http_code}' -X POST "$APP_URL/api/canva/blocked" \
      -H "x-internal-dispatch-secret: $CM_SECRET" -H "Content-Type: application/json" \
      -d "{\"reason\":$(jsonstr "$1")}" | grep -q '^200$'; then
      printf '%s' "$1" > "$NOTIFIED"
      log "pushed block notice: $1"
    fi
  fi
}

# Queue is moving again → forget the last pushed reason, so the NEXT block
# (even an identical one) notifies instead of being deduped into silence.
clear_blocked_notice() { rm -f "$NOTIFIED"; }

# ── Claude quota cooldown (Igor 2026-08-12) ─────────────────────────────
# The runner spawns `claude -p` on the SAME subscription account Igor uses
# interactively. When that account hits its session limit, every 2-min tick
# used to spawn a process that died on the first token — 130 doomed spawns
# in one day, while the post sat in "Queued" forever. Park the queue until
# the reset instead, and say so on the row.
COOLDOWN="$HOME/Library/Application Support/HWC/canva-runner/quota-cooldown"
if [ -f "$COOLDOWN" ]; then
  CD_UNTIL=$(cut -d'|' -f1 "$COOLDOWN" 2>/dev/null)
  CD_HUMAN=$(cut -d'|' -f2- "$COOLDOWN" 2>/dev/null)
  if [ -n "$CD_UNTIL" ] && [ "$(date +%s)" -lt "$CD_UNTIL" ]; then
    # Re-stamp: a post queued AFTER the limit was hit has no notice yet.
    mark_blocked "Claude quota for the compose runner is used up — composing resumes automatically at $CD_HUMAN"
    exit 0
  fi
  rm -f "$COOLDOWN"
  clear_blocked_notice
  log "quota cooldown expired — resuming"
  curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?status=eq.ready_for_canva&compose_progress->>stage=eq.blocked" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d '{"compose_progress":null}' >/dev/null
fi

# Pexels stock-photo key — exported so the compose-runner skill's Bash shell
# sees $PEXELS_API_KEY directly (source:"stock" slides). Empty → skill falls back to Flux.
export PEXELS_API_KEY=$(grep -m1 '^PEXELS_API_KEY=' "$ENVF" | cut -d= -f2- | tr -d '"')

# Anthropic API key — the difference between "autonomous" and "waits for Igor".
# Without it `claude -p` bills the CLI's logged-in SUBSCRIPTION, so the runner
# competes with Igor's own sessions and starves whenever he's working (that is
# the 130-doomed-spawns incident of 2026-08-12). With it, every compose bills
# Anthropic credits on its own meter: no session limits, no queue parking, and
# Content Machine composes around the clock without anyone at the keyboard.
# Put the key in this env file as ANTHROPIC_API_KEY=... — it is picked up here.
RUNNER_ANTHROPIC_KEY=$(grep -m1 '^ANTHROPIC_API_KEY=' "$ENVF" | cut -d= -f2- | tr -d '"')
if [ -n "$RUNNER_ANTHROPIC_KEY" ]; then
  export ANTHROPIC_API_KEY="$RUNNER_ANTHROPIC_KEY"
fi

# watchdog: a row stuck in in_canva with stale progress (>20 min) means a
# previous runner died mid-run (network drop / crash) — requeue it so the
# next tick retries instead of hanging forever.
curl -s --max-time 20 "$URL/rest/v1/slide_sets?select=id,compose_progress&status=eq.in_canva" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "
import sys, json, datetime
rows = json.load(sys.stdin)
now = datetime.datetime.now(datetime.timezone.utc)
for r in rows:
    ts = ((r.get('compose_progress') or {}).get('ts') or '')
    stale = True
    try:
        t = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
        stale = (now - t).total_seconds() > 1200
    except Exception:
        pass
    if stale:
        print(r['id'])
" 2>/dev/null | while read -r RID; do
  [ -z "$RID" ] && continue
  log "watchdog: requeueing stale in_canva row $RID"
  curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?id=eq.$RID&status=eq.in_canva" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d '{"status":"ready_for_canva","compose_progress":null}' >/dev/null
done

# cheap queue check — no Claude spawn unless there's work
COUNT=$(curl -s --max-time 20 "$URL/rest/v1/slide_sets?select=id&status=eq.ready_for_canva&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$COUNT" != "1" ]; then exit 0; fi

# pre-flight: the Canva connector is fetched from claude.ai at session
# start; on a flaky network (esp. first tick after wake) it can be
# absent, and a runner without Canva tools can only fail. Skip the
# tick and retry in 2 min instead of burning a doomed session.
# Two spellings, one connector. "claude.ai Canva" is the claude.ai-managed
# connector; "claude_ai_Canva" is the same Canva MCP registered directly in the
# CLI's user config (Igor 2026-08-12 — the managed one stopped being offered to
# this account, and `claude mcp add` rejects dots and spaces in a name). Both
# expose tools as mcp__claude_ai_Canva__*, which is what the runner allows.
if ! claude mcp list 2>/dev/null | grep -E "claude\.ai Canva|claude_ai_Canva" | grep -q "Connected"; then
  log "pre-flight: Canva MCP not connected — skipping tick"
  # Say it on the row too. A lapsed Canva token used to be INVISIBLE: the tick
  # skipped, the log line scrolled past, and the post sat in "Queued" for days
  # with nobody knowing why (Igor 2026-08-12). One re-login fixes it — but only
  # if you can see that it's needed.
  mark_blocked "Canva connection for the compose runner has lapsed — run 'claude mcp login claude_ai_Canva' in a terminal (or /mcp → claude.ai Canva in an interactive session), then composing resumes on its own"
  exit 0
fi

# pre-flight: Replicate credit. Composes need Flux photos; with an empty
# wallet every run dies on 402 (free probe — Replicate rejects before
# charging). Skip the tick until Igor tops up the balance.
RTOKEN=$(grep -m1 '^REPLICATE_API_TOKEN=' "$ENVF" | cut -d= -f2- | tr -d '"')
if [ -n "$RTOKEN" ]; then
  RCODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -X POST \
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions" \
    -H "Authorization: Bearer $RTOKEN" -H "Content-Type: application/json" \
    -d '{"input":{"prompt":"probe","aspect_ratio":"1:1"}}')
  if [ "$RCODE" = "402" ]; then
    log "pre-flight: Replicate credit exhausted (402) — skipping tick until top-up"
    # Surface the reason on every queued row so /visual can explain the
    # stall instead of showing an eternal "Queued" chip.
    curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?status=eq.ready_for_canva" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d "{\"compose_progress\":{\"stage\":\"blocked\",\"error\":\"Replicate credit exhausted — top up at replicate.com/account/billing, composing resumes automatically\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" >/dev/null
    exit 0
  fi
  # Credit is back — clear stale blocked notices so the queue chip
  # returns to its normal countdown.
  clear_blocked_notice
  curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?status=eq.ready_for_canva&compose_progress->>stage=eq.blocked" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d '{"compose_progress":null}' >/dev/null
fi

clear_blocked_notice
log "queue non-empty — starting compose runner"
cd "$HOME/Library/Application Support/HWC/canva-runner"
OUTF=$(mktemp "${TMPDIR:-/tmp}/canva-runner.XXXXXX")
# caffeinate wraps the whole compose: a laptop that sleeps mid-run kills the
# session with "Your computer went to sleep mid-response" and the row is
# stranded in in_canva until the 20-min watchdog requeues it — then the WHOLE
# ~25-min, ~$18 compose runs again from scratch, leaving the finished design
# orphaned in Canva (Igor 2026-08-13: it died on the final write-back, one
# step from done). -i no idle sleep, -m no disk sleep, -s no system sleep on
# AC. Assertions are held only while claude runs and drop the moment it exits.
# ── Context diet (measured 2026-08-19) ──────────────────────────────────
# Every turn of a compose re-reads the whole session preamble, and a measured
# compose ran 184 turns. Three things were timed against each other with a
# one-token `claude -p` probe from this same directory:
#   as-is                                 49 471 tokens
#   --allowedTools narrowed to 6 tools    49 475  ← allowedTools is a PERMISSION
#                                                   list, it changes nothing here
#   without the installed-skills listing  42 8xx  ← 6.7k of OTHER skills'
#                                                   descriptions, every turn
# So: disable the skill mechanism and hand the runner its own instructions as a
# system prompt instead. install.sh puts SKILL.md next to this script; if it is
# missing (older install) fall back to the skill invocation so a compose still
# runs rather than failing on a missing file.
SKILLF="$HOME/Library/Application Support/HWC/canva-runner/SKILL.md"
if [ -f "$SKILLF" ]; then
  PROMPT="Process ONE queued post from the Content Machine canva queue now. Follow your system instructions exactly."
  set -- --disable-slash-commands --append-system-prompt-file "$SKILLF"
else
  PROMPT="Use the canva-compose-runner skill: process ONE queued post from the Content Machine canva queue now. Follow the skill exactly."
  set --
fi

# ── Heartbeat DURING the compose ────────────────────────────────────────
# launchd never overlaps instances of one job: while this script is busy
# composing (~25 min) no tick fires at all, so the heartbeat at the top went
# silent for the whole build and /visual declared the poller dead ~6 min into
# EVERY compose — on the post being built (until its first stage landed) and
# on every post queued behind it, for the full 25 min (Igor 2026-08-26). The
# single-instance lock above is unreachable under launchd for the same reason;
# it only guards manual runs. So the heartbeat keeps beating from a background
# loop for exactly as long as the runner is alive. It touches only rows still
# at the queued baseline — including the claimed one until its first stage
# lands — and never a row with a live stage (CAS guard in heartbeat()).
( while :; do sleep 60; heartbeat; done ) &
HB_PID=$!

caffeinate -ims claude -p "$PROMPT" \
  --model sonnet \
  --allowedTools "mcp__claude_ai_Canva__*,Bash,Read,Write,Skill,ToolSearch" \
  "$@" \
  --output-format text > "$OUTF" 2>&1
RC=$?
kill "$HB_PID" 2>/dev/null; HB_PID=""
cat "$OUTF" >> "$LOG"
log "runner finished (exit $RC)"

# Quota wall: the CLI prints "You've hit your session limit · resets 6:10pm
# (Pacific/Honolulu)" and exits immediately. Park the queue until that time
# rather than respawning into the same wall every 2 minutes.
if grep -qi "hit your session limit" "$OUTF"; then
  read -r CD_UNTIL CD_HUMAN <<<"$(python3 - "$OUTF" <<'PY'
import re, sys, datetime
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None
txt = open(sys.argv[1], errors='ignore').read()
now = datetime.datetime.now().astimezone()
until = None
m = re.search(r"resets\s+(\d{1,2}):(\d{2})\s*(am|pm)\s*(?:\(([^)]+)\))?", txt, re.I)
if m:
    h, mi, ap, tzname = int(m.group(1)), int(m.group(2)), m.group(3).lower(), m.group(4)
    h = h % 12 + (12 if ap == 'pm' else 0)
    tz = now.tzinfo
    if tzname and ZoneInfo:
        try:
            tz = ZoneInfo(tzname.strip())
        except Exception:
            pass
    ref = now.astimezone(tz)
    until = ref.replace(hour=h, minute=mi, second=0, microsecond=0)
    if until <= ref:
        until += datetime.timedelta(days=1)
else:
    m = re.search(r"resets in\s+(\d+)\s*h", txt, re.I)
    until = now + datetime.timedelta(hours=int(m.group(1)) if m else 1)
# +90s of slack: resetting exactly on the boundary can still be refused.
until += datetime.timedelta(seconds=90)
print(int(until.timestamp()), until.astimezone().strftime('%H:%M'))
PY
)"
  if [ -n "${CD_UNTIL:-}" ]; then
    printf '%s|%s' "$CD_UNTIL" "$CD_HUMAN" > "$COOLDOWN"
    log "session limit hit — parking queue until $CD_HUMAN (local)"
    mark_blocked "Claude quota for the compose runner is used up — composing resumes automatically at $CD_HUMAN"
  fi
fi
rm -f "$OUTF"
