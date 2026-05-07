'use client'

import { useEffect, useState } from 'react'

interface Category {
  id?: string
  slug: string
  name: string
  emoji: string | null
  triggers: string[]
  drive_folder_id: string | null
  cta_template: string | null
}

interface Props {
  clinicId: string
  initialCategories: Category[]
}

export function CategoriesEditor({ clinicId, initialCategories }: Props) {
  const [cats, setCats] = useState<Category[]>(initialCategories)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setCats(initialCategories)
  }, [initialCategories])

  function patch(idx: number, p: Partial<Category>) {
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, ...p } : c)))
  }

  function patchTriggers(idx: number, raw: string) {
    const triggers = raw.split(',').map((s) => s.trim()).filter(Boolean)
    patch(idx, { triggers })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/posts/categories', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId, categories: cats }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setCats(data.categories)
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-5">
      <summary className="cursor-pointer text-base font-semibold text-neutral-900">
        Categories ({cats.length})
        <span className="ml-2 text-xs font-normal text-neutral-500">
          — triggers, photo folder, CTA per category
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        {cats.map((c, i) => (
          <div
            key={c.slug}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={c.emoji ?? ''}
                onChange={(e) => patch(i, { emoji: e.target.value || null })}
                placeholder="🧠"
                className="cm-input w-14 text-center text-lg"
              />
              <input
                type="text"
                value={c.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                className="cm-input flex-1 text-sm font-medium"
              />
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Triggers (comma-separated)
              </span>
              <textarea
                value={c.triggers.join(', ')}
                onChange={(e) => patchTriggers(i, e.target.value)}
                rows={2}
                className="cm-input text-xs"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Drive folder ID for photo backgrounds
              </span>
              <input
                type="text"
                value={c.drive_folder_id ?? ''}
                onChange={(e) =>
                  patch(i, { drive_folder_id: e.target.value || null })
                }
                placeholder="1aBc...XYZ"
                className="cm-input text-xs"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                CTA template (used as the call-to-action block of every post)
              </span>
              <textarea
                value={c.cta_template ?? ''}
                onChange={(e) =>
                  patch(i, { cta_template: e.target.value || null })
                }
                rows={2}
                placeholder="Book your free consultation: {clinic_phone}"
                className="cm-input text-xs"
              />
            </label>
          </div>
        ))}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            {savedAt && !error && (
              <span className="text-green-600">Saved.</span>
            )}
            {error && <span className="text-red-600">{error}</span>}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="cm-btn cm-btn-primary text-sm"
          >
            {saving ? 'Saving…' : 'Save categories'}
          </button>
        </div>
      </div>
    </details>
  )
}
