'use client'

import { useMemo, useState } from 'react'
import { DAILY_QUESTIONS } from '@/lib/widgets/questions'

interface DailyWidgetsProps {
  clinicId: string
  questions: string[]
}

interface SubmitState {
  status: 'idle' | 'submitting' | 'done' | 'error'
  message?: string
}

// Three widget cards. Each starts on the day's pick (server-seeded
// for cohesion across clinics) but the doctor can press "Change
// question" to rotate to the next one in the bank — sibling cards
// stay coordinated via a shared "used" set so the doctor never
// gets the same prompt in two cards at once.

export function DailyWidgets({ clinicId, questions }: DailyWidgetsProps) {
  const pool = useMemo(() => [...DAILY_QUESTIONS], [])
  // Map each initial question to its index in the global pool. If the
  // server picked something not in the pool (e.g. an old cached
  // entry), fall back to index 0 — change-question still works.
  const initialIndexes = useMemo(
    () =>
      questions.map((q) => {
        const i = pool.indexOf(q)
        return i === -1 ? 0 : i
      }),
    [questions, pool]
  )
  const [indexes, setIndexes] = useState<number[]>(initialIndexes)

  function rotate(cardIdx: number): void {
    setIndexes((current) => {
      const used = new Set(current)
      let next = (current[cardIdx] + 1) % pool.length
      // Skip any question another card is currently showing — at most
      // one full pool sweep, then accept whatever is next even if it
      // collides (the pool is bigger than 3 cards so this is rare).
      let safety = pool.length
      while (used.has(next) && safety-- > 0) {
        next = (next + 1) % pool.length
      }
      return current.map((v, i) => (i === cardIdx ? next : v))
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {indexes.map((qIdx, cardIdx) => (
        <QuestionCard
          key={cardIdx}
          index={cardIdx + 1}
          clinicId={clinicId}
          question={pool[qIdx]}
          onChangeQuestion={() => rotate(cardIdx)}
        />
      ))}
    </div>
  )
}

function QuestionCard({
  index,
  clinicId,
  question,
  onChangeQuestion,
}: {
  index: number
  clinicId: string
  question: string
  onChangeQuestion: () => void
}) {
  const [text, setText] = useState('')
  const [state, setState] = useState<SubmitState>({ status: 'idle' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setState({ status: 'submitting' })
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          rawText: `Q: ${question}\nA: ${text.trim()}`,
          source: 'widget',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setState({
        status: 'done',
        message: `Saved — ${data.insights_saved ?? 0} insight${
          data.insights_saved === 1 ? '' : 's'
        } extracted`,
      })
      setText('')
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  const disabled = state.status === 'submitting'

  return (
    <form onSubmit={onSubmit} className="cm-card flex flex-col gap-3 p-5">
      <div className="flex items-start gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-[11px] font-semibold text-sky-600">
          {index}
        </span>
        <p className="text-sm font-medium leading-snug text-neutral-900">
          {question}
        </p>
      </div>

      {/* Subtle "Change question" affordance — text-button styling so
          it never competes with Save. Disabled mid-submit to avoid
          losing the in-progress text on a question swap. */}
      <button
        type="button"
        onClick={onChangeQuestion}
        disabled={disabled}
        className="-mt-1 self-start text-[11px] font-medium text-sky-600 hover:underline disabled:text-neutral-300"
      >
        ↻ Change question
      </button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={disabled}
        placeholder="Type your answer…"
        className="cm-input resize-none text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs ${
            state.status === 'error'
              ? 'text-red-600'
              : state.status === 'done'
                ? 'text-green-700'
                : 'text-neutral-500'
          }`}
        >
          {state.message ?? ' '}
        </span>
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="cm-btn cm-btn-primary text-sm"
        >
          {disabled ? 'Saving…' : 'Save answer'}
        </button>
      </div>
    </form>
  )
}
