/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'

interface Props {
  slideSetId: string
  index: number
  text: string
  preview: string | null
  onTextChange: (next: string) => void
  // Called after a successful AI fix so the parent can update both the
  // working draft and the rendered preview at this index.
  onAIFix: (next: { text: string; preview: string }) => void
}

interface FixResponse {
  index: number
  slide_text: string
  preview: string
  warning: string | null
  slides: string[]
  error?: string
}

export function SlideEditor({
  slideSetId,
  index,
  text,
  preview,
  onTextChange,
  onAIFix,
}: Props) {
  const [chatOpen, setChatOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [fixing, setFixing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  async function runFix() {
    if (!instruction.trim()) return
    setFixing(true)
    setError(null)
    setWarning(null)
    try {
      const res = await fetch(`/api/posts/${slideSetId}/slide-refine`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index, instruction: instruction.trim() }),
      })
      const data = (await res.json()) as FixResponse
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setWarning(data.warning)
      onAIFix({ text: data.slide_text, preview: data.preview })
      setInstruction('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to apply fix')
    } finally {
      setFixing(false)
    }
  }

  return (
    <li className="cm-card overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
        <span className="font-semibold uppercase tracking-wider">
          Slide {index + 1}
        </span>
        <span>{text.length} chars</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={3}
          className="cm-input resize-none text-sm"
        />
        {preview && (
          <figure className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <img
              src={preview}
              alt={`Slide ${index + 1}`}
              className="aspect-square w-full object-cover"
            />
          </figure>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className="text-[11px] font-medium text-sky-700 hover:text-sky-900"
        >
          {chatOpen ? 'Close AI fix' : '✦ Ask AI to fix this slide'}
        </button>
        {warning && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            {warning}
          </span>
        )}
      </div>

      {chatOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50 p-3">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="What should change on this slide? e.g. shorter, less jargon, stronger hook, swap stat for question…"
            className="cm-input resize-none text-xs"
            disabled={fixing}
          />
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setChatOpen(false)
                setInstruction('')
                setError(null)
              }}
              className="cm-btn cm-btn-ghost text-xs"
              disabled={fixing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runFix}
              disabled={fixing || !instruction.trim()}
              className="cm-btn cm-btn-primary text-xs"
            >
              {fixing ? 'Applying…' : 'Apply fix'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
