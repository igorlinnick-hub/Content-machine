# Canva MCP dropped the speaker-notes setter (2026-08-24) — caption now rides as a design comment

**Symptom (Igor, 2026-08-26):** every composed carousel opened in Canva showed the
Notes panel full of a *previous* post's caption (GLP-1 text on a NAD+ post,
cartilage text on a mitochondria post).

**Cause, two halves:**
1. The 5 master templates are copies of real old posts and carried those posts'
   captions in presenter notes. `copy-design` copies notes with the pages.
2. Until 2026-08-20 the runner rewrote them (`edit-design` →
   `replace_speaker_notes`). On 2026-08-24 mcp.canva.com replaced its tool
   surface: `perform-editing-operations` has NO notes op (update_title,
   replace_text, update_fill, insert_fill, delete_element,
   find_and_replace_text, position/resize_element, format_text,
   update_autofill_field) and `get-presenter-notes` is read-only. Passing
   `notes: ""` inside the `pages[]` argument is silently ignored. Connect API
   has no notes endpoint either. The runner said so in its own summaries
   ("no presenter-notes setter") — nobody was reading them.

**Fix taken:**
- Skill `canva-compose-runner` §3: notes are read-only, don't try. §6 step 3a:
  post `scripts.long_caption` on the finished design with `comment-on-design`
  (≤1000 chars per comment, split `(1/2)`/`(2/2)` if longer). §6a check 6:
  `get-presenter-notes` on the copy → any non-empty page = master leaked notes
  again → print `NOTES LEAK`, don't fail. First live run (Made "Duck Lip Myth",
  2026-08-26) did exactly that: caption comment posted, `NOTES LEAK
  DAHMHS1wLls p1` reported.
- All 5 masters' notes emptied 2026-08-26.

**How to clear notes in bulk (works, Safari `do JavaScript`):** a plain click on
the textarea does nothing — React ignores synthetic events on `value`. What
works is the native setter plus an `input` event, then `blur()` and ~10s for
autosave:
```js
const ta = document.querySelector('textarea[aria-label=Notes]')
ta.focus()
Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(ta,'')
ta.dispatchEvent(new Event('input',{bubbles:true})); ta.blur()
```
Script: `scratchpad/clean_notes.sh` / `clean_first.sh` (per-session scratch).

**Two traps that cost the most time here:**
- **The Notes panel binds to the page under the viewport, and the editor's
  "Page 1" is NOT API page 1.** Several masters carry a hidden page above it:
  API page N = editor page N−1, and API page 1 is only reachable by scrolling
  the page list to `scrollTop = 0` — sometimes only on the 3rd-4th try, because
  the panel re-binds asynchronously. Always verify by reading back through
  `get-presenter-notes`, never by what the panel showed.
- **A manual edit that is not followed by a blur + a real pause is lost.** Igor
  cleared the same masters twice by hand and both times the API still had the
  text.

**Reusable lesson:** when a runner reports a capability gap in its final
summary, surface it to the row (`compose_progress`) or the UI — a log line
nobody reads is the same as silence.
