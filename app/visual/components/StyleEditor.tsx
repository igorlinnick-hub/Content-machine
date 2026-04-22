'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VisualStyle } from '@/types'

interface StyleEditorProps {
  clinicId: string
  initialStyle: VisualStyle
}

export function StyleEditor({ clinicId, initialStyle }: StyleEditorProps) {
  const router = useRouter()
  const [draft, setDraft] = useState<string>(() =>
    JSON.stringify(initialStyle, null, 2)
  )
  const [state, setState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error'
    message?: string
  }>({ status: 'idle' })

  async function onSave() {
    let parsed: VisualStyle
    try {
      parsed = JSON.parse(draft) as VisualStyle
    } catch (e) {
      setState({
        status: 'error',
        message: `Invalid JSON: ${(e as Error).message}`,
      })
      return
    }

    setState({ status: 'saving' })
    try {
      const res = await fetch('/api/visual/style', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, style: parsed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setState({ status: 'saved', message: 'Saved. New renders will use this style.' })
      router.refresh()
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  return (
    <details className="rounded border border-neutral-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Edit style template (JSON)
      </summary>
      <div className="flex flex-col gap-3 border-t border-neutral-200 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full rounded border border-neutral-300 p-2 font-mono text-xs"
        />
        <div className="flex items-center justify-between gap-3">
          <span
            className={`text-xs ${
              state.status === 'error'
                ? 'text-red-600'
                : state.status === 'saved'
                ? 'text-green-700'
                : 'text-neutral-500'
            }`}
          >
            {state.message ?? ' '}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={state.status === 'saving'}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {state.status === 'saving' ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>
    </details>
  )
}
