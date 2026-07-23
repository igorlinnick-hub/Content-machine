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

# cheap queue check — no Claude spawn unless there's work
COUNT=$(curl -s --max-time 20 "$URL/rest/v1/slide_sets?select=id&status=eq.ready_for_canva&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$COUNT" != "1" ]; then exit 0; fi

log "queue non-empty — starting compose runner"
cd "$HOME/Library/Application Support/HWC/canva-runner"
claude -p "Use the canva-compose-runner skill: process ONE queued post from the Content Machine canva queue now. Follow the skill exactly." \
  --model sonnet \
  --allowedTools "mcp__claude_ai_Canva__*,Bash,Read,Write,Skill,ToolSearch" \
  --output-format text >> "$LOG" 2>&1
log "runner finished (exit $?)"
