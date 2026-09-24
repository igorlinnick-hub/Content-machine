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
// "One thing" is the 7th, added 2026-09-07 off a reference-reel teardown
// (@yanadix): a single non-obvious correction, taught properly, outperforms
// five pieces of advice the reader already knew. It is the format to reach for
// when a "Practical tips" post would have had one real tip and four fillers —
// which is why the obvious-advice test now sits in BOTH formats and points
// here. Every format also carries a `hookShape` now, the organic counterpart
// to `AdFormat.hookShape`; see the hook-shape section below the catalog.
//
// "Vague vs specific" is the 8th, same date and same teardown: three pairs of
// "what you hear" / "what actually does something". It is written on the edge
// POST-CRAFT §1 patrols — the retired "System critique" and "Expert secrets"
// died for aiming at the people who give the advice — so its rules aim only at
// the missing SPECIFIC, and the general half is always treated as true.
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
  /**
   * The shape of the FIRST LINE — the organic counterpart to
   * `AdFormat.hookShape` (Igor 2026-09-07). Ads have carried a per-format hook
   * shape since 2026-08-20; organic scripts had one generic line ("concrete
   * fact or question") for every format, and came out sounding the same.
   *
   * Two of the shapes below come from a teardown of a reference reel
   * (@yanadix, Sep 2026): open on the MISTAKE the reader is making, not on the
   * topic ("If you add oil to the pasta water so it doesn't stick, you're
   * making a big mistake" beats "How to cook pasta"), and open on the STATE
   * the reader can recognise, not on the process ("My hair went silky when
   * I…" beats "I wash my hair with this shampoo"). Both are retention moves;
   * for a clinic the second one must stay a recognisable state, never a
   * promised outcome — see the hard line in HOOK_SHAPE_RULES.
   */
  hookShape: string
  /**
   * `clinics.niche` values allowed to use this format. Undefined = every
   * clinic, which is every HWC format. Mirrors `stylesForNiche()`: a niche
   * that declares its own formats sees ONLY those. Yedino sells to clinics
   * rather than treating patients, so none of the clinical formats fit it and
   * none of its formats belong in a clinic's planner.
   */
  niches?: string[]
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
    hookShape:
      'A CONCRETE FACT ABOUT THE MECHANISM, stated flatly — the sentence IS the information, not an announcement of it. "Your skin makes a quarter less collagen at 40 than it did at 25." Or enter on the SYMPTOM in the reader\'s own words, phrased as the question they typed at 2am: "Why you wake up at 3am every night." Never a definition, never "let\'s talk about X".',
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
    hookShape:
      'THE MISTAKE, NOT THE TOPIC. Open on the thing the reader is doing wrong right now, in one flat sentence, and let the list be the correction: "If you stretch a sore lower back first thing in the morning, you are making it worse." Never open on the subject word ("Let\'s talk about back pain") and never on the count alone ("Five tips for your back") — the count belongs on the cover, not in the first spoken line.',
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

Hard rules for this format: every tip is doable without buying anything from the clinic; no promised outcomes or timelines ("you will lose", "in 2 weeks"); no ranking of treatments by effectiveness.

THE OBVIOUS-ADVICE TEST (HARD — apply it to every tip before you keep it): advice the reader has already heard a hundred times is not advice, it is filler. "Drink more water", "eat more fibre", "move more", "sleep eight hours", "reduce stress", "eat a balanced diet", "wear sunscreen", "listen to your body" — none of these earns a slide on its own, and a list made of them is the single most common way this format fails. A tip survives only if it carries something the reader did NOT already know: a mechanism, a number, a specific technique, a threshold, or the common way people get it wrong. Test each one: could the reader have written this tip themselves before reading the post? If yes, cut it or replace it with the specific version of itself — not "eat more fibre" but which kind and how much before it changes anything; not "move more" but the one movement that loads the tissue in question. THREE tips that pass beat five that do not, and one that passes beats three that do not — if only one survives, the post should have been the "One thing" format instead.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post is a LIST, not an explainer:
  Slide 1   Cover        — name what the list gives the reader and how many items, concretely ("Five things that decide how your skin ages", not "Skincare tips"). No swipe prompt.
  Slides 2-N ONE TIP PER SLIDE — 3 to 5 tips, never more. Each slide: the heading IS the action (imperative, 2-5 words); the body is ONE sentence on why it works — a mechanism or a real finding, never motivation; then the specifics the reader needs to act this week (what, how much, how often) as at most 3 short sub-points. A tip that cannot be acted on without buying something from the clinic does not belong in this post.
  Slide N+1 The one that matters most — name which of the tips carries the most weight and why, so the list has a spine instead of N equal items.
  Final     CTA stack    — see CTA STACK FORMAT below.

Do NOT add a deep mechanism slide, an analogy slide, or a standalone evidence
slide — the evidence lives inside the tip it supports, in one line. Three strong
tips beat five padded ones: drop an item rather than pad it. Every tip must be
distinct — two phrasings of the same advice is one tip.

THE OBVIOUS-ADVICE TEST (HARD): a slide whose tip the reader could have written
themselves before opening the post is a wasted slide. "Drink more water", "move
more", "sleep more", "reduce stress", "eat a balanced diet" are not tips. Each
tip must carry something new — a mechanism, a number, a technique, a threshold,
or the way people usually get it wrong. Cut an item rather than ship an obvious
one; a three-slide list that teaches beats a five-slide list that reassures.`,
    length_bias: null,
  },
  {
    name: 'Warning signs',
    label: 'Warning signs',
    hookShape:
      'THE SIGNAL AS THE READER WAVES IT OFF — their words, their week, said calmly and flatly. "Tired by 3pm every day, and you have decided that is just your normal." No question, no alarm, no statistic. The recognition is the hook; the calm is what makes it credible.',
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
    hookShape:
      'THE BELIEF, QUOTED THE WAY PEOPLE SAY IT, then flatly contradicted in the same breath: "Everyone will tell you to drink more water for dry skin. Water is not what your skin is short of." Quote it fairly — no mockery, no "most people think" strawman opener (POST-CRAFT bans that shape).',
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
    hookShape:
      'THE PERSON MID-SITUATION — one line that drops the reader into the appointment already happening. "She had done six months of physio and could still not carry her groceries up one flight." No names. No setup sentence before it; the situation IS the setup.',
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
    hookShape:
      "THE READER'S SITUATION IN THEIR OWN WORDS, or the failed-attempt line that names WHY the thing keeps coming back — mechanically, never as a verdict on anyone who treated them: \"Six months of rest and the knee still gives out.\" / \"The pain comes back because rest calms the inflammation and leaves the load that caused it.\" Never the service, never the clinic, never a price.",
    hint: 'The mechanism behind a problem, what to do about it at home, and the one clinic service that starts where home care stops.',
    coverTitle: `"Why Your Knee Still Hurts After Six Months Of Rest" / "What A Chemical Peel Actually Does" — the reader's situation in their own words, or the treatment in plain patient language. Never the clinic's name, never a price, never "book now"`,
    description:
      'Teach the mechanism first, give the reader what they can do on their own, then name the ONE clinic service that picks up where that stops. The teaching half stands on its own — a reader who stops before the service still leaves with something usable.',
    scaffold: `[Hook — the reader's situation in their own words, not the treatment ("Six months of rest and the knee still gives out" beats "Introducing PRP").]
[Why what they already tried came back — name the thing most people in this situation do first (rest, the brace, the anti-inflammatories, the cream, the stretch), say what it genuinely DOES, and then the part of the mechanism it leaves untouched, which is why the problem returned. This beat is mechanical, and it must be FAIR: the earlier attempt was reasonable and it worked on what it worked on. It is never a verdict on a doctor, a clinic, or the reader — name the move, never the person, and never imply the reader was treated wrongly or wasted their time.]
[What's actually going on — the mechanism, at the depth of an Educational explainer: name the real structure and unpack each term in the same sentence you use it. Carry on from the beat above rather than restarting: the untouched part IS the mechanism this post teaches.]
[What helps on your own — two or three specific things worth doing without the clinic: what, how much, how often. A reader who never books must leave with this.]
[Where that stops — the point self-care cannot get past, and WHY, in the same mechanism. Be fair to it; a post that trashes home care to sell a treatment fails.]
[The treatment — exactly ONE service from the clinic's Services list, named plainly: what it physically does to that same mechanism. One beat, not the post.]
[Who it fits, who it doesn't — concrete situations on both sides. Never drop the second half: it is what separates this from an ad.]
[What the visit is like, then the CTA — how long, how many sessions are typical, what recovery looks like, in ranges. The Book line names the service.]

Hard rules for this format: the "why it came back" beat names a MOVE, never a person or a practice — "rest calms the inflammation and leaves the load that caused it", never "your doctor treated the wrong thing", never "most clinics get this wrong". A post that indicts anyone has failed POST-CRAFT §1 regardless of how good the mechanism is. ONE service per post, never a menu, and it is EXPLAINED in exactly one beat — the one bracketed [The treatment], and nowhere else in the post. The two beats after it qualify the reader and set expectations; they do not sell it again, and nothing before it may name it. No prices, no packages, no discounts, no urgency ("limited time", "spots left"). No before/after claims, no outcome promises, no timeline stated as a certainty — "results typically last", never "you will". Every therapeutic claim carries a hedge. Nothing may say or imply the treatment cures, permanently removes, or is the only option.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post TEACHES, and the clinic's service is one slide inside it:
  Slide 1   Cover        — the reader's situation in their own words, or the treatment in plain patient language. No clinic name, no price, no "book now". No swipe prompt.
  Slide 2   Why it keeps coming back → mechanism — enter the mechanism through the attempt the reader already made. Name what most people try first, what it genuinely does, and the part of the mechanism it leaves untouched — which is why the problem returned — then teach that part at full explainer depth. This is ONE slide, not two, and it stays the deepest slide in the post; never thin it. Fair, never accusing: the earlier attempt was reasonable, and this slide is a verdict on a MOVE, never on a doctor, a clinic, or the reader.
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
  {
    name: 'One thing',
    label: 'One thing',
    hint: 'One specific, non-obvious thing that changes the outcome — the whole post is that one thing, explained properly.',
    hookShape:
      'THE MISTAKE, IN ONE FLAT SENTENCE — what the reader is doing right now that works against them, stated as fact, with the correction withheld for exactly one beat. "If you stretch a cramping calf by pulling your toes toward you, you are pulling on the part that is already too short." No question, no count, no "here is a tip". The mistake IS the hook; the post is the fix.',
    coverTitle: `"The One Thing That Actually Stops Night Cramps" / "The Mistake That Keeps Your Back Sore" — ONE thing, named. No count above one, no "tips", no bare topic word`,
    description:
      'The opposite of a list. One specific, non-obvious action or correction, taught to the depth a reader needs to actually do it — the mechanism behind it, exactly how to do it, and when it does not apply. Reach for it when a topic has one thing that carries most of the result and four things that do not.',
    scaffold: `[Hook — the mistake, flat and specific. What the reader does now, and the one-line reason it works against them. No teaser, no promise of what is coming.]
[The one thing — name it in a single sentence, concretely enough to picture. This is the whole post; do not delay it past the second beat.]
[Why it works — the mechanism, at the depth of an Educational explainer: name the real structure and unpack each term in the same sentence you use it. This beat is the post's spine — a reader who understands WHY will do it; a reader who is only told to will not.]
[Exactly how — the specifics that make it doable this week: what, how much, how often, in what position, for how long. Vague here means the post fails no matter how good the mechanism was.]
[When it does not apply — the situations where this is the wrong move, or where it will not be enough on its own. Never drop this beat: it is what separates teaching from a trick.]
[CTA — a single specific next step.]

Hard rules for this format: exactly ONE thing — a second one turns this back into a list and the format has failed. It must pass the obvious-advice test hard: if the reader could have written it themselves ("drink water", "stretch more", "sleep better"), there is no post here — pick a different angle or a different format. The thing must be doable without buying anything from the clinic, and must be safe to do unsupervised; anything that needs a clinician to judge it belongs in Treatment explainer, not here. No promised outcomes and no timelines — "this is what takes the load off the tendon", never "this will fix it in two weeks". The mistake in the hook belongs to the ADVICE the reader was given, never to a doctor who gave it: name the move, never the person.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post is ONE idea, not a list:
  Slide 1   Cover        — the mistake or the one thing, named. Never a count above one, never "tips". No swipe prompt.
  Slide 2   The mistake  — what the reader is doing now and the one-line reason it works against them. Flat and specific.
  Slide 3   The one thing — name it in a sentence, concretely enough to picture. Nothing else on this slide.
  Slide 4   Why it works — the mechanism, at full explainer depth. The deepest slide in the post; never thin it.
  Slide 5   Exactly how  — the what / how much / how often / how long, one per line with breathing room. A reader must be able to do it tonight from this slide alone.
  Slide 6   When it doesn't apply — where this is the wrong move, or where it will not be enough on its own. Never cut this slide.
  Final     CTA stack    — see CTA STACK FORMAT below.

Do NOT add a second "thing", a numbered list slide, or a tips slide — the whole
point of this format is that it refuses the list. If the topic genuinely needs
three items, it is a "Practical tips" post and should be written as one.`,
    length_bias: 'short',
  },
  {
    name: 'Vague vs specific',
    label: 'Specific',
    hint: 'Pairs — the general advice everyone gives, and the specific version of it that actually does something.',
    hookShape:
      'THE GENERIC ADVICE, QUOTED, then the flat reason it does not move anything: "Eat more fibre. Nobody ever says how much, and under about 25 grams a day it does not change transit time at all." Quote it as people actually say it, and land the second sentence on the missing SPECIFIC — never on who said it.',
    coverTitle: `"Eat More Fibre — And What That Actually Means" / "The Specific Version Of The Advice You Keep Getting" — names the general advice and promises the specific version. Never "what your doctor won\'t tell you", never "the truth about"`,
    description:
      'Three pairs. Each pair takes a piece of advice that is genuinely correct but too general to act on, and replaces it with the specific version — the amount, the technique, the threshold, the timing — plus the one-line mechanism that makes the specific version the one that works. The post never says the general advice is wrong; it says it is unfinished, and then finishes it.',
    scaffold: `[Hook — the generic advice quoted the way people actually say it, then the flat reason it does not move anything on its own.]
[Why general advice stays general — ONE sentence, and it is about the ADVICE, not about anyone who gives it: it has to be true for everybody, so it loses the number that makes it work. Do not make this beat about doctors, clinics, the internet, or "what they tell you".]
[Pair 1 — "What you hear:" the general version in the reader's words. "What actually does something:" the specific version, with the amount / technique / threshold / timing, and ONE line of mechanism or evidence for why the specific version is the one that works.]
[Pair 2 — same shape, a different piece of advice on the same topic.]
[Pair 3 — same shape. End the list here; a fourth pair turns the post into a list of tips.]
[The one that matters most — which of the three carries the most weight for this reader, and why.]
[CTA — a single specific next step.]

Hard rules for this format: the general advice is TRUE and is treated as true — the post finishes it, it never debunks it, and it never mocks it. If the general version is actually false, this is a "Myth-busting" post instead; if there is only one pair worth writing, it is a "One thing" post instead. Nothing in this post may indict a person or a profession: no "what your doctor won't tell you", no "most clinics get this wrong", no "the advice you've been given is useless" — POST-CRAFT §1 retired two formats for exactly that move, and this one is written on its edge. Every specific version must be safe to do unsupervised, doable without buying anything from the clinic, and hedged where the number varies between people ("for most adults, roughly…"). No promised outcomes, no timelines, no ranking of treatments.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post is PAIRS, not an explainer and not a myth list:
  Slide 1   Cover        — the general advice named, and the promise of its specific version. No swipe prompt.
  Slide 2   Why general advice stays general — one short slide, about the ADVICE and never about the people who give it.
  Slides 3-5 ONE PAIR PER SLIDE — exactly three. Each slide carries both halves: "What you hear" (the general version, in the reader's words, treated as true) and "What actually does something" (the specific version — the amount, technique, threshold or timing — plus ONE line of mechanism or evidence). Both halves on the same slide; the contrast is the whole design of this post.
  Slide 6   The one that matters most — which pair carries the most weight, and why.
  Final     CTA stack    — see CTA STACK FORMAT below.

The general half is never a strawman and never a joke: the reader has followed
that advice, and a slide that makes them feel stupid for it loses them. Do NOT
add a mechanism slide of its own — the mechanism rides inside each pair, in one
line. HARD: nothing on any slide may indict a doctor, a clinic, or a
profession; the target is always the missing SPECIFIC, never a person.`,
    length_bias: null,
  },
  {
    // The objection-map format (brief from the Yedino side, 2026-09-16). The
    // unit of content here is ONE question a patient asks before booking —
    // not a topic, not a service. Clinics answer the "do I even have this"
    // group well and almost never answer safety, cost or why-you; those are
    // the groups that decide whether the patient pays, which is the whole
    // reason this format exists.
    //
    // Named for the QUESTION, not the objection, on purpose: "objection"
    // frames the patient as an opponent and pulls the script toward defending
    // and toward blaming whoever did not answer — the exact move that retired
    // System critique and Expert secrets (POST-CRAFT §1).
    name: 'Patient question',
    label: 'Question',
    hint: 'Answers one question patients actually ask before booking — in their words, with a real answer.',
    hookShape:
      'THE QUESTION, VERBATIM, IN THE PATIENT\'S WORDS, then the first piece of the answer — not a comment on the question. "How much does this cost? It is a course, not a single visit, and here is how the number is built." Ask it the way it is asked at the front desk or typed into a DM at midnight, never the clinical paraphrase ("patients often inquire about affordability"). BANNED in the hook and everywhere else: "nobody tells you", "no one puts that on a website", "they won\'t say" — the first live run of this format opened on exactly that line and it is an indictment of the industry, which is what retired two formats (POST-CRAFT §1). The silence is not the subject; the answer is.',
    coverTitle: `The question itself, in the patient's words, short enough to read at a glance — "What Does It Actually Cost?" / "Whose Cells Are These?" / "Can It Make Me Worse?". Never a count of questions, never "the answer they don't want you to hear"`,
    description:
      'One question a patient asks before they book, answered straight. Built for the groups clinics leave unanswered — is it safe, what does it cost and how long, why you and not someone else — where an evasive answer is worse than silence. The post says what is actually known, what it depends on, and where the honest limits are, so a patient deciding tonight can find the answer instead of calling to get it.',
    scaffold: `[Hook — the question, verbatim, in the patient's words. Then one flat line that it gets a straight answer here. Nothing about who has or has not answered it before.]
[Why people ask it — what actually sits behind the question: the fear, the previous experience, the thing they read at 2am. One or two sentences, in the patient's own frame. This is what makes the answer sound human instead of like an FAQ page.]
[The straight answer — the beat the whole format exists for. Give the real shape of it: the range, the structure, the sequence, the number of visits, whose cells, what is measured. Where it genuinely depends, say what it depends ON ("it depends on how long you have had it, and here is why that changes the plan") — "it depends" with nothing after it is a dodge, and a dodge is worse than never posting.]
[What it depends on / the honest limits — who this is not for, where it will not work, what is not promised, what happens if it does not work. A patient must be able to finish this post and correctly conclude "not me".]
[One next step — a single, specific, low-friction action. Never a discount, never a deadline, never "spots are limited".]

Hard rules for this format: ONE question per script — a second one makes it an
FAQ roundup and the answer stops being findable, which is the entire point.
THE SCRIPT ANSWERS THE QUESTION ITSELF, in the clinic's own voice. Two failures
came out of the first live run and both are banned: a list of questions the
patient should go ask somebody ("four things to ask before you book") is a
"Practical tips" post, and one patient's story about the question is a
"Patient story" post — in this format the clinic is the one being asked, and it
answers. If the honest answer genuinely depends on the patient's insurance or
their starting point, the script still gives the structure, the part that is
knowable, and what decides the rest.
Answer the question that was asked, in the order the patient cares about: the
number, the risk or the name FIRST, the explanation second. Never indict anyone
for not having answered it — not other clinics, not "the industry", not the
patient's previous doctor; the target is the QUESTION, never a person or a
profession (POST-CRAFT §1 retired two formats for that move). Cost questions:
state structure and ranges honestly, with no discount, no urgency, no financing
pitch, and no claim about value for money. Safety questions: never say "safe"
or "no risks" — name the actual risks, the actual monitoring, and what happens
if there is a reaction; hedge outcomes ("most patients", "may"), never promise
one. Never print a count of questions or a question number in the script — the
numbering is our internal library, not the patient's business.`,
    carouselArc: `SLIDE ARC FOR THIS FORMAT (in order) — this post answers ONE question:
  Slide 1   Cover        — the question itself, in the patient's words, short. No swipe prompt, no question number, no count, and never "nobody tells you".
  Slide 2   Why it's asked — what sits behind the question: the fear, the prior experience, what they read. In the patient's frame, never defensive.
  Slides 3-4 The answer  — the straight one. Ranges, structure, sequence, whose cells, what is measured — the concrete half on slide 3, what it depends on and why that changes things on slide 4. Never split the answer so the reader has to swipe to learn whether they got one.
  Slide 5   Honest limits — who it is not for, where it will not work, what is not promised, what happens if it does not work.
  Final     CTA stack    — see CTA STACK FORMAT below. One step, no discount, no deadline.

The cover is the question and nothing else: a cover that teases the answer
("The truth about what regenerative treatment really costs") turns a findable
answer into bait, and findability is what this format sells. HARD: no slide may
indict another clinic, a profession, or the patient's previous doctor, and no
slide may carry a question count or number.`,
    length_bias: 'short',
  },
  // ── Yedino Systems (niche 'yedino') — B2B, doctor-facing ──────────
  // Audience: owners of regenerative-medicine practices (stem cell, BHRT,
  // neuropathy and the like). They are doctors, not patients: the post never
  // teaches medicine, it talks about the practice. Four formats, all SHORT —
  // the master carries little text (docs/YEDINO-STYLE.md §13).
  {
    name: 'Why it matters',
    label: 'Why',
    niches: ['yedino'],
    hookShape:
      'THE STATE THE DOCTOR ALREADY LIVES IN, stated flatly — something true about their month that they can check against their own numbers. "Your best month this year came from one referral, and you cannot explain why it happened." Never open on the subject ("branding is important for clinics"), never on us.',
    hint: 'One reason growing the practice\'s own name changes its economics.',
    coverTitle: `The consequence in plain words — "Why Referrals Dry Up" / "The Patients Who Never Call". Names what the doctor sees, not what we sell.`,
    description:
      'Make ONE argument for why a practice with its own audience runs differently from one without. Concrete and economic — where patients come from, what they cost, what happens when the source stops. Never a lecture about marketing.',
    scaffold: `[Hook — a flat sentence about the doctor's own month. No "in today's digital world".]
[The mechanism — why that happens, in one plain line. The practice has no audience of its own, so every patient is rented from someone else.]
[What it costs — the consequence, stated once, concretely.]
[What changes when it is fixed — the shape of the difference, never a promised number.]
[CTA — one specific next step.]`,
    length_bias: 'short',
  },
  {
    name: 'Objection',
    label: 'Objection',
    niches: ['yedino'],
    hookShape:
      'THE OBJECTION IN THE DOCTOR\'S OWN WORDS, quoted flat and without a setup: "I do not have time to be on camera." Never soften it, never strawman it, never answer it in the same line.',
    hint: 'Name what the doctor actually says out loud, then answer it straight.',
    coverTitle: `The objection itself, in quotes — "I Don't Have Time For This"`,
    description:
      'Take one real objection seriously and answer it without defensiveness. The objection is treated as REASONABLE — it usually is. No pressure, no "but actually", no implying the doctor is behind. If the honest answer is "then this is not for you", say that.',
    scaffold: `[Hook — the objection, quoted, nothing else.]
[Why it is fair — grant the part that is true, in one line. This is not a concession tactic; it has to be genuinely true.]
[What is actually being asked — restate the objection as the real underlying question.]
[The straight answer — what is actually required of them, concretely. Minutes, not adjectives.]
[CTA — one specific next step.]`,
    length_bias: 'short',
  },
  {
    name: 'One fix',
    label: 'One fix',
    niches: ['yedino'],
    hookShape:
      'THE MISTAKE, NOT THE TOPIC — the thing the practice is doing right now that works against it, in one flat sentence. "Your front desk answers Instagram DMs once a day, at the end of the shift." Never the count, never the subject word.',
    hint: 'One concrete change the practice can make this week — even without us.',
    coverTitle: `The fix as an instruction — "Answer The DM In An Hour" / "Film Before The First Patient"`,
    description:
      'Give away ONE thing that actually works, specific enough to do on Monday. It must stand on its own for a practice that never hires us — a tip that only works if you buy something is an ad, not advice.',
    scaffold: `[Hook — the mistake, flat.]
[Why it costs them — one line, concrete.]
[The fix — exactly what to do, in a form someone can follow without asking a question.]
[The catch — the part that makes it hard to sustain, named honestly.]
[CTA — one specific next step.]`,
    length_bias: 'short',
  },
  {
    name: 'What it costs',
    label: 'Cost',
    niches: ['yedino'],
    hookShape:
      'A CONCRETE SCENE OR NUMBER FROM THEIR WEEK, stated flatly — "Your MA edits Reels after her shift, unpaid, on her phone." Real and checkable, never a statistic about the industry.',
    hint: 'The hidden cost of the current way of doing it.',
    coverTitle: `The cost named plainly — "What Doing It Yourself Costs" / "The Reel That Took Four Hours"`,
    description:
      'Show what the current arrangement actually costs in time, attention, or missed inquiries. Costs the reader can verify against their own week. Never invented figures, never a guaranteed saving.',
    scaffold: `[Hook — the scene or the number.]
[Where the time actually goes — the breakdown, two or three concrete pieces.]
[The second cost — the one nobody counts (the thing that does not get done instead).]
[What the alternative looks like — described as the arrangement, not as a promised result.]
[CTA — one specific next step.]`,
    length_bias: 'short',
  },
]
export const HOOK_SHAPE_RULES = `HOOK SHAPE — THE FIRST SPOKEN LINE (binding):

1. The hook is the reader's, not ours. It names something true about THEIR week — what they do, what they feel, what they were told. It never opens on the clinic, the doctor, the procedure, or the post itself ("Today we're talking about…", "Let's break down…").

2. Prefer the MISTAKE over the TOPIC. "How to cook pasta" is a subject; "If you add oil to the water so it doesn't stick, you're making a big mistake" is a hook. Name the thing the reader is doing that works against them, in one flat sentence, and let the post be the correction. The mistake belongs to the ADVICE they were given, never to a doctor who gave it — name the move, never the person.

3. Prefer the STATE over the PROCESS. Open on what the reader would recognise about their own body, not on what we do about it. "You wake up and walk to the kitchen holding the wall for the first twenty minutes" beats "PRP is an injection of your own platelets".

   HARD, and this is where this rule can go wrong for a clinic: the state in the hook is one the reader ALREADY LIVES IN and can check against their own week. It is NEVER a state we imply they will reach. "Your knees will stop hurting" is a promised outcome and a compliance violation; "Stairs are the part of the day you plan around" is the same hook done legally. If the first line could be read as a result the clinic is offering, it is the wrong first line.

4. The hook ends on the fact itself. Never on a teaser, never on a promise to explain, never on a count ("Five things about…" belongs on the cover, not in the first spoken line). When the hook ends on a question, the very next sentence answers it.

5. One hook, one idea. A first line carrying two claims is a paragraph with the punctuation removed.`

/**
 * The hook-shape block handed to the Writer. When a catalog format is pinned,
 * ITS shape binds; otherwise the Writer picks from the menu and different
 * variants must pick differently — variety in the first line is most of what
 * makes two variants feel like two options instead of one draft twice.
 */
export function buildHookShapeBlock(
  pinnedShape: string | null,
  niche?: string | null
): string {
  if (pinnedShape) {
    return `${HOOK_SHAPE_RULES}

THIS POST'S HOOK SHAPE (binding — the format owns it): ${pinnedShape}`
  }
  const menu = formatsForNiche(niche)
    .map((f) => `• ${f.name} — ${f.hookShape}`)
    .join('\n')
  return `${HOOK_SHAPE_RULES}

HOOK SHAPE MENU — pick ONE per variant, and pick a DIFFERENT one for each variant. These are the shapes each format opens on; the shape has to match the format the variant chose.
${menu}`
}

/**
 * The formats a clinic may use, given its `clinics.niche`. Exactly the shape
 * of `stylesForNiche()`: a niche that declares its own formats sees ONLY
 * those; everyone else sees the ungated catalog. Yedino's four B2B formats
 * never reach a clinic's planner, and the clinical formats never reach
 * Yedino's — its posts are about running a practice, not about medicine.
 */
export function formatsForNiche(niche: string | null | undefined): PostFormat[] {
  const normalized = (niche ?? '').trim().toLowerCase()
  const own = POST_FORMATS.filter((f) => f.niches?.includes(normalized))
  if (own.length > 0) return own
  return POST_FORMATS.filter((f) => !f.niches)
}

export function formatNamesForNiche(niche: string | null | undefined): string[] {
  return formatsForNiche(niche).map((f) => f.name)
}

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