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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Post generation</p>
                <h2 className="text-base font-bold text-slate-900">Format Templates</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {templates.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No templates configured yet.</p>
              )}
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-100 bg-slate-50">
                  <button
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
                      )}
                      {t.length_bias && (
                        <span className="mt-1.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                          {t.length_bias}
                        </span>
                      )}
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${expanded === t.id ? 'rotate-180' : ''}`}
                    >
                      <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {expanded === t.id && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Scaffold</p>
                      <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] leading-relaxed text-slate-600 border border-slate-100">
                        {t.scaffold}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-[11px] text-slate-400">
                {templates.length} template{templates.length !== 1 ? 's' : ''} · edit in Supabase → <code className="font-mono">script_templates</code>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
