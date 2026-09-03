// The format catalog — "HOW we say it", as opposed to the content plan's
// "WHAT we talk about this week" (Igor 2026-08-19).
//
// One registry, three consumers: the planner picks a format per planned post,
// the marketer can override it with a button in the Content Plan / New Post
// panels, and `ensureDefaultScriptTemplates` seeds each clinic's
// `script_templates` rows from it so the Writer has the scaffold to follow.
// Add a format HERE and it appears in all three places.
//
// Trimmed 9 → 5, then "Treatment explainer" added back as the 6th
// (Igor 2026-08-31). Retired: "System critique" and "Expert
// secrets" (both ran on "the system / other doctors are wrong", which POST-CRAFT
// §1 forbids — the post names the hard part to help the reader understand it,
// never to indict their old doctor); "Medicine philosophy" (doctor-as-hero,
// against the planner's binding "the reader is the hero of every topic" rule);
// "Diagnostic deep-dive" (a duplicate of Educational explainer — the planner
// itself offered them interchangeably for mechanism topics). Its one distinct
// door — entering through a symptom the reader feels, and the wrong story they
// were told — moved into Educational explainer. Retiring a name here does NOT
// deactivate the `script_templates` rows already seeded for a clinic: see
// supabase/migrations/053_retire_post_formats.sql.
//
// "Treatment explainer" is the only format that lands on a service the clinic
// sells — the client asked for a post that references one, and nothing in the
// catalog obliged a post to. It is still a TEACHING post (Igor 2026-09-01): the
// mechanism and the do-it-yourself beat come first and stand on their own, and
// the service is explained in exactly one beat rather than spread across the
// post. The ratio was first written as "two slides in three" and fought the
// arc it governs — six body slides split three/three — so it now names the
// slides instead of a fraction (2026-09-03). Frequency is
// not hardcoded anywhere: the planner's rotation ceiling scales with the
// catalog, so at 6 formats it lands 2-5 times per 24-post plan.

export type FormatLengthBias = 'short' | 'long' | null

export interface PostFormat {
  /** Canonical name — stored in content_plan_topics.format and script_templates.name. */
  name: string
  /** Short button text for the UI. */
  label: string
  /** One line the marketer reads on hover: what this format is for. */
  hint: string
  /** Longer line handed to the Writer as the template description. */
  description: string
  /** The structural beats the Writer follows. */
  scaffold: string
  length_bias: FormatLengthBias
  /**
   * How this format's COVER TITLE is built (Igor 2026-08-20). The big cover
   * headline carries the FORMAT's promise — "Four Things To Know", "Three
   * Myths" — never the bare topic word, which already lives in the style pill.
   * Handed to the Writer whenever the format is pinned.
   */
  coverTitle: string
  /**
   * Replaces the default carousel SLIDE ARC for this format (Igor 2026-08-19).
   *
   * Without this the format only tinted the voice: the universal arc
   * (mechanism → analogy → evidence → who it's for) still decided the slides,
   * so "Practical tips" came out as an explainer carrying one checklist slide
   * instead of the list post people actually save and send on. Formats that
   * ARE a structure own their arc here. Formats that are an angle
   * (Educational explainer, Patient story, …) leave it unset
   * and keep the default arc, which is already the right shape for them.
   */
  carouselArc?: string
}

export const POST_FORMATS: PostFormat[] = [
  {
    name: 'Educational explainer',
    label: 'Educational',
    hint: 'How it actually works — real science, said simply. Enters through the mechanism or through a symptom the reader feels.',
    coverTitle: `"How X Actually Works" / "What X Really Does" — the mechanism promise in plain words, where X is the everyday name of the thing (not an acronym). When the post enters through a symptom, the title is that symptom as the reader says it, phrased as the question the post answers: "Why You're Always Tired"`,
    description:
      'Teach one mechanism properly. Scientific in substance, plain in language — the reader should be able to repeat it to a friend.',
    scaffold: `[Hook — a concrete fact about the mechanism, stated flatly. No teaser, no "here's why". Or enter through the symptom instead: the question a patient types into Google at 2am, in their own words.]
[The wrong story — what most people are told about this, in one line. OPTIONAL: only when a common wrong story actually exists. Correct it with the fact, never with mockery.]
[The everyday picture — one comparison a non-medical reader already understands. Keep the same comparison for the whole post; do not stack metaphors.]
[The mechanism, step by step — what happens first, what that causes, what that causes. Name the real structures (the cell, the hormone, the tissue) and unpack each term in the same sentence you use it.]
[What the research shows — one real study or body of evidence, with what it measured and how much. Numbers stay in the range the source actually reports. Never "studies show" without a source.]
[What this changes for the reader — the one practical consequence of understanding the mechanism.]
[CTA — a single specific next step.]`,
    length_bias: null,
  },
  {
    name: 'Practical tips',
    label: 'Tips',
    hint: 'Top 3-5 useful things the reader can do — the format people save and send to a friend.',
    coverTitle: `"Four Things To Know" / "Five Ways To Protect Your Skin" — the COUNT is the first word and MUST match the real number of tips in the post`,
    description:
      'A short numbered list of genuinely useful, specific actions. This is the shareable format: each item must be something the reader can do this week, not a slogan.',
    scaffold: `[Hook — name what the list gives the reader, concretely ("Five things that decide how your skin ages" beats "Skincare tips").]
[Tip 1 — the action in the first few words, then ONE sentence on why it works (mechanism or evidence, not motivation).]
[Tip 2 — same shape. Specific enough to act on today: what, how much, how often.]
[Tip 3 — same shape. Include the one most people get wrong.]
[Tips 4-5 — optional; only if each earns its place. Three strong beats five padded.]
[The one that matters most — name it and say why, so the list has a spine instead of five equal items.]
[CTA — a single specific next step.]

Hard rules for this format: every tip is doable without buying anything from the clinic; no promised outcomes or timelines ("you will lose", "in 2 weeks"); no ranking of treatments by effectiveness.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post is a LIST, not an explainer:
  Slide 1   Cover        — name what the list gives the reader and how many items, concretely ("Five things that decide how your skin ages", not "Skincare tips"). No swipe prompt.
  Slides 2-N ONE TIP PER SLIDE — 3 to 5 tips, never more. Each slide: the heading IS the action (imperative, 2-5 words); the body is ONE sentence on why it works — a mechanism or a real finding, never motivation; then the specifics the reader needs to act this week (what, how much, how often) as at most 3 short sub-points. A tip that cannot be acted on without buying something from the clinic does not belong in this post.
  Slide N+1 The one that matters most — name which of the tips carries the most weight and why, so the list has a spine instead of N equal items.
  Final     CTA stack    — see CTA STACK FORMAT below.

Do NOT add a deep mechanism slide, an analogy slide, or a standalone evidence
slide — the evidence lives inside the tip it supports, in one line. Three strong
tips beat five padded ones: drop an item rather than pad it. Every tip must be
distinct — two phrasings of the same advice is one tip.`,
    length_bias: null,
  },
  {
    name: 'Warning signs',
    label: 'Warning signs',
    hint: "Signals worth checking — basic tests to ask for, and when to see a doctor. Never a diagnosis.",
    coverTitle: `"Signs Worth Checking" / "Three Signs To Take Seriously" / "What's Normal And What Isn't" — calm, never alarmist. No "Don't Ignore These", no urgency framing`,
    description:
      'The signals a reader should not sit on, what a basic work-up would look like, and when to book. Informational — it tells people to get checked, it never tells them what they have.',
    scaffold: `[Hook — name the thing people wave off, in the reader's own words ("Tired by 3pm every day" beats "Fatigue").]
[Why it gets ignored — one sentence on why this signal reads as normal life.]
[Signal 1 — what it feels or looks like day to day, and what system it can point to. "Can point to", never "means".]
[Signal 2 — same shape.]
[Signal 3 — same shape. End the list here; more than three reads as a symptom checker.]
[What to actually do — the basic, widely-available work-up to ask for by name (the standard labs / the standard exam), so the reader walks into an appointment knowing what to request.]
[When it is urgent — the short list of things that mean today, not next month.]
[CTA — book an evaluation, framed as getting an answer rather than getting a treatment.]

Hard rules for this format: this post says GET CHECKED, never "you have X". No line may let a reader self-diagnose or self-treat. Do not imply the clinic's treatment is the answer to the signals — the answer is a work-up. Keep the fear out: plain, calm, factual. No scare statistics, no "silent killer".`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post sends the reader to get CHECKED:
  Slide 1   Cover        — the signal in the reader's own words, the thing they wave off ("Tired by 3pm every day", not "Fatigue"). No swipe prompt.
  Slide 2   Why it gets ignored — one short slide on why this reads as normal life.
  Slides 3-5 ONE SIGNAL PER SLIDE — exactly three, no more (a longer list reads as a symptom checker). Each: what it looks or feels like day to day, then what system it CAN POINT TO. "Can point to", never "means", never "you have".
  Slide 6   What to ask for — the basic, widely available work-up named specifically (the standard labs / the standard exam), so the reader walks into an appointment knowing what to request. This slide is the point of the post.
  Slide 7   When it's urgent — the short list of things that mean today, not next month.
  Final     CTA stack    — an evaluation framed as getting an ANSWER, not getting a treatment.

HARD for this format: no line may let a reader self-diagnose or self-treat. Do
not imply the clinic's treatment is the answer to the signals — the answer is a
work-up. No scare statistics, no "silent killer", no death counts. Calm and
factual: this is the tone of a doctor saying "worth checking", not an ad.`,
    length_bias: null,
  },
  {
    name: 'Myth-busting',
    label: 'Myths',
    hint: 'Three things people believe about this topic that are wrong — with the fact that replaces each.',
    coverTitle: `"Three Myths About Testosterone" — count + "Myths"; add the topic word only if it fits in plain language, otherwise just "Three Myths"`,
    description:
      '"You have probably heard X. Here is why that is wrong." Three myths max.',
    scaffold: `[Hook — name the topic and promise to debunk what people think they know.]
[Myth 1 — quote the myth, then in one or two sentences show why it is wrong with a fact, not an opinion.]
[Myth 2 — same shape. Concrete fact, no jargon.]
[Myth 3 — same shape. End with what is actually true.]
[CTA — for someone who thought they understood this.]`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order):
  Slide 1   Cover        — name the topic and that what most people believe about it is wrong. No swipe prompt.
  Slides 2-4 ONE MYTH PER SLIDE — exactly three. Each: quote the myth as people actually say it, then replace it with the fact in one or two sentences — a named study, a date, a mechanism. A myth is only worth a slide if it is genuinely common AND genuinely wrong.
  Slide 5   What's actually true — the one sentence a reader should leave with, and what it changes for them.
  Final     CTA stack    — for someone who thought they understood this.

Do NOT add a separate analogy or "who it's for" slide — the myths carry the post.
Correct with facts, never with mockery: the reader believed these things for a
reason, and naming that reason is what makes the correction land.`,
    length_bias: null,
  },
  {
    name: 'Patient story',
    label: 'Patient story',
    hint: 'An anonymised case the doctor sees every week, told as a small narrative.',
    coverTitle: `"The Patient Who Tried Everything" — a one-line story hook about the person, no names`,
    description:
      'Anonymised case the doctor sees often, told as a small narrative.',
    scaffold: `[Hook — one line that sets up the patient: who they are, what they came in for. No names.]
[What they had already tried — be specific so the audience recognises themselves.]
[The turning point — the question or test or insight that changed the plan.]
[What we did and why it worked — mechanism, not testimonial.]
[CTA — for someone who recognises themselves in this story.]`,
    length_bias: null,
  },
  {
    name: 'Treatment explainer',
    label: 'Treatment',
    hint: 'The mechanism behind a problem, what to do about it at home, and the one clinic service that starts where home care stops.',
    coverTitle: `"Why Your Knee Still Hurts After Six Months Of Rest" / "What A Chemical Peel Actually Does" — the reader's situation in their own words, or the treatment in plain patient language. Never the clinic's name, never a price, never "book now"`,
    description:
      'Teach the mechanism first, give the reader what they can do on their own, then name the ONE clinic service that picks up where that stops. The teaching half stands on its own — a reader who stops before the service still leaves with something usable.',
    scaffold: `[Hook — the reader's situation in their own words, not the treatment ("Six months of rest and the knee still gives out" beats "Introducing PRP").]
[What's actually going on — the mechanism, at the depth of an Educational explainer: name the real structure and unpack each term in the same sentence you use it.]
[What helps on your own — two or three specific things worth doing without the clinic: what, how much, how often. A reader who never books must leave with this.]
[Where that stops — the point self-care cannot get past, and WHY, in the same mechanism. Be fair to it; a post that trashes home care to sell a treatment fails.]
[The treatment — exactly ONE service from the clinic's Services list, named plainly: what it physically does to that same mechanism. One beat, not the post.]
[Who it fits, who it doesn't — concrete situations on both sides. Never drop the second half: it is what separates this from an ad.]
[What the visit is like, then the CTA — how long, how many sessions are typical, what recovery looks like, in ranges. The Book line names the service.]

Hard rules for this format: ONE service per post, never a menu, and it is EXPLAINED in exactly one beat — the fifth. The two beats after it qualify the reader and set expectations; they do not sell it again, and nothing before it may name it. No prices, no packages, no discounts, no urgency ("limited time", "spots left"). No before/after claims, no outcome promises, no timeline stated as a certainty — "results typically last", never "you will". Every therapeutic claim carries a hedge. Nothing may say or imply the treatment cures, permanently removes, or is the only option.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post TEACHES, and the clinic's service is one slide inside it:
  Slide 1   Cover        — the reader's situation in their own words, or the treatment in plain patient language. No clinic name, no price, no "book now". No swipe prompt.
  Slide 2   Mechanism    — what is actually going on, at full explainer depth. The deepest slide; never thin it.
  Slide 3   What you can do yourself — 2-3 specific actions with the what/how much/how often, one per line with breathing room. Nothing here may require the clinic.
  Slide 4   Where that stops — the point self-care cannot get past, and why, in the same mechanism.
  Slide 5   The treatment — ONE service from the clinic's Services list and what it physically does to that mechanism. The ONLY slide that explains the service.
  Slide 6   Who it's for / who it isn't — both halves on one slide, concrete situations. Never drop the second half.
  Slide 7   What the visit is like — how long, how many sessions are typical, what recovery looks like. Ranges, never promises.
  Final     CTA stack    — the Book line names the service.

Slides 2-4 belong to the reader and must stand on their own: someone who
stops before slide 5 still leaves with a mechanism they understand and
something they can do this week. The service is explained on slide 5 and
nowhere else — slides 6 and 7 qualify it and say what to expect, they do not
sell it again. ONE service per post, never a menu. No prices, no packages, no
urgency, no before/after, no outcome promises. The reader must be able to
finish this post and decide the treatment is NOT for them — if that reading is
impossible, this is an ad, not a post.`,
    length_bias: null,
  },
]

export const FORMAT_NAMES = POST_FORMATS.map((f) => f.name)

export function getFormat(name: string | null | undefined): PostFormat | null {
  if (!name) return null
  const needle = name.trim().toLowerCase()
  return POST_FORMATS.find((f) => f.name.toLowerCase() === needle) ?? null
}

export function isKnownFormat(name: string | null | undefined): boolean {
  return getFormat(name) !== null
}

/** What the buttons render — no scaffolds, so this can cross to the client. */
export const FORMAT_CHOICES: Array<Pick<PostFormat, 'name' | 'label' | 'hint'>> =
  POST_FORMATS.map(({ name, label, hint }) => ({ name, label, hint }))
