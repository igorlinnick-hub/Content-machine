#!/bin/bash
# One-shot install of the Canva compose runner (poller + launchd agent).
# Run manually: bash scripts/canva-runner/install.sh
#   --check   report health instead of installing (nothing is touched)
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/HWC/canva-runner"
LABEL="com.hwc.canva-runner"
DOMAIN="gui/$(id -u)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOCK="$HOME/.hwc-canva-runner.lock"
TICK="$DEST/last-tick"

# ── health report ───────────────────────────────────────────────────────
# One command that answers "why is the queue not moving?" — the question that
# cost two days on 2026-08-24 (see the bootstrap comment below).
if [ "${1:-}" = "--check" ]; then
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    echo "agent:     loaded in $DOMAIN"
  else
    echo "agent:     NOT LOADED — the queue cannot move. Fix:"
    echo "           launchctl bootstrap $DOMAIN $PLIST"
  fi
  if [ -f "$TICK" ]; then
    AGE=$(( $(date +%s) - $(cat "$TICK" 2>/dev/null || echo 0) ))
    echo "last tick: ${AGE}s ago (healthy < 180s)"
  else
    echo "last tick: never"
  fi
  if [ -f "$LOCK" ]; then echo "lock:      held — a compose is in flight"; else echo "lock:      free"; fi
  if claude mcp list 2>/dev/null | grep -E "claude\.ai Canva|claude_ai_Canva" | grep -q "Connected"; then
    echo "canva mcp: connected"
  else
    echo "canva mcp: NOT connected — claude mcp login claude_ai_Canva"
  fi
  exit 0
fi

# Never bootout an agent that is mid-compose: bootout kills the whole process
# tree, and a killed compose leaves a half-built design in Canva plus a row
# stranded in in_canva until the 20-min watchdog requeues it (~25 min and ~$18
# thrown away).
if [ -f "$LOCK" ] && [ "${1:-}" != "--force" ]; then
  echo "ERROR: a compose is running (lock: $LOCK). Wait for it, or re-run with --force." >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$SRC/run.sh" "$DEST/run.sh"
chmod +x "$DEST/run.sh"
# The photo fetcher — one process instead of one model turn per image.
cp "$SRC/photos.py" "$DEST/photos.py"
chmod +x "$DEST/photos.py"
# run.sh feeds SKILL.md to the runner as a system prompt (skills are disabled
# in that session — their listing costs 6.7k tokens on every one of ~180 turns).
# The skill's source of truth lives in ~/.claude/skills, not in this repo.
SKILL="$HOME/.claude/skills/canva-compose-runner/SKILL.md"
if [ -f "$SKILL" ]; then
  cp "$SKILL" "$DEST/SKILL.md"
  echo "copied SKILL.md → $DEST/SKILL.md"
else
  echo "WARN: $SKILL not found — run.sh will fall back to invoking the skill by name"
fi
# Copy the craft bible into the runner's config dir so the headless runner can
# Read it (the repo under ~/Documents is TCC-blocked for launchd). SRC is
# scripts/canva-runner, so the repo doc is two dirs up under docs/.
CRAFT="$(cd "$SRC/../.." && pwd)/docs/POST-CRAFT.md"
if [ -f "$CRAFT" ]; then
  cp "$CRAFT" "$DEST/POST-CRAFT.md"
  echo "copied POST-CRAFT.md → $DEST/POST-CRAFT.md"
else
  echo "WARN: $CRAFT not found — runner will fall back to inline skill rules"
fi

cp "$SRC/$LABEL.plist" "$PLIST"

# ── launchd, in an EXPLICIT domain ──────────────────────────────────────
# `launchctl load` (the old call here) registers the job in whatever domain
# the CALLER happens to sit in. Installed from a Claude Code / VS Code shell,
# the agent lived in that session's domain and died with it: the poller went
# silent at 14:06 on 2026-08-24 and the queue sat untouched for two days —
# no ticks, so not one of the runner's own "paused, here's why" notices could
# fire either (Igor 2026-08-26). `bootstrap gui/<uid>` pins it to the login
# session, which is what survives; `enable` clears a persisted disable.
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl enable "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

# An install that did not take must fail loudly, not print "installed".
if ! launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  echo "ERROR: $LABEL is NOT loaded in $DOMAIN — the queue will not move." >&2
  exit 1
fi
echo "canva-runner installed in $DOMAIN — polls the queue every 2 min"
echo "health: bash $SRC/install.sh --check"
echo "log:    ~/Library/Application Support/HWC/canva-runner.log"
