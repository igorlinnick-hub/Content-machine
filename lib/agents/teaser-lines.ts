// Cliché detector for scripts / carousels (decided 2026-08-19): the machine
// must sound like a doctor across the desk, not an influencer script or ad copy.
//
// Two tiers, both fed to the Critic as "confirmed" hits:
//   • TEASER lines — sentences that ANNOUNCE content instead of carrying it
//     ("Here's why that's already too late.", "Let me explain.", "Stay with me.").
//     HARD: one hit → hook_quality ≤ 3, approved = false.
//   • CLICHÉ phrases — marketing / AI filler and strawman openers ("game-changer",
//     "at the end of the day", "Most people think…", "It's not X, it's Y").
//     SOFT: lowers tone_match; two or more → approved = false.
//
// These regexes catch the obvious shapes deterministically. They are NOT the
// definition of the rule — the Writer prompt bans the whole category and the
// Critic is told to judge paraphrases the scan misses.

const TEASER_PATTERNS: RegExp[] = [
  // "Here's why / what / how / the thing / the catch / the problem / where …"
  /\b(but |and |so |now |okay,? |ok,? )?here(?:'s| is) (?:why|what|how|where|when|the thing|the catch|the kicker|the twist|the truth|the problem|the part|the secret|what'?s (?:really|actually))\b/i,
  /\blet me (?:explain|break (?:it|this|that) down|show you|walk you through)\b/i,
  /\blet'?s break (?:it|this|that) down\b/i,
  /\bstay with me\b/i,
  /\bkeep (?:watching|reading|listening)\b/i,
  /\bwait for it\b/i,
  /\byou won'?t believe\b/i,
  /\bwhat nobody tells you\b/i,
  /\bwhat (?:no one|nobody) (?:talks about|mentions|is telling you)\b/i,
  /\bmost people don'?t (?:know|realize|realise) (?:this|that)\b[.!?:]/i,
  /\bthe truth is\b[,:]/i,
  /\bthis is where it gets (?:interesting|tricky|important|complicated)\b/i,
  /\bthat changes everything\b/i,
  /\blet that sink in\b/i,
  /\bspoiler(?: alert)?\b/i,
  /\bi'?ll (?:explain|get to that|come back to that)\b/i,
  /\bmore on that (?:later|in a (?:second|minute|moment))\b/i,
  /\bhang on\b[,.]/i,
]

const CLICHE_PATTERNS: RegExp[] = [
  // Strawman / audience-address openers
  /^(?:but |and |now )?(?:most|many) people (?:think|believe|assume)\b/i,
  /^(?:the )?(?:standard|usual|common|conventional) (?:story|wisdom|advice|answer) (?:is|says|goes)\b/i,
  /\beveryone (?:talks about|is talking about|tells you)\b/i,
  /\byou'?ve probably (?:heard|seen|been told)\b/i,
  /\bsound familiar\?/i,
  /\byou'?re not alone\b/i,
  // Marketing / AI filler
  /\bgame[- ]?changer\b/i,
  /\bunlock(?:s|ed|ing)? (?:your|their|its|new|better|the (?:full|true|real|secret|power|benefits?|potential|key)|\w+ potential)\b/i,
  /\b(?:your|the|a) (?:health|wellness|healing|weight[- ]loss) journey\b/i,
  /\b(?:let'?s )?(?:dive|deep[- ]dive) (?:in|into)\b/i,
  /\bat the end of the day\b/i,
  /\bthe bottom line\b/i,
  /\bit'?s (?:important|worth) (?:to note|noting)\b/i,
  /\bplays? an? (?:key|crucial|vital|critical) role\b/i,
  /\bwhen it comes to\b/i,
  /\bin today'?s (?:world|fast-paced)\b/i,
  /\blet'?s be (?:honest|real|clear)\b/i,
  /\bthe good news(?: is)?[:,?]/i,
  /\bno, really\b/i,
  /\band that'?s (?:okay|ok|fine)\b[.!]/i,
  /\bholistic\b/i,
  /\bempower(?:s|ed|ing)?\b/i,
  /\btransform (?:your|the way)\b/i,
  // Tidy antithesis bow
  /\bit'?s not (?:about )?\w[\w' ]{0,30}[,—–-] it'?s (?:about )?\w/i,
  /\bthe problem (?:was|is) never\b/i,
]

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Sentences that announce content instead of delivering it. HARD fail. */
export function findTeaserLines(text: string): string[] {
  if (!text) return []
  return splitSentences(text).filter((s) => TEASER_PATTERNS.some((re) => re.test(s)))
}

/** Sentences carrying marketing/AI filler, strawman openers, antithesis bows. SOFT. */
export function findClicheLines(text: string): string[] {
  if (!text) return []
  const teasers = new Set(findTeaserLines(text))
  return splitSentences(text).filter(
    (s) => !teasers.has(s) && CLICHE_PATTERNS.some((re) => re.test(s))
  )
}
