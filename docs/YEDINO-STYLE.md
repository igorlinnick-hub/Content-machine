# YEDINO-STYLE — the visual system for @yedino.systems carousels

**Binding for every Yedino post** (the agency's own account — *not* HWC clinic
posts, which follow [POST-CRAFT.md](POST-CRAFT.md)). When a Canva master is
rebuilt, replaced, or swapped for a different layout, **this file is what has to
survive**. The master is disposable; the system is not.

Two audiences: the person building a Canva master, and the compose runner
filling one. Both read §7 (invariants) before anything else.

Yedino is a real client row in Content Machine (`clinics.niche = 'yedino'`), so
it gets scripts from the same pipeline as a clinic. What differs is the persona
and the compliance surface (`lib/niche/profiles.ts` → `YEDINO_PROFILE`): Yedino
is **not a medical advertiser**, and must never make a medical claim or promise
patient volume.

Source of the tokens: `~/Documents/Code Projects/Yedinosystems/tailwind.config.ts`
and `lib/brand.ts`. Nothing here is invented — if a value is not in those files
it is a layout rule, not a brand value.

---

## 0. What went wrong in R1, and what this fixes

`Yedinosystems/R1/` is the hand-built comp of this same post. Verdict: **"выглядит
как ИИ."** That verdict is correct and it decomposes into three fixable causes.

| Cause | The tell | The rule that kills it |
|---|---|---|
| The page is white, and so is every competitor's | Dominant field of all 5 slides is `#FFF`/`#FAFAFA`. Brand gradient appears only as a 32px logo chip. | §2 **bookend** — slides 1 and 5 are full gradient fields |
| Photo → white scrim → big heading | The single most-used template move on the internet. Used on 3 of 5 slides. | §4 **window, not bleed** — hard 18px edge, no fade, ever |
| Photography with no photographer in it | High-key, centered, blue-graded, everything in focus, subject posing at the lens. Same value and same temperature as the page, so it reads as one synthetic soup. | §5 **warm subject on cool page**, off-centre, foreground occlusion, grain |

R1 stays useful for exactly one thing: **the copy layout is right.** Keep the
words and their order; rebuild everything under them.

---

## 1. Tokens

Copied from `tailwind.config.ts`. Do not round, re-pick, or "warm up" these.

```
brand-500   #2563EB   primary
brand-600   #1D4ED8
brand-700   #1E40AF
brand-300   #93C5FD   accent on dark fields
brand-100   #DBEAFE
sky-500     #0EA5E9   gradient tail
sky-400     #38BDF8

ink         #0F172A   headings on light
ink-soft    #1E293B
ink-muted   #475569   body on light
ink-faint   #94A3B8   labels, meta

canvas      #FAFAFA   body-slide field
line        #E2E8F0   dot grid, rules, hairlines
white       #FFFFFF   cards, type on dark
```

**Gradients** (135°, exactly as the site uses them):

```
brand-gradient        linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)
brand-gradient-soft   linear-gradient(135deg, #1E40AF 0%, #2563EB 45%, #0EA5E9 100%)
```

Cover and CTA use `brand-gradient-soft` — the three-stop version has a dark
corner to seat the type against. The two-stop version is for bars and ticks.

**Type**: Plus Jakarta Sans (display, 700/800) + Inter (text, 400/500/600).
**Radius**: 18px, everywhere, no exceptions — photo windows, cards, pills.
**Texture**: dot grid, 24px pitch, `#E2E8F0` dots at 1.6px, on every light slide.
**Logo**: the `Y_PATH` vector from `lib/brand.ts`. **Never** `Yedino-Logo.png` —
that is a 3D mockup on a photo background and does not belong on a slide.

### 1a. The Canva constraint that shapes all of this

A Canva master gives us reliably: solid-colour text, rectangles and rounded
rectangles with gradient fills, images with corner radius, and lines. It does
**not** reliably give us gradient-filled text or outlined text.

Therefore: **the gradient lives in shapes only; every piece of text is a solid
colour.** Every device below obeys this, which is why they all port to any
master without a fight.

---

## 2. The bookend — the one thing you see in the feed

```
slide 1        slide 2        slide 3        slide 4        slide 5
GRADIENT       canvas         canvas         canvas         GRADIENT
```

Cover and CTA are **full-bleed `brand-gradient-soft` fields**. Bodies are
`canvas` with the dot grid. Blue → white → white → white → blue.

This is the highest-leverage rule in the file. At feed thumbnail size nobody
reads the heading; they see a colour block. White-on-white B2B carousels are
indistinguishable from each other, and that is precisely what "looks like AI"
means at scroll speed. The bookend is free, it is pure brand token, and no
competitor's logo can be dropped into it.

Corollary: **never put the gradient on a body slide as a decorative wash.** On
bodies it appears only in the progress rule (§3) and the column tick (§3).

---

## 3. Frame furniture — present on every slide, always at the same coordinates

Canvas is **1080 × 1350**. Base unit 8px.

| Element | Spec |
|---|---|
| **Margin** | 72 left / 72 right / 80 top / 96 bottom. Content column = **936px** |
| **Progress rule** | Pinned to the bottom edge, full width, **8px** tall. Track `#E2E8F0` (on gradient slides: white @ 18%). Fill = `brand-gradient` (on gradient slides: solid white), width = `n / 5` of 1080 |
| **Column tick** | 4 × 56px vertical bar, `brand-gradient`, at x=72, sitting directly above the eyebrow. On gradient slides: solid white |
| **Eyebrow** | Inter 600, **20px**, uppercase, tracking `.14em`. `ink-faint` on light, `brand-100` on gradient. Max 22 chars |
| **Wordmark** | `Y_PATH` mark 36px + "yedino systems" Inter 500 20px, top-left at (72, 80). `ink` on light, white on gradient |

The progress rule is the second-strongest device here. It is one rectangle, it
survives any layout, it reads at thumbnail size, and it does real work — a
visible completion cue is worth swipes. Do not replace it with a "02 / 05"
corner label; that is the generic move R1 made.

---

## 4. Photography — framing and placement

### 4a. The window rule

**A photograph never bleeds to more than one frame edge, and never fades.**

- It sits in a rounded window, radius 18px, hard edge.
- **No white scrim. No gradient fade into the page. No text on top of the
  photo** — the single exception is one caption chip (§4c).
- On the cover the window may run off **one** edge (right), which is what makes
  the composition asymmetric and deliberate. Off two edges it is a background
  again, and we are back in R1.
- Photos are graded warm (§5) and the page is cool, so the window edge is a real
  edge. That contrast is doing the work; do not soften it.

### 4b. The three-column rhythm

The 936px content column divides into **3 × 296px with 24px gutters**. Every
block snaps to 1, 2, or 3 columns.

- The photo window is **2 or 3 columns**. Never 1, never a half-column.
- A list occupies **2 columns and leaves the third empty.**

That empty third column is not wasted space — it is the difference between "laid
out" and "filled in". Centering everything across the full width is the default
move, and defaults are what read as machine-made.

### 4c. Caption chip

The only text allowed over a photograph: white text on an `ink` @ 82% rounded
rect, Inter 500 22px, 16px padding, placed inside the window at its bottom-left
with a 24px inset. Used to point at something real in the frame (slide 2's
teleprompter screen). One per post, maximum.

---

## 5. Art direction — how the photograph has to be taken

This section exists because R1's photos are the main reason the post reads as
generated. Every rule below is the inverse of a specific R1 failure.

### 5a. Hard bans

- White coat against a white or blurred-white background.
- High-key, low-contrast, everything-in-focus.
- Subject centred, facing the lens, smiling, mid-explaining-gesture.
- Cool / blue grade.
- "Clinic corridor with bokeh."
- Any generated image on the proof slide (§6).

### 5b. Requirements

1. **Warm subject, cool page.** The brand owns blue. The photograph must be the
   warm thing on the slide — practice lighting at 4000–5500K, daylight only as a
   cool window *behind*. Blue photo on a blue brand is the "soup" that made R1
   look synthetic.
2. **One directional light.** Visible falloff, a shadow side on the face.
3. **Off-centre and cropped.** Subject on a third; something cut by the frame
   edge. Real photographs have edges the photographer chose.
4. **Foreground occlusion.** Something out of focus in front of the subject — a
   monitor edge, a doorframe, a shoulder, a plant. This is the cheapest and
   strongest anti-AI cue available: it establishes a vantage point, and
   generators rarely produce it unprompted.
5. **Mid-action, never posing.** Looking at the phone, not the lens. Hands doing
   the thing the slide is about.
6. **State the focal length.** 35mm environmental (show the room) or 85mm
   (compress and isolate). "Everything sharp at 50mm" is the generated look.
7. **Grain.** 2–4% monochrome grain over every photograph, added after
   generation. Generated frames are too clean; grain is the cheapest credibility
   you can buy.

### 5c. Budget

**At most 2 of 5 slides carry a photograph.**

Yedino sells an operation, not a mood. Typography on the dot grid is more
credible to a clinic owner than four stock-feeling frames — and every photo not
placed is a photo that cannot look generated. R1 used four.

Source order: real footage from a client shoot → licensed stock that has a
photographer's eye in it → Flux `flux-1.1-pro-ultra` with the full brief above.

---

## 6. The proof slide is real or it is empty

Slide 4 carries the only evidence in the post: a screenshot of a real inbox with
real inquiries, names blurred.

**Never generate, draw, mock up, or "representatively illustrate" it.** A fake
proof is caught instantly and it is the one thing that costs the whole account
its credibility. Until a real screenshot exists the slot renders as a visible
`PROOF PENDING` placeholder — loud on purpose, so the post cannot ship by
accident.

---

## 7. INVARIANTS — the contract a new master must satisfy

Change the layout freely. These seven do not change. If a proposed master breaks
one, the master is wrong, not the rule.

1. **Bookend.** First and last slide are full `brand-gradient-soft` fields; every
   body slide is `canvas` + dot grid.
2. **Progress rule.** 8px, bottom edge, full width, `n / total`, on every slide.
3. **One edge, hard edge.** No photograph touches more than one frame edge. No
   scrim, no fade, no text over the image beyond one caption chip. Radius 18px.
4. **Fixed display type.** Headings never resize to fit. Slack is absorbed by the
   panel or the window — never by the font size, never by extra words (§8).
5. **Gradient in shapes, solid colour in text.** Always.
6. **Two photographs maximum per five slides**, and the proof image is real or
   absent.
7. **72px margins, 936px column, 3-column rhythm**, with at least one column of a
   body grid deliberately left empty.

---

## 8. Typographic grid, and what happens when the copy is the wrong length

Fixed sizes. The scale is short on purpose.

| Role | Font | Size | Line-height | Colour |
|---|---|---|---|---|
| Display heading | Jakarta 800, tracking -0.02em | **88px** | 1.02 | `ink` / white |
| Heading accent (last fragment) | same | 88px | 1.02 | `brand-500` / `brand-300` |
| Intro / body | Inter 400 | **34px** | 1.45 | `ink-muted` / `brand-100` |
| List item | Inter 500 | **32px** | 1.35 | `ink-soft` / white |
| Stat numeral | Jakarta 800 | **64px** | 1.0 | `brand-500` / white |
| Eyebrow | Inter 600, tracking .14em, caps | **20px** | 1.2 | `ink-faint` / `brand-100` |
| Caption chip | Inter 500 | **22px** | 1.3 | white |

### 8a. The two-tone heading

The heading's **final sentence-fragment is set in the accent colour**, the rest
in ink (or white). `Not views. **Patients.**` — this was the one move R1 got
right; it is now the rule, not a one-off.

It costs nothing, it needs two text boxes in Canva, and it gives a heading a
shape that a generic template does not have.

### 8b. Budgets, and what to do when copy overflows

- **Heading**: max 2 lines, **≤ 34 characters per line**.
- **Intro**: max 4 lines, ≤ 28 words.
- **List**: 3–5 items, each **≤ 34 characters** — that is one line at 32px in the
  616px two-column block, measured, not guessed. A hairline divider between items
  instead of a blank line (the rule does the spacing job).
- **Eyebrow**: ≤ 22 characters.

When the text does not fit, in this order:

1. **Cut the copy.** Always the first move.
2. If the heading genuinely needs a third line, use the **3-line variant at the
   same 88px** and give up one grid row from the photo window. The type block
   does not move and does not shrink.
3. **Absorb remaining slack with the panel or the window** — grow the card, grow
   the window, grow the empty column.

**Never shrink the font. Never pad with extra words.** Same law as
POST-CRAFT §4a, for the same reason: a per-slide font size is what turns a
designed system back into a template.

---

## 9. The "How it works" post — field contract

Five slides. Field names follow the `lib/canva/template-map.ts` convention
(`cover_*`, `slide_N_*`, `cta_*`) so the same autofill map works if the
server-side path is ever usable (see §10).

| Slot | Value | Notes |
|---|---|---|
| `cover_title` | How it works | gradient field |
| `cover_hook` | From one filming session to a full month of content | |
| `cover_photo` | Doctor mid-sentence to camera, phone on a tripod out of focus in the foreground | §5; bleeds off the right edge only |
| `slide_2_heading` | 30 minutes a week. | |
| `slide_2_intro` | Your doctor talks. Your MA films it on a phone — we send the topics and the checklist. That's it. Nothing else on your side. | |
| `slide_2_photo` | MA filming the doctor on a phone; **the script is on the phone screen** | The only interface allowed in this post — see §9a |
| `slide_3_heading` | Everything after the phone. | no photo — §5c budget is spent |
| `slide_3_bullet_1..5` | Edit every clip · Write the captions · Publish on schedule · Boost what performs · Answer every DM in seconds — day and night | |
| `slide_4_heading` | Not views. Patients. | `Patients.` is the accent fragment (§8a) |
| `slide_4_bullet_1..3` | 8–12 finished videos a month · Inquiries landing in your inbox · One report every Monday: what worked, what we change | |
| `slide_4_photo` | **Real HWC inbox screenshot, names blurred** | §6 — empty until it exists |
| `cta_keyword` | AUDIT | gradient field |
| `cta_punchline` | Free 20-minute growth audit — exactly where you lose patients between Instagram and the front desk. No pitch. | |

### 9a. Content rules that travel with the copy, not the template

1. **No backend and no builder screenshots.** A clinic that sees the tool thinks
   "complex, and I will have to maintain it." The teleprompter screen on slide 2
   is the sole exception: it shows not a platform but the fact that the doctor
   has nothing to think up. A dashboard tile grid is banned outright — it
   directly contradicts "Nothing else on your side."
2. **Slide 4 is the only proof, and it must be genuine** (§6).
3. **The doctor on slides 1–2 is composite, not Dr. Made.** These slides say
   "your clinic, your doctor"; a recognisable HWC face reads as "here is their
   client" and breaks the address.
4. **The full app tour** (Scripts / Teleprompter / My videos / Compliance) is a
   separate post — an "Inside" highlight and the growth-audit call, not here.

---

## 10. How a Yedino post actually gets built — read before wiring anything

⚠️ **Yedino posts are assembled the same way HWC posts are: by the Claude + Canva
MCP runner copying a master design, not by server-side autofill.**

Server-side autofill (`POST /v1/autofills`, `lib/canva/orchestrator.ts`) needs
Canva **Enterprise** brand templates, which this account does not have. That path
is inert — see `HANDOFF-MODULES.md` §4. The `template-map.ts` field names in §9
are kept as the naming convention so the master's layers are labelled
consistently and the map is ready if Enterprise ever happens.

Two more facts worth not rediscovering:

- **`lib/canva/templates.ts` is dead code** (`HANDOFF-MODULES.md:554`). Nothing
  imports it. The live registry is `lib/posts/style-templates.ts`, where Yedino
  is **style 6**, gated by `niches: ['yedino']`. That gate is what makes this
  carousel Yedino's ONLY option: `stylesForNiche('yedino')` returns just this
  style, and the five HWC styles never appear in its picker (nor Yedino in
  theirs) — the same mechanism that keeps Aesthetic Made-only.
- The runner skill (`~/.claude/skills/canva-compose-runner/SKILL.md`) hardcodes
  its own copy of the style → design-id map and is headless, so it cannot import
  the registry. **Both have to be updated when the Yedino master ID lands.**

---

## 11. Building the master — checklist

1. New Canva design, **1080 × 1350**, 5 pages.
2. Yedino brand kit: the tokens in §1. This is **not** the HWC kit `kAG87QCkJl0`.
3. Pages 1 and 5: full-bleed rectangle, `brand-gradient-soft` 135°.
   Pages 2–4: `canvas` fill + dot-grid image at 24px pitch.
4. Frame furniture on all five pages at the exact coordinates in §3 — wordmark,
   column tick, eyebrow, progress rule at 1/5 … 5/5.
5. Text layers named to the §9 field contract (`cover_title`, `slide_2_heading`,
   …). Headings are **two boxes** — base and accent fragment (§8a).
6. Photo windows as rounded-rect image frames, radius 18, snapped to the
   3-column grid (§4b). Cover window bleeds right only.
7. Slide 4 photo frame: leave the `PROOF PENDING` placeholder in the master.
8. Empty the presenter notes on every page — the runner cannot clear them via
   MCP since 2026-08-24, and `copy-design` carries them along.
9. Export page 1 → `public/style-previews/yedino.png`.
10. Put the design ID in style 6's `canvaDesignId` (`lib/posts/style-templates.ts`)
    **and** in the runner skill's map. Until it is set, `styleIsComposable()` is
    false and `POST /compose` refuses the post with a 409 instead of queueing it.

Visual target for steps 3–7: `~/Documents/Code Projects/Yedinosystems/R2/`.

---

## 12. The master, as it actually is (`DAHVZUyzxTg`)

Read off the design on 2026-09-14. This section and §13 **supersede §2–§6** for
this master — those were written against a different visual and no longer bind.

### 12a. What the master is

- **Ground:** textured cream paper (~`#E7DFC9`), not white and not the gradient.
- **Title:** heavy all-caps grotesque, black, left-aligned, tight leading,
  wrapping at roughly 10 characters — 3 lines is the whole box.
- **Body:** 32pt, **black text on an accent-coloured HIGHLIGHT block**, one
  block per line with a ragged right edge.
- **Accent furniture:** a dashed curved arrow with a solid arrowhead, pointing
  at the body block.
- **Header:** brand name (left, caps, letterspaced) · topic hashtag (right, bold).
- **Footer:** `@yedino.systems` (left) · year (right, bold).

### 12b. The rule

**One colour, one post.** Recolour every accent element — the body highlight
blocks and the dashed arrow — to the post's accent. Nothing else moves.

**The accent is the HIGHLIGHT, not the text.** The text on top stays black, so
every accent is tested against **black**, not against white. That is the
opposite of the usual test and it rules out dark colours: brand-500 `#2563EB`
measures 4.06:1 against black — large-text-only, and heavy under a 32pt
paragraph — so the house blue is deliberately **absent** from this palette and
lives in its lighter tints instead.

Palette is **blue / white / yellow** (Igor 2026-09-14). Chosen by content
pillar, so the colour carries information and two posts in a week never collide:

| Pillar | Accent | | vs black |
|---|---|---|---|
| Why growing a brand matters | `#38BDF8` | sky | 9.8:1 |
| What doing it yourself actually costs | `#FBBF24` | yellow | 12.6:1 |
| Proof and numbers | `#0EA5E9` | deep sky | 7.6:1 |
| Objections doctors actually raise | `#FFFFFF` | white | 21:1 |
| How the operation runs | `#93C5FD` | pale blue | 11.7:1 |

Code: `YEDINO_ACCENTS` / `yedinoAccentFor()` in `lib/posts/style-templates.ts`.
The pillar strings must match `clinics.content_pillars` exactly — break that and
every post silently comes out sky blue.

### 12c. The page structure — read off the design, 2026-09-16

Opened in the browser (the Canva MCP is still unauthorised, so this came from
the editor's own DOM). The page navigator reads **6 / 6**, and the shape is
simpler than the first draft assumed — **two slots it assumed do not exist**:

| Page | Holds |
|---|---|
| 1 — cover | **TITLE ONLY.** No hook line, no subtitle, no photo frame |
| 2–5 — body | Title + **ONE paragraph**. No bullets anywhere in this master |
| 6 — CTA | **TITLE ONLY.** No punchline slot — the whole CTA is the title |

Every page also carries fixed furniture the post never touches: brand name and
hashtag in the header, handle and year in the footer.

Consequences already wired:

- `bodySlots` corrected **3 → 4** (cover + 4 body + CTA = 6).
- `YEDINO_FIELDS` dropped `cover_hook`, `cover_photo`, `cta_punchline` and every
  `*_bullet_*` — none of them have anywhere to land.
- The CTA has to fit one title: `DM THE WORD AUDIT`.
- Two title budgets, not one: body pages share the box with a paragraph (≤26
  characters), while the title-only pages take more (≤32). The master's own
  copy sets the range — `BRANDING IS MORE THAN JUST LOOKS` is 32.

The master's own paragraphs run **117–133 characters**, which is how the ≤140 /
≤22-word body budget in §13b was calibrated — it is the design's real working
range, not a guess.

**Still unknown: the typefaces.** Canva serves them under obfuscated names
(`YAFdJvSyp_k_2`), so they cannot be read out. It does not matter for
production — the master's own faces stay and must never be swapped — but the
R3 comp stands in Archivo Black + Poppins and will not match exactly.

## 13. No photography, and the text budget

Two decisions from Igor (2026-09-14) that override earlier sections for master
`DAHVZUyzxTg`:

### 13a. There are no photographs

**§4 and §5 do not apply to this master.** It is type and one accent colour.
Nothing generates, nothing gets uploaded, nothing gets cropped.

Wired accordingly, so this is not a rule someone has to remember:

- `generatePhotoBriefs()` returns `[]` for niche `yedino` before the agent call
  — no LLM spend, no Flux spend, no Canva asset uploads.
- Style 6 is `photoCover: false`, so `coverBriefForStyle()` does not rewrite
  slide 1 into an `ai` photo that nothing would place.

This also retires §6's proof-screenshot problem for now: there is no image slot
to put a fake in. If a real inbox screenshot is ever added, §6 applies again.

### 13b. The text budget is hard

The master carries little text and cannot grow. Nothing downstream shrinks the
type, so the copy has to land inside the budget at generation time. It is
injected into the Writer's system prompt via `YEDINO_PROFILE.writerBudget`
(`lib/niche/profiles.ts`), not left to POST-CRAFT.

| Slot | Budget |
|---|---|
| Title | ≤ 3 lines, ≤ 24 characters, **no single word over 10 characters** |
| Body | ≤ 5 lines at ~28 chars/line — ≤ 22 words, ~140 characters |
| Per slide | **either** a paragraph **or** a short list, never both |
| **Whole post** | **≤ 120 words across every slide** |

The word-length rule is not fussiness: the title has no smaller size to fall
back to, so one long word (`PERSONALIZATION`) breaks the slide outright.

If an idea does not fit: **cut the idea.** Never shrink the type, never split a
sentence across slides to smuggle it in, never pad a short slide to fill space.
A slide with three words on it is finished; a slide that overflows is broken.

These numbers were **measured off the master's own page 3** (2026-09-14), not
guessed: the body box holds about 28 characters per line at 32pt with room for
5 lines, and the title wraps at roughly 10 characters over 3 lines.

**Both sizes are LOCKED** — body 32pt, title fixed (Igor: "шрифт соблюдал тот
же, как правило 32 для базы, а заглавие шрифт не менял размер"). Nothing
resizes type per slide. `YEDINO_TYPE` in `lib/posts/style-templates.ts` carries
the numbers; `writerBudget` in `lib/niche/profiles.ts` carries the rule the
Writer obeys. Change one, change both.

The title box is **bottom-anchored**: a one-line and a three-line title must
leave the same gap down to the body, or short titles float and the post stops
looking like one set.

### 13c. Audience and formats

The reader is a **doctor who owns the practice** — stem cell and regenerative
therapies, bio-identical HRT, peptides, neuropathy. A physician, not a patient
and not a marketer.

**Never teach them medicine.** They know their field better than we do, and a
post explaining their own specialty back to them is the fastest way to lose
them. Posts are about running the practice: why building their own name changes
where patients come from, the objections they say out loud, and advice they can
act on this week.

Four formats, gated to this niche in `lib/posts/formats.ts`
(`formatsForNiche('yedino')`), so the clinical catalog never reaches Yedino and
these never reach a clinic:

| Format | What it does |
|---|---|
| **Why it matters** | One reason a practice with its own audience runs differently |
| **Objection** | Name what the doctor says out loud, answer it straight, grant what is fair |
| **One fix** | One concrete change they can make Monday — works even if they never hire us |
| **What it costs** | The hidden cost of the current arrangement, checkable against their own week |
