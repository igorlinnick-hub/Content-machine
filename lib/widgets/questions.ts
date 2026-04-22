export const DAILY_QUESTIONS = [
  'What surprised a patient the most today?',
  'What objection did you hear most often today?',
  'What did you spend the longest time explaining, and why?',
  'Which treatment result this week made you proud?',
  'What do most people misunderstand about regenerative medicine?',
  'Which myth in your field frustrates you the most?',
  'What would you advise someone just getting curious about this space?',
  'Which study has impressed you most recently?',
  'Where does your approach diverge from the standard of care?',
  'What do you wish every patient knew before the first visit?',
] as const

export function getDailyQuestions(now: Date = new Date()): string[] {
  const day = now.getDay()
  const selected = DAILY_QUESTIONS.filter(
    (_, i) => i % 7 === day || i % 5 === day || i % 3 === day
  ).slice(0, 3)
  if (selected.length === 3) return [...selected]
  const fallback = [...DAILY_QUESTIONS]
  const out = [...selected]
  for (const q of fallback) {
    if (out.length === 3) break
    if (!out.includes(q)) out.push(q)
  }
  return out
}
