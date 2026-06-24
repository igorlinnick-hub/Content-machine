'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScriptFormatTemplate } from '@/types'

interface Props {
  templates: ScriptFormatTemplate[]
}

export function TemplatesButton({ templates }: Props) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const modal = open && typeof document !== 'undefined' ? createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#fff' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '16px 20px', flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', margin: 0 }}>Post generation</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>Format Templates</h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {templates.length === 0 && (
          <p style={{ textAlign: 'center', padding: '64px 0', fontSize: 14, color: '#94a3b8' }}>No templates configured yet.</p>
        )}
        {templates.map((t) => (
          <div key={t.id} style={{ borderRadius: 16, border: '1px solid #f1f5f9', background: '#f8fafc', overflow: 'hidden', marginBottom: 12 }}>
            <button
              style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 20px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>{t.name}</p>
                {t.description && (
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{t.description}</p>
                )}
                {t.length_bias && (
                  <span style={{ display: 'inline-block', marginTop: 8, borderRadius: 999, background: '#eef2ff', padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1' }}>
                    {t.length_bias}
                  </span>
                )}
              </div>
              <svg
                width="16" height="16" viewBox="0 0 16 16" fill="none"
                style={{ marginTop: 2, flexShrink: 0, color: '#94a3b8', transform: expanded === t.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {expanded === t.id && (
              <div style={{ borderTop: '1px solid #f1f5f9', background: '#fff', padding: '16px 20px 20px' }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#94a3b8', margin: '0 0 8px' }}>Scaffold</p>
                <pre style={{ whiteSpace: 'pre-wrap', borderRadius: 12, background: '#f8fafc', padding: 16, fontSize: 11, lineHeight: 1.6, color: '#475569', border: '1px solid #f1f5f9', margin: 0, fontFamily: 'monospace' }}>
                  {t.scaffold}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 20px', flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
          {templates.length} template{templates.length !== 1 ? 's' : ''} · edit in Supabase → <code style={{ fontFamily: 'monospace' }}>script_templates</code>
        </p>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"
      >
        Templates
      </button>
      {modal}
    </>
  )
}
