'use client'

import { useState } from 'react'
import type { ScriptFormatTemplate } from '@/types'

interface Props {
  templates: ScriptFormatTemplate[]
}

export function TemplatesButton({ templates }: Props) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"
      >
        Templates
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Post generation</p>
              <h2 className="text-lg font-bold text-slate-900">Format Templates</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {templates.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-400">No templates configured yet.</p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden">
                <button
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-slate-800">{t.name}</p>
                    {t.description && (
                      <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                    )}
                    {t.length_bias && (
                      <span className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                        {t.length_bias}
                      </span>
                    )}
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`mt-1 shrink-0 text-slate-400 transition-transform duration-200 ${expanded === t.id ? 'rotate-180' : ''}`}
                  >
                    <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {expanded === t.id && (
                  <div className="border-t border-slate-100 bg-white px-5 pb-5 pt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Scaffold</p>
                    <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 border border-slate-100">
                      {t.scaffold}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-[11px] text-slate-400">
              {templates.length} template{templates.length !== 1 ? 's' : ''} · edit in Supabase → <code className="font-mono">script_templates</code>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
