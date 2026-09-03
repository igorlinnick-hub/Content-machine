# Ads craft — the paid-spot script

Binding for anything generated through an **ad format**. The organic craft
bible is [POST-CRAFT.md](POST-CRAFT.md); this is its paid counterpart, and
where the two disagree for an ad, this wins.

The machine-readable version — the one the Writer and the Critic actually
read — is [`lib/scripts/ad-formats.ts`](../lib/scripts/ad-formats.ts). Change a
rule there, not here; this file explains *why* the rules are what they are.

## Where these rules come from

A teardown of four high-performing doctor ad spots cut by @benimedia
(dental / oral-maxillofacial, August 2026). Each reel is a NO-Edit-vs-FINAL
split screen selling the agency's editing, but the **audio is the doctor's real
ad script** — which is what we mined.

| Ref | Subject | Runtime | Words | Words/sec | Engagement |
|---|---|---|---|---|---|
| [DbbSRoguxoS](https://www.instagram.com/p/DbbSRoguxoS/) | Full arch restoration | 31s | 108 | 3.5 | 2 521 ♥ / 889 💬 |
| [DbJZyo7OHHt](https://www.instagram.com/p/DbJZyo7OHHt/) | Veneers vs aligners | 46s | 131 | 2.8 | 1 177 ♥ / 523 💬 |
| [DaV0WZ5O0x_](https://www.instagram.com/p/DaV0WZ5O0x_/) | What an OMS does | 25s | 77 | 3.1 | 4 180 ♥ / 1 181 💬 |
| [DaI3J04ON3c](https://www.instagram.com/p/DaI3J04ON3c/) | Bone grafting | 42s | 130 | 3.1 | 5 061 ♥ / 4 752 💬 |

**The headline number: 77–131 words.** Our organic `short` target is 200–220.
An ad is roughly half an organic script, which is why the `'ad'` length target
exists rather than reusing `short` — a correct ad shape stretched to 210 words
stops being an ad.

The speech rate is 2.8–3.5 w/s. That is *slow* for social, and deliberately so:
unhurried delivery is most of what reads as authority. When a script runs long,
cut a beat — never speed up the read.

## The eleven invariants

Every one of the four obeys all of these. They are encoded verbatim as
`AD_CRAFT_RULES`.

1. **No engagement bait in the spoken lines** — zero instances across all four.
   The CTA lives in the caption and the ad unit; the doctor's voice never asks
   for a tap. This is the rule most likely to be violated by a model trained on
   generic ad copy, and it is a hard fail in the Critic.
2. **The hook is a flat declarative with a stance** — never a question, never
   an opening statistic, never a count-promise, never a command.
3. **Real clinical name in the first sentence**, translated immediately.
4. **Self-recognition, not pain-agitation** — observable facts of daily life
   ("dentures that slip that you have to take out"), never prescribed emotion.
5. **Exactly one concrete specification** — one count, material property or
   training fact. One reads as expertise; three read as a brochure.
6. **Mechanism, short, always present** — and for an ad it *is* the science
   beat. A cited study does not fit at this length.
7. **The result is in ordinary verbs** — "you brush them, you eat with them".
   Abstract-noun payoffs ("confidence", "freedom") are the clearest tell of ad
   copy and are a tone failure.
8. **One anaphora, one time** — the repeated stem the editor cuts captions to.
9. **There is a list beat** — the rapid-fire enumeration the editor turns into
   the b-roll montage. Without it there is nothing to cut to.
10. **Pronoun discipline** — "I" for stance, "we" for capability, "you" for the
    viewer's body.
11. **No close, or a quiet one** — three of four simply stop.

## The four shapes

Each reference turned out to be a *different* ad, not four takes on one.

### 1. Procedure offer — `Offer`
Opens on a **verdict**. Names a service the local audience does not know is
available, qualifies with observable facts, ends on the after in plain verbs.
The workhorse.

> Full arch restoration is one of the most life-changing procedures in
> dentistry. I want more people in the Antelope Valley to know that it exists
> and that it's available right here. If you're missing most or all of your
> teeth, or if you're wearing dentures that slip that you have to take out, and
> if it makes eating and laughing feel like a chore — there is a permanent
> solution. Using as few as four strategically placed implants, we can anchor a
> full fixed arch of teeth that you never have to remove. You brush them, you
> eat with them, you even forget they're not your original teeth.

### 2. Honest gatekeeper — `Gatekeeper`
Opens **in medias res**, mid-argument. Draws the line where the procedure
genuinely belongs, then **tells a large share of the audience they may not need
it** and names the cheaper alternative. It sells by disqualifying.

> For many people who inquire about veneers, the answer is they may not need
> them. If your enamel is healthy and your concern is position and colour,
> clear aligners and supervised in-office whitening will often deliver the
> result without touching tooth structure.

This is the shape nothing in `POST_FORMATS` can produce, and it is also the
**safest ad we can run**: the persuasive move is a de-sell, so the compliance
gate has almost nothing to catch. The de-sell has to cost the clinic something
real, or the format has no engine.

### 3. Scope and credentials — `Credentials`
Opens on a **knowledge gap**. The shortest shape (25s) and the one for cold
traffic that does not know the specialty exists. Its list beat names five to
seven services and explains none of them — the speed is the point.

> Dental implants, tooth extractions, wisdom teeth, biopsies of oral lesions,
> facial trauma, corrective jaw surgery. And because my residency was
> hospital-based, what separates this from general dental care is the depth of
> medical and surgical training behind every decision I make.

### 4. Defuse the fear — `Defuse`
Opens on a **reframe** that swaps the category of the thing. For procedures
people decline because the word sounds violent. The only shape that closes out
loud.

> Bone grafting may sound intimidating, but what it actually is is preparation.
> […] The material we use integrates with your body's own biology over time,
> and what grows back is real living bone. […] There's always a way forward.

Note *why* "real living bone" works: it is literally accurate. An invented
equivalent would be both a lie and a compliance violation.

## What the four have in common visually

Worth knowing for the shoot brief, even though the script agent does not own it:
the doctor is filmed **inside the clinic**, static mid-shot, no camera moves. All
motion comes from post — animated word-level captions, 3D anatomy renders, and
stock cutaways over the list beat. The script's job is to *give the editor a list
beat and an anaphora to cut against*.

## How it is wired

- `lib/scripts/ad-formats.ts` — the registry: four formats + `AD_CRAFT_RULES`.
- `types/index.ts` — `ScriptLengthTarget` gained `'ad'` (90–140 words / 25–45s).
- `lib/agents/writer.ts` — `LENGTH_SPECS.ad` (no beat budget: the format owns
  the beats, and there is no CTA beat); `runWriter({ adFormat })` outranks
  `pinnedFormat`, `formatOverride` and the plan's format, and forces `'ad'`.
- `lib/agents/critic.ts` — `LENGTH_BANDS.ad` + `AD_RUBRIC_OVERRIDE`: mechanism
  satisfies `science_present`; a question hook fails; engagement bait in the
  spoken script is a hard fail.
- `app/api/agents/generate/route.ts` — accepts `adFormat`, validated against
  the registry (unknown name degrades to a normal organic run).
- `app/components/AdFormatPicker.tsx` — four chips in the script generator.
- `supabase/migrations/051_scripts_ad_length_target.sql` — widens the
  `scripts.length_target` check from `('short','long')` to include `'ad'`, so an
  ad script can record its own band instead of saving as null.

**Ads are deliberately absent from `POST_FORMATS`**, so the planner can never
schedule one into the weekly content plan: ads are bought, not planned.
