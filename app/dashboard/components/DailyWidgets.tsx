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
    <div className="flex flex-col gap-4">
      {questions.map((q, idx) => (
        <QuestionCard key={idx} clinicId={clinicId} question={q} />
      ))}
    </div>
  )
}

function QuestionCard({ clinicId, question }: { clinicId: string; question: string }) {
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
        message: `Saved · ${data.insights_saved ?? 0} insights extracted`,
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
    <form
      onSubmit={onSubmit}
      className="rounded border border-neutral-200 bg-white p-4"
    >
      <p className="text-sm font-medium">{question}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={disabled}
        placeholder="Type your answer..."
        className="mt-3 w-full resize-none rounded border border-neutral-300 p-2 text-sm disabled:opacity-50"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
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
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {disabled ? 'Saving…' : 'Save answer'}
        </button>
      </div>
    </form>
  )
}
