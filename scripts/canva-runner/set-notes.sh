#!/usr/bin/env bash
# set-notes.sh <design_id> <caption_file>
#
# Write the post's Instagram caption into page-1 presenter notes of a Canva
# design. The Canva MCP has had NO notes setter since 2026-08-24
# (perform-editing-operations offers no notes op, get-presenter-notes is
# read-only, `notes:""` inside pages[] is ignored), so the only way to fill the
# panel Igor copies from is the editor itself, driven through Safari.
#
# Three gotchas this script exists to encode (.crew-learnings/2026-08-26-…):
#   1. React ignores a synthetic write to textarea.value — the NATIVE value
#      setter plus an `input` event is what registers.
#   2. Autosave needs a blur and a real pause; a write without them is lost.
#   3. The Notes panel binds to the page under the viewport, and the editor's
#      first visible page is NOT always API page 1 (hidden pages sit above), so
#      the canvas is scrolled to the top and the binding is re-read before
#      writing. ALWAYS verify afterwards with get-presenter-notes.
#
# Never touches Igor's Safari window: it opens its own, addresses it by id, and
# closes it on exit.
set -euo pipefail

DESIGN_ID="${1:?usage: set-notes.sh <design_id> <caption_file>}"
CAPTION_FILE="${2:?usage: set-notes.sh <design_id> <caption_file>}"
[ -f "$CAPTION_FILE" ] || { echo "caption file not found: $CAPTION_FILE" >&2; exit 1; }

TMP="$(mktemp -d)"
WIN=""
cleanup() {
  [ -n "$WIN" ] && osascript -e "tell application \"Safari\" to close window id $WIN" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

js() { # js <file> -> run that JS in our window, print the result
  osascript <<AS
tell application "Safari"
  set theJS to (read POSIX file "$1" as «class utf8»)
  return (do JavaScript theJS in current tab of window id $WIN)
end tell
AS
}

# The caption reaches JS as a JSON literal — no shell quoting, no escaping bugs.
python3 - "$CAPTION_FILE" "$TMP/set.js" <<'PY'
import json, sys
caption = open(sys.argv[1]).read().rstrip('\n')
open(sys.argv[2], 'w').write(
    'var CAPTION = ' + json.dumps(caption) + ';\n' + '''
(function () {
  var ta = document.querySelector('textarea[aria-label=Notes]');
  if (!ta) return 'no-textarea';
  ta.focus();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
    .set.call(ta, CAPTION);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.blur();
  return 'wrote ' + CAPTION.length;
})()
'''
)
PY

cat > "$TMP/ready.js" <<'JS'
(function () {
  return document.readyState === 'complete' &&
    [].slice.call(document.querySelectorAll('button,[role=button]'))
      .some(function (b) { return (b.innerText || '').trim() === 'Notes'; })
    ? 'ready' : 'wait';
})()
JS

cat > "$TMP/open-notes.js" <<'JS'
(function () {
  if (document.querySelector('textarea[aria-label=Notes]')) return 'already-open';
  var el = [].slice.call(document.querySelectorAll('button,[role=button]'))
    .filter(function (b) { return (b.innerText || '').trim() === 'Notes'; })[0];
  if (!el) return 'no-button';
  el.click();
  return 'clicked';
})()
JS

# The canvas scroller is the tallest scrollable block on the page. scrollTop=0
# puts API page 1 under the viewport so the panel binds to it.
cat > "$TMP/top.js" <<'JS'
(function () {
  var best = null;
  [].slice.call(document.querySelectorAll('div')).forEach(function (d) {
    if (d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 300) {
      if (!best || d.scrollHeight > best.scrollHeight) best = d;
    }
  });
  if (!best) return 'no-scroller';
  best.scrollTop = 0;
  return 'top';
})()
JS

cat > "$TMP/bound.js" <<'JS'
(function () {
  var ta = document.querySelector('textarea[aria-label=Notes]');
  if (!ta) return 'no-textarea';
  var p = ta;
  for (var i = 0; i < 6 && p; i++) p = p.parentElement;
  return ((p ? p.innerText : '').split('\n')[0] || '?').trim();
})()
JS

WIN="$(osascript <<AS
tell application "Safari"
  make new document with properties {URL:"https://www.canva.com/design/$DESIGN_ID/edit"}
  delay 1
  return (id of front window) as string
end tell
AS
)"
echo "window=$WIN design=$DESIGN_ID"

for _ in $(seq 1 24); do
  [ "$(js "$TMP/ready.js")" = "ready" ] && break
  sleep 5
done
[ "$(js "$TMP/ready.js")" = "ready" ] || { echo "editor did not load" >&2; exit 1; }

echo "notes-panel: $(js "$TMP/open-notes.js")"
sleep 3
echo "scroll: $(js "$TMP/top.js")"
sleep 3

BOUND="$(js "$TMP/bound.js")"
echo "bound-to: $BOUND"
case "$BOUND" in
  "Page 1"*) : ;;
  *) echo "panel is bound to '$BOUND', not Page 1 — refusing to write" >&2; exit 2 ;;
esac

echo "write: $(js "$TMP/set.js")"
# Autosave: blur alone is not enough, the pause is what commits it.
sleep 12
echo "readback-in-editor: $(js "$TMP/bound.js")"
echo "done — verify with get-presenter-notes before trusting this"
