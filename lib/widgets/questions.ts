export const DAILY_QUESTIONS = [
  "What did a patient do today that you wish they'd done 6 months ago?",
  'What did you explain today that most people completely get wrong?',
  'Was there a moment today where the obvious answer was actually the wrong one?',
  'What did a patient say today that stuck with you?',
  "What's something you corrected today that people assume is healthy?",
  "Was there a decision today that looked simple but wasn't?",
  'What did you see today that most people would never know happens in your field?',
  'What assumption did a patient make today that could have hurt them?',
  'Was there a moment today where experience made the difference — not knowledge?',
  'What did you catch today that could have been missed?',
  "What's one thing a patient did right today that you rarely see?",
  'Was there a case today where the patient knew their body better than expected?',
  'What question did a patient ask that made you think differently?',
  "What's something that happened today that would surprise people about your job?",
  'Was there a moment today where you had to unlearn something to help someone?',
  'What did you see today that Google would have gotten completely wrong?',
  'Was there a case today where waiting was the right call — not acting?',
  "What's the most common mistake you corrected today?",
  "Was there a patient today who almost didn't come in — and should have sooner?",
  "What did you do today that can't be replaced by an app or AI?",
  "Was there a moment today where the patient's emotion changed your approach?",
  "What's something you noticed today that the patient didn't even mention?",
  'Was there a case today where less treatment was better than more?',
  'What did you have to say today that was hard to hear for the patient?',
  "Was there a moment today where intuition led you somewhere data didn't?",
  "What's a pattern you keep seeing that more people should know about?",
  'Was there something today that reminded you why this work matters?',
  'What did you handle today that required more than just medical knowledge?',
  "Was there a case today where the real problem wasn't what it seemed?",
  'What did you learn today — from a patient, a case, or a mistake?',
] as const

const QUESTIONS_PER_DAY = 3

// Date-seeded selection: same set for everyone on the same calendar day,
// fully different sets across days. Cycles through the pool roughly every
// 10 days (30 questions / 3 per day) before any repeats are likely.
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
