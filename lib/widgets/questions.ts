// Per-clinic prompt bank used by the dashboard daily widgets.
// Grouped by intent so future per-clinic gating (e.g. clinics that
// don't do neuropathy hide that bank) is a one-line filter — for
// now we flatten everything into a single rotation pool.

export const QUESTION_BANKS = {
  pain_reality: [
    "What's the biggest mistake people make before they finally come see you for knee or back pain?",
    'What symptoms do neuropathy patients ignore for too long before getting help?',
    'What usually happens if someone keeps "pushing through" chronic joint pain for another year?',
    "What's something patients think is \"normal aging\" that actually isn't?",
    'What do MRIs or scans often fail to explain about pain?',
    "What's the difference between damage and inflammation that most patients don't understand?",
    'What type of patient usually gets the best results from regenerative treatments?',
    "What's one warning sign in the feet or legs people should never ignore?",
  ],
  stem_cells: [
    'What surprises patients the most about stem cell therapy after they start treatment?',
    'What actually happens inside the body during the first few weeks after regenerative treatment?',
    'Why do some patients feel changes quickly while others improve gradually over months?',
    'What does healing look like at 1 week, 1 month, and 3 months after treatment?',
    "What's something people misunderstand about stem cells because of social media?",
    'What conditions respond better to regenerative medicine than most people expect?',
    'When is surgery NOT the best first option?',
    "What's one case where regenerative medicine changed a patient's life more than expected?",
  ],
  neuropathy: [
    'What are the earliest signs of neuropathy most people miss?',
    'What does neuropathy progression actually look like over time?',
    "What's happening in the nerves when patients feel burning, numbness, or tingling?",
    'Can neuropathy affect balance, sleep, or mental focus more than people realize?',
    'What daily habits make neuropathy significantly worse?',
    'What improvements do patients usually notice first during treatment?',
    "What's the biggest misconception about nerve damage recovery?",
  ],
  general: [
    'What did you explain today that most people completely get wrong?',
    'What did a patient say today that stuck with you?',
    "What's something you corrected today that people assume is healthy?",
    'What did you see today that most people would never know happens in your field?',
    'What assumption did a patient make today that could have hurt them?',
    'What did you catch today that could have been missed?',
    "What's one thing a patient did right today that you rarely see?",
    "What's something you noticed today that the patient didn't even mention?",
    'Was there a case today where less treatment was better than more?',
    "What's a pattern you keep seeing that more people should know about?",
    "Was there a case today where the real problem wasn't what it seemed?",
  ],
} as const

// Flattened pool — preserves bank order so "Change question" cycles
// pain → stem cells → neuropathy → general, which roughly matches the
// arc of a regen clinic's content week.
export const DAILY_QUESTIONS: readonly string[] = [
  ...QUESTION_BANKS.pain_reality,
  ...QUESTION_BANKS.stem_cells,
  ...QUESTION_BANKS.neuropathy,
  ...QUESTION_BANKS.general,
]

const QUESTIONS_PER_DAY = 3

// Date-seeded selection: same 3 prompts for everyone on the same
// calendar day, fully different sets across days. Doctor can cycle
// past today's pick via the "Change question" button without
// reseeding everyone else.
function dailySeed(now: Date): number {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  let h = (y * 73856093) ^ (m * 19349663) ^ (d * 83492791)
  h = (h ^ (h >>> 16)) >>> 0
  return h
}

export function getDailyQuestions(now: Date = new Date()): string[] {
  const pool = DAILY_QUESTIONS
  const want = Math.min(QUESTIONS_PER_DAY, pool.length)
  const picked = new Set<number>()
  let cursor = dailySeed(now)
  while (picked.size < want) {
    // LCG step (Numerical Recipes constants), unsigned 32-bit
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0
    picked.add(cursor % pool.length)
  }
  return Array.from(picked).map((i) => pool[i])
}
