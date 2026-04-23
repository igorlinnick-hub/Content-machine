'use client'

import { useState } from 'react'

interface DailyWidgetsProps {
  clinicId: string
  questions: string[]
}

interface SubmitState {
  status: 'idle' | 'submitting' | 'done' | 'error'
  message?: string
}

export function DailyWidgets({ clinicId, questions }: DailyWidgetsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {questions.map((q, idx) => (
        <QuestionCard key={idx} index={idx + 1} clinicId={clinicId} question={q} />
      ))}
    </div>
  )
}

function QuestionCard({
  index,
  clinicId,
  question,
}: {
  index: number
  clinicId: string
  question: string
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
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-50 text-[11px] font-semibold text-orange-600">
          {index}
        </span>
        <p className="text-sm font-medium leading-snug text-neutral-900">
          {question}
        </p>
      </div>
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
