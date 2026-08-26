# POST-CRAFT — the craft bible for HWC carousels

**Binding for every bot that touches a carousel** (writer, splitter, photo-brief,
Canva compose-runner) and for any human/Claude tuning a post by hand. When this
conflicts with an older note, this wins. Source of the rules: Igor's direct
tuning sessions, 2026-07-23 → 2026-07-28.

The job: each post must read like a **real doctor teaching one patient**, look
like a **premium editorial carousel**, and never like an AI template
("заготовка"). Depth and specificity always beat brevity.

---

## 1. VOICE & TONE (binding)

Write like the doctor is talking to **one** patient across the table — clear,
warm, genuinely useful, a little surprising. Educational, **never** scolding,
alarmist, or superior.

- Name the hard part (what hurts, what didn't work) to help the reader
  **understand** it — never to indict their old doctor or scare them.
- Every slide turns toward **what it means** and **what's possible next**.
  Encouraging, not hype.
- Keep pain honest but land on possibility. "с позитивным настроем, не через чур."

### Sound human, not AI — banned patterns

These are the tells that make copy read machine-made. The lists are **examples
of categories, not a complete blocklist** (Igor, 2026-08-19: "there will be
other clichés like this") — anything that sounds like an influencer script,
ChatGPT, or ad copy rather than a doctor across the desk is out, listed or not.
The Writer base prompt carries the same categories; the Critic fails scripts on
them (`lib/agents/teaser-lines.ts` catches the obvious shapes deterministically).

- **Rule-of-three abstract-noun lists** — "gut receptor sensitivity, liver
  clearance rate, and lean muscle mass all change how the drug behaves."
  → Pick ONE concrete thing, make it real: "if you've lost muscle over the
  years, the same dose can hit you harder."
- **The tidy antithesis "summary bow"** — "Same drug, same schedule — very
  different outcomes", "It's not X, it's Y", "The problem was never A — it's B."
  The #1 AI tell. **At most one** such line in a whole post, if any.
- **Teaser / announcer lines** (banned outright, 2026-08-19) — "Here's why
  that's already too late.", "Here's what's actually happening.", "Here's the
  thing / the catch / what most people miss.", "Let me explain.", "Stay with
  me.", "The truth is:", "This is where it gets interesting.", "Let that sink
  in." A sentence must carry the content, not promise it. Test: delete the
  line — if nothing is lost, it was a teaser. Say the actual claim instead:
  "Wrinkles show up in your 30s, but the bone under them started thinning at
  25." The Critic fails any script containing one.
- **Strawman / audience-address openers** — "Most people think…", "The
  standard story is…", "You've probably heard…", "Sound familiar?", "You're
  not alone." At most one per post, only if the misconception is real and
  named concretely. Default: skip it and state the fact.
- **Marketing / AI filler** — "game-changer", "unlock", "journey", "dive in",
  "at the end of the day", "the bottom line", "it's important to note",
  "plays a key/crucial role", "when it comes to", "in today's world", "let's
  be honest", "the good news is", "holistic", "empower", "transform your…",
  "significantly", "varies significantly", "isn't uniform", "in many cases."
  Cut them; say the concrete thing.
- **Perfectly parallel, symmetric prose.** Real speech is uneven — a 3-word
  sentence next to a 20-word one. Use contractions and plain verbs.
- **Ending every slide on a neat wrap-up.** Sometimes just stop on the useful
  detail.

One small, specific, human observation beats three polished generalities.

### Never

- No "Swipe →" or any swipe prompt anywhere (the platform UI handles it).
- No invented statistics/percentages. If a number isn't in the verified facts,
  write "studies report improved outcomes for many patients."
- Keep the plan-assigned ManyChat **KEYWORD** exactly (binding, from the curated
  list). Never substitute or invent.

---

## 2. SLIDE-SHAPE CATALOG — vary every slide

**Rule: never two consecutive slides in the same shape.** The reader must feel a
change of pace on every swipe. This governs SHAPE, not LENGTH — keep every
mechanism, number, and named study intact. Pull from these shapes:

| Shape | What it is | Use for |
|---|---|---|
| **Cover hook** | Title + a curious/warm 1-2 line hook (no antithesis) | Slide 1 |
| **Mechanism** | Heading + lead-in + real biology in sub-points + close. The DEEPEST slide — never thin it | "What's happening" / real cause |
| **Comparison** | Two labeled sides stating real facts: `Cortisone → calms pain fast, doesn't touch the cause` / `A2M → targets the enzymes` | Standard-care vs. approach; drug A vs B |
| **Research statement** | Each named study as ONE crisp line, not a paragraph: "STEP trial: weight change over 68 weeks under supervision" | "What the data shows" |
| **Analogy + takeaway** | A sticky plain-prose analogy, a divider, then a bold one-line takeaway | "Think of it this way" |
| **Checklist** | Lead-in + `✓` items with breathing room + close | "Who this helps" / candidacy |
| **Numbered path** | `①②③` steps with thin dividers between them | "Your next step" / protocol |
| **Single vivid line** | One short, warm paragraph, nothing else | Sparse beats, palate cleanser |
| **Pull-quote (editorial)** | A short claim set large with a kicker label + rule, magazine style | A punchy reframe, a myth line |

A carousel = cover + **at least 4 body slides** + CTA. Fewer body slides = failed.

### 2a. WATERFALL — the post descends, it doesn't circle (binding, Igor 2026-08-12)

The shape catalog above is the list of STATIONS. It is not the logic. The logic:
**every slide answers the question the previous slide raised, and ends by
raising the next.** If the slides could be reordered without damage, the post
failed. Diagnosed on the live posts: `DAHQn_1_j2s` p2 and p4 said the same
sentence twice, and `DAHRSiuJEHQ` put "normal is an average" *after* the payoff
instead of before it.

Every body slide ends with a **takeaway** — one line, 6-10 words, after a blank
line, set bold. It must ADD something (consequence, criterion, action, limit),
never re-say the body. Eight working types:

| Type | Example |
|---|---|
| Consequence | "Rest calms the pain. The enzymes keep going." |
| Answers the unasked "why" | "That's why relief has a shelf life." |
| What to measure | "That's the number worth measuring." |
| Permission / de-escalation | "Feeling off with a normal number is a reason to look closer." |
| The small lever | "One extra line on the order changes the answer." |
| An honest limit | "A baseline needs more than a single number." |
| Compresses a list | "Four numbers, one picture." |
| Lowers the alarm | "Nothing here is urgent. It's just worth knowing." |

**Takeaway ≠ the banned antithesis bow.** Testable difference: a takeaway carries
information not already on the slide; a bow only rearranges words that are
("It's not X, it's Y", "Same A, different B", "At the end of the day…"). Bows
stay banned.

The takeaway hands off in one of three ways: it names a **limit** (next slide
closes it), raises an **objection** (next slide answers it), or gives a
**criterion** (next slide shows how to get it).

Two hard rules that fall out of this:

- **No slide repeats another.** Each body slide carries a fact, distinction or
  instruction no earlier slide made. Restating in new words = failed variant.
- **The cover gets paid off.** If the hook promises something ("here's how to
  break that loop"), one specific body slide delivers it.

### 2b. HEADINGS carry the reader's question (binding, Igor 2026-08-12)

A heading names the reader's next question, not the section. Four kinds that
work: the **objection** ("So why did the shot wear off"), the **limit** ("Where
the panel stops"), the **lever** ("The test to ask for"), the **stake** ("What
this means for your knee").

Banned — section labels that would fit unchanged on a post about any other
condition: "What's happening", "What the data shows", "Think of it this way",
"The science", "Overview", "Key takeaway". The one exception is **"Who it's
for"** — a recognition slide readers use to self-select.

Corollary: a slide titled for data must actually have a verified number, trial
or date. No verified fact → retitle the slide to what it really delivers (the
test to ask for, the question to bring to the visit). Never fill a data heading
with reassurance — that was the `DAHQn_1_j2s` p5 defect.

---

## 3. SPACING & SEPARATION (binding — Igor 2026-07-28)

The #1 layout defect is a **wall of stacked lines with no air**. Prescribe
spacing explicitly:

- **A blank line between every distinct item** — between the lead-in and the
  list, between each `✓` / `①` item, and before the closing line. Never let
  sentences pile up with no gap.
- Sub-points get a real marker: `✓ ` for checklists, `① ② ③` for steps,
  `→` for comparisons. Use **literal characters**, and set
  `format_text {list_level:0, list_marker:"none"}` so Canva doesn't add its own
  bullet (blank lines inside a native list render as empty bullets).
- A **thin horizontal divider line** (1-2px, panel-text colour at ~40-60%
  opacity, ~70% panel width, centered) between numbered steps or between an
  analogy and its takeaway. Subtle, not heavy.
- **Bold** the payoff line (takeaway, "No pressure. Just clarity.") via
  `format_text` — one bold accent per slide, max.

If a slide's text looks compressed on export, add the blank lines and re-export.
"Красота" bar: the enriched slides 4/6/7 of DAHQnsEktf0 (2026-07-28) are the
reference for spacing done right; slide 5 pre-fix is the wall to avoid.

---

## 4. DESIGN ELEMENTS — fill space, add divisions

A slide with little text must NOT be one floating panel over dead space. Enrich:

- **Thin divider rules** between sub-points (see §3).
- **Numbered badges** `①②③` for a path/steps.
- **Checkmarks** `✓` for candidacy.
- **Bold takeaway** line separated by a divider.
- **Reposition + grow the panel** so it sits balanced (usually lower ~55-65%)
  and hugs its content — no big empty coloured void, and panels must NOT all be
  the same height across the post.
- **Pull-quote / editorial (magazine/newspaper) treatment** — for a punchy
  reframe: a small ALL-CAPS **kicker label** ("THE CATCH", "WHAT WE SEE"), a
  large short quote, a hairline rule under it, optionally oversized quotation
  marks. Gives a premium editorial feel and breaks the panel monotony.
- **Highlight-marker** (Igor 2026-07-28, likes it) — set ONE key heading or
  one-line statement over a solid **brand-teal highlight block** behind the
  text, like a highlighter swipe (ref: the "Lorem Ipsum" yellow-marker look, but
  in HWC teal, not yellow). One punch line per post, max.
- **Semi-transparent rounded elements are the house look** (Igor likes them):
  soft translucent rounded panels / colour shapes in brand colour. Prefer these
  over hard opaque boxes. The slide-4 translucent panels are the reference.
**REMOVED — extra images are OUT of the chain (Igor 2026-07-29).** Photo-in-photo
insets, edge-placed 3D cutouts, and split / two-image layouts are banned — they
came out crooked, ugly, or blank (NAD+ p4 split + p7 blank-label). Use **exactly
ONE full-bleed background image per slide, nothing layered on top.** The
TEXT/decor elements above (dividers, ✓, ①②③, kicker, bold takeaway,
highlight-marker, translucent panels) are what Igor likes — extra IMAGES are not.

Ideas bank (TEXT/decor only — no extra images): an accent colour block behind a
single word, a big drop-cap opening a prose slide, a subtle grain/newsprint
texture on an editorial slide. Try one per post, never all.

Reference (2026-07-28, "красота"): DAHQnsEktf0 slides — 7 (`①②③` numbered path
+ dividers), 6 (`✓` checklist), 4 (analogy + divider + bold takeaway), 3
(kicker + comparison). Copy those layouts (text/decor only).

### 4a. PANEL FIT — close the gap with the panel, never with words (binding, Igor 2026-08-11; supersedes the 07-29 "adaptive fill" rule)

The masters now use a **fixed font (body 46pt / title 50pt)** and the writer works
to a per-slide word BAND, not a ceiling (Igor 2026-08-12): **20-28 words per body
slide** = body 14-18 + takeaway 6-10, split by a blank line; a list body is 3-4
items × ≤ ~6 words, still plus its takeaway; cover ≤ ~18; CTA ≤ ~12. Aim for the
middle of the band — slides swinging 17 → 29 words inside one post read as an
accident. The takeaway is budgeted separately and is never dropped to fit the
body. **Text positions in the masters are already correct — do
not move them.** So when a slide leaves empty space, the answer is always the
panel or one design element, and **never** more copy.

Order of preference when a slide looks empty:

1. **Shrink the panel to hug the text.** The coloured block resizes; the text
   does not move off its anchor and the font never changes. Panels across a post
   should NOT all be the same height — uneven is correct.
2. **Add ONE design element** appropriate to the slide's shape (below).
3. **Nothing.** A calm slide with air is fine. Empty space is not a defect —
   a dead *coloured void* is.

| Slide type | The one element, if it needs one |
|---|---|
| Mechanism / biology | on-topic render behind/beside the panel |
| Comparison | hairline divider between the two labeled sides |
| Research / "data shows" | device or real-photo edge inset |
| Analogy | divider, then the **bold takeaway** line |
| Candidacy / "who it's for" | `✓` checklist with blank-line spacing |
| Next step / protocol | `①②③` numbered path with thin dividers |
| Sparse / palate-cleanser | a real Hawaii photo filling the frame |

Hard rules: (1) **never a large empty coloured void** — fit the panel, or add the
one element; (2) **never pad with extra words, and never resize the font** — a
slide that only fits by shrinking type is a failed slide, cut the copy instead;
(3) **~one special element per post**, not on every slide; (4) vary — no two
consecutive slides the same shape or layout.

---

## 5. PHOTO DIRECTION (binding — v4, 2026-08-17; supersedes v3)

**CONTEXT-FIRST, and every human is a REAL one from the clinic.** v3 let AI
generate people on up to half the slides; v4 kills that — the clinic now has
its own photo library, and generated humans were the weakest thing in every
post. Three sources: `clinic` (real clinic photography, ~40%), `ai` (3D medical
renders + real Hawaii nature), `stock` (Pexels, 1-2 per post max, objects only).
See `lib/posts/photo-brief.ts` for the machine rules; the human/runner rules:

- **Context is the #1 rule.** The image shows the slide's actual subject — a
  joint slide shows a joint, a drug slide shows the pen/vial, a decision slide
  shows a real person or place. If you can't say in one line how the image
  relates to the copy, it's wrong.
- **BANNED: abstract backgrounds** — gold-crystal, marble, generic "organic
  texture" (the DAHQuMaSYFI p3/p4 anti-pattern). They read as filler.
- **REALISM + MEDICAL CONTEXT (binding, Igor 2026-08-05).** Every background
  must be a REAL photograph that respects the MEDICAL context of the slide:
  real lab / blood test / plasma vial, a real doctor–patient consult, a real
  device (pen/vial/IV), real anatomy / x-ray / cells, or a real relevant person
  (no close-up face). Stylised / AI-looking / painterly / marble / "gold-crystal
  fluid" textures are OUT. **Nature (ocean, forest, coral, waterfall) is NOT a
  default** — use it only for a genuine nature ANALOGY (coral = cartilage) or a
  light CTA aesthetic; a hormone/GLP-1/joint post's body slides get MEDICAL
  imagery, not scenery. (The cartilage / hormone / GLP-1 posts were re-shot this
  way — DAHQnsEktf0 / DAHQn_1_j2s / DAHQuMaSYFI lesson.)
- **Source priority:** real photo (photoreal) → contextual 3D render → nothing
  abstract. Three kinds of image:
  - **RENDER** (AI) — a CLEAN, STYLISH 3D anatomical render of the EXACT body
    part / organ / cell / molecule the slide is about: an anatomical body scan,
    a specific organ (heart in a translucent torso, brain, joint), a cell /
    receptor, a molecular model, a DNA helix, a medical sculpture. Dark, minimal,
    editorial — the **@dr.vassily aesthetic**. ALWAYS the real structure tied to
    the body process; NEVER an abstract texture / gold-crystal. For mechanism /
    biology / "what it is".
  - **CLINIC** — a real photograph from the clinic's own Drive library: the
    doctor, the team, a treatment room, a device in real hands, the building,
    a candid real moment. **This is the ONLY source for humans.** Carries the
    ~40% share; picked by LRU rotation (`lib/photos/clinic.ts`) so the same
    face doesn't come back for 30 days. **face NEVER close to camera** on the
    cover. A photo tagged `identifiable-face` needs a signed media release
    before it ships.
  - **STOCK / Pexels** — objects only, and only what the clinic can't supply:
    a blood-tube rack, an injection pen, a vial. **Max 1-2 per post.** Never a
    person (we have real ones), never a landscape (AI does those better).
- **NO AI-GENERATED PEOPLE ANYWHERE.** If a slide needs a person and no clinic
  photo fits, it gets a 3D render instead.
- **Mix: ~40% clinic / rest AI (renders + nature) / Pexels capped at 2.**
  Enforced in code by `enforceMix` in `lib/posts/photo-brief.ts`.
- **Stock = real photos from Pexels (Igor 2026-07-30).** The Canva MCP has no
  stock-search tool, so the runner fetches real stock from the **Pexels free
  API** (`PEXELS_API_KEY` in the runner env) by the slide's keywords, and only
  falls back to photoreal Flux if the key is missing or nothing fits. Prefer
  REAL photos over AI everywhere a photo works (people, Hawaii places, devices);
  reserve AI for the 3D medical RENDERS only.
- **Cover (page 1): NO photo.** Keep the template's clean branded cover
  (gradient / brand surface), like the old designs — never inject a photo or
  render on the cover (Igor 2026-07-30). Only the cover text changes.
- Flux `black-forest-labs/flux-1.1-pro-ultra`, 4:5, safety_tolerance 6. Every AI
  prompt keeps "dark lower third"; PEOPLE also "subject in upper two-thirds".
- **Device photos:** no blank white label placeholders (the NAD+ p7 bug) — prompt a label-less bag/bottle or a drip-chamber / IV-line / hand-holding-pen close-up, not a front-on labelled bag.
- **Visual review every image**; reject: abstract/off-topic backgrounds,
  close-up-face covers, AI artifacts (hands, waxy skin), swimwear, text in image,
  a reused example-design background repeating across posts.

### 5a. AESTHETICS NICHE — its own doctrine (v4.1, Igor 2026-08-26)

Everything above is the **regenerative-medicine** look. A clinic whose
`clinics.niche` is `aesthetics` (Made) gets a different doctrine, picked in
`lib/posts/photo-brief.ts` / `lib/posts/cover-brief.ts` by niche. The reason:
every clinic used to get the same 3D organs + Hawaii scenery + the shared
Drive folder, so a jawline post opened on the same glowing heart and the same
desk photo as a NAD+ post.

- **Every image is a REAL photograph** — beauty-editorial, soft diffused light,
  warm-neutral palette with a gentle lavender-mauve tint (the Aesthetic master's
  panels are translucent lavender). **No 3D anatomy renders, no abstract
  textures.** "calm dark lower third" stays in every prompt.
- **Four AI modes**, each with a verbatim style line in the code:
  - **SKIN** — macro of real skin on a **NON-FACIAL area only**: the side or
    nape of the neck from behind, a shoulder, décolleté, forearm, the back of a
    hand (neck crepe, pores and hydration, sun spots on the hand, post-treatment
    glow). **No facial region ever goes into a SKIN prompt** — measured on Flux
    2026-08-26: "cropped below the eye line" gave a nose and lips, "the jaw seen
    from behind, head turned away" gave a lip-and-nose profile; any facial word
    yields a face. **A face-region topic** (forehead, the 11s, crow's feet,
    under-eye, lips, cheeks, chin, jawline) → TOOLS (the syringe / product of
    that treatment) or ROOM, with a neck / hand stand-in only for the "what
    happens in the skin" beat. Calm and neutral — never a "problem" close-up,
    never a before/after split. Skin of any natural tone, varied across the post.
    A bare neck / shoulder / décolleté is the subject here, not "revealing" —
    the swimwear / full-bare-back reject still applies.
  - **TOOLS** — still life of the actual instrument / product: syringe with
    clear gel, blunt cannula, microneedling pen, laser / RF handpiece,
    dermaplaning blade, glass serum dropper, unlabelled vials and ampoules,
    sterile gloves, cotton pads, chilled globes, LED mask on its stand,
    unlabelled SPF. **Never entering skin, no blood, no bruising, no labels.**
  - **ROOM** — an empty aesthetics treatment room in morning light: white-linen
    bed, ring light / magnifying lamp, rolling tray, product shelf, sheer
    curtains. For "the visit", "what to expect", consult / pricing beats.
  - **BOTANICAL** — a Hawaii botanical / water detail as the analogy only
    (droplets on a ti / monstera leaf, plumeria on wet stone, light on wet sand).
- **Mix: ~25% clinic (the CTA + at most one trust slide), Pexels ≤ 2 (objects
  only — dropper, syringe on marble, pen), the rest AI.** The clinic share is a
  ceiling too: the shared library is regenmed team / desk shots and must not
  carry an aesthetics post. Enforced by `enforceMix` with the aesthetics doctrine.
- **Cover on the Aesthetic style** is rewritten at compose time to the same
  doctrine, and the scene is **chosen in code by topic keywords** — the
  treatment's instrument as a still life (botox / tox / forehead → syringe +
  vial; filler / lips / jaw → syringe + cannula; microneedling → pen; laser →
  handpiece; peel → dropper; routine / SPF → bottles), an empty room for
  visit / consult topics, a non-facial skin macro for neck / hands / texture
  topics. **The topic text itself never reaches Flux**: given "still life OR
  room OR skin, whichever fits: Botox for forehead lines — what happens at the
  appointment", Flux drew a full AI face with a syringe at the eye (2026-08-26).
- **Runner review adds to the reject list:** any eyes or a full face in a skin
  macro; a needle in skin / blood; a 3D render or teal-amber regenmed grade on
  an aesthetics post; a brand label on a product.

---

## 6. WORKFLOW NOTE

Text (voice + shape + spacing) comes from the **writer/splitter prompts**
(`lib/agents/writer.ts`, `lib/posts/splitter.ts`). Visual assembly + design
elements + panel-fit come from the **Canva compose-runner**
(`~/.claude/skills/canva-compose-runner/SKILL.md`), which copies a style example
and swaps photos + text only. Server-side Canva autofill does NOT work — see
`HANDOFF-MODULES.md`. Perfect a post by hand first, then promote its patterns
into these two places so the machine reproduces them.
