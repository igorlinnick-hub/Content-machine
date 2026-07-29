#!/bin/bash
# One-shot install of the Canva compose runner (poller + launchd agent).
# Run manually: bash scripts/canva-runner/install.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/HWC/canva-runner"
mkdir -p "$DEST"
cp "$SRC/run.sh" "$DEST/run.sh"
chmod +x "$DEST/run.sh"
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
