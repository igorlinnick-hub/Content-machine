#!/bin/bash
# One-shot install of the Canva compose runner (poller + launchd agent).
# Run manually: bash scripts/canva-runner/install.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/HWC/canva-runner"
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
cp "$SRC/com.hwc.canva-runner.plist" "$HOME/Library/LaunchAgents/com.hwc.canva-runner.plist"
launchctl unload "$HOME/Library/LaunchAgents/com.hwc.canva-runner.plist" 2>/dev/null || true
launchctl load "$HOME/Library/LaunchAgents/com.hwc.canva-runner.plist"
echo "canva-runner installed — polls the queue every 2 min"
echo "log: ~/Library/Application Support/HWC/canva-runner.log"
