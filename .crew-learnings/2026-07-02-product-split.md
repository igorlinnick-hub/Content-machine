# Product split: one engine, two wrappers (2026-07-02)

**Pattern:** when a vertical B2B product (clinic white-label) and a mass-market idea compete for a solo founder's focus, don't fork the codebase and don't pick one blindly — split at the wrapper level. One shared engine (analysis, script gen, teleprompter, ffmpeg cleanup), two thin products: white-label stays as-is (Drive, Buffer, team-managed setup), consumer app gets its own auth/billing/storage skin.

**Key sub-decisions worth reusing in other projects:**

1. **Transcript-based manual editing instead of a timeline editor.** For talking-head video products, manual correction = UI over Whisper segments + cut-plan (Descript model). Client-side preview skips cut ranges in the player; server renders only on export. ~10x cheaper than building a timeline editor, and it composes with an existing ffmpeg cut pipeline.
2. **Staged posting instead of upfront API approvals.** v1 = OS share sheet (zero approvals, IG personal accounts can't be API-posted anyway) → v2 = aggregator (Ayrshare-type, their approvals) → v3 = own Meta/TikTok app review at volume. File approval applications in parallel with v2 — they take weeks.
3. **Credits from day one for consumer LLM products.** Lesson from the clinic kill switch: pay-per-use APIs without per-user limits break at N=1, let alone at viral scale.
4. **Session coordination via HANDOFF section.** Parallel Claude sessions each own a lane (core/compliance vs clips vs standalone); shared files listed explicitly; statuses updated in one table.

**Where:** HANDOFF.md §22 (full decision record, per-process plans, approval process). Code audit that grounded the estimates: studio analyze engine is already clinic-free; /clips pipeline is already fully server-side (Drive is just I/O folders).
