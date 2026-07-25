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

# single instance
if ! /usr/bin/shlock -f "$LOCK" -p $$; then
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT

URL=$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$ENVF" | cut -d= -f2- | tr -d '"')
KEY=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' "$ENVF" | cut -d= -f2- | tr -d '"')
if [ -z "$URL" ] || [ -z "$KEY" ]; then log "no supabase creds"; exit 1; fi

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
if ! claude mcp list 2>/dev/null | grep -F "claude.ai Canva" | grep -q "Connected"; then
  log "pre-flight: Canva MCP not connected — skipping tick"
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
  curl -s --max-time 20 -X PATCH "$URL/rest/v1/slide_sets?status=eq.ready_for_canva&compose_progress->>stage=eq.blocked" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d '{"compose_progress":null}' >/dev/null
fi

log "queue non-empty — starting compose runner"
cd "$HOME/Library/Application Support/HWC/canva-runner"
claude -p "Use the canva-compose-runner skill: process ONE queued post from the Content Machine canva queue now. Follow the skill exactly." \
  --model sonnet \
  --allowedTools "mcp__claude_ai_Canva__*,Bash,Read,Write,Skill,ToolSearch" \
  --output-format text >> "$LOG" 2>&1
log "runner finished (exit $?)"
