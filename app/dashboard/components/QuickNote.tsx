'use client'

import { useState } from 'react'

interface Props {
  clinicId: string
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

export function QuickNote({ clinicId }: Props) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function save() {
    const trimmed = text.trim()
    if (!trimmed) return
    setStatus('saving')
    setErrMsg(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          rawText: trimmed,
          source: 'widget',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setStatus('saved')
      setText('')
      setTimeout(() => setStatus('idle'), 1800)
    } catch (e) {
      setStatus('error')
      setErrMsg(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="cm-card p-5">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-neutral-900">
            Anything else on your mind?
          </p>
          <p className="text-sm text-neutral-600">
            Story, mistake, complaint, idea — drop it here and the team will
            mine it for hooks. No structure needed.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="A patient asked me today why we don't just inject more steroids — turned into a 10-minute conversation about why the goal isn't to mute pain."
          className="cm-input text-sm"
          disabled={status === 'saving'}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">
            {status === 'saved'
              ? 'Saved. The analyst will pick it up on the next run.'
              : status === 'error'
                ? errMsg
                : 'Goes straight into your insights pool — writer reads it on every generation.'}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!text.trim() || status === 'saving'}
            className="cm-btn cm-btn-primary text-sm"
          >
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  )
}
