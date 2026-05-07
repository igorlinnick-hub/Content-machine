/* eslint-disable @next/next/no-img-element */
'use client'

import { useRef, useState } from 'react'

type Mode = 'photo' | 'clean' | ''
type Role = 'cover' | 'body' | 'cta' | 'full_post' | ''

interface Reference {
  id: string
  image_url: string
  label: string | null
  mode: 'photo' | 'clean' | null
  role: 'cover' | 'body' | 'cta' | 'full_post' | null
  category_slug: string | null
  notes: string | null
}

interface Props {
  clinicId: string
  initialReferences: Reference[]
  categorySlugs: Array<{ slug: string; name: string }>
}

const ACCEPTED = 'image/png,image/jpeg,image/webp'
const ROLE_LABEL: Record<Exclude<Role, ''>, string> = {
  cover: 'Cover',
  body: 'Body',
  cta: 'CTA',
  full_post: 'Full post',
}

export function PostReferencesEditor({
  clinicId,
  initialReferences,
  categorySlugs,
}: Props) {
  const [refs, setRefs] = useState<Reference[]>(initialReferences)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<Mode>('')
  const [role, setRole] = useState<Role>('')
  const [categorySlug, setCategorySlug] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    setBusy(true)
    setError(null)
    try {
      const list = Array.from(files)
      for (const file of list) {
        const form = new FormData()
        form.append('clinicId', clinicId)
        form.append('file', file)
        if (label.trim()) form.append('label', label.trim())
        if (mode) form.append('mode', mode)
        if (role) form.append('role', role)
        if (categorySlug) form.append('category_slug', categorySlug)
        if (notes.trim()) form.append('notes', notes.trim())
        const res = await fetch('/api/posts/references', {
          method: 'POST',
          body: form,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
        setRefs((prev) => [data.reference, ...prev])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload failed')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) void uploadFiles(files)
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) void uploadFiles(files)
    e.target.value = ''
  }

  async function patch(
    id: string,
    update: { mode?: Mode; role?: Role; category_slug?: string; label?: string; notes?: string }
  ) {
    try {
      const body: Record<string, unknown> = { referenceId: id }
      if (update.mode !== undefined) body.mode = update.mode || null
      if (update.role !== undefined) body.role = update.role || null
      if (update.category_slug !== undefined)
        body.category_slug = update.category_slug || null
      if (update.label !== undefined) body.label = update.label || null
      if (update.notes !== undefined) body.notes = update.notes || null
      const res = await fetch('/api/posts/references', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setRefs((prev) => prev.map((r) => (r.id === id ? data.reference : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'update failed')
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this reference?')) return
    try {
      const res = await fetch(
        `/api/posts/references?referenceId=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setRefs((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed')
    }
  }

  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-5" open>
      <summary className="cursor-pointer text-base font-semibold text-neutral-900">
        Golden posts ({refs.length})
        <span className="ml-2 text-xs font-normal text-neutral-500">
          — PNG references the AI mirrors when rendering carousels (layout, brand, CTA shape)
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Default mode for new uploads
            </span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="cm-input text-xs"
              disabled={busy}
            >
              <option value="">— unspecified —</option>
              <option value="photo">Photo-rich (HWC EXAMPLE 1)</option>
              <option value="clean">Clean (white background)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Default role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="cm-input text-xs"
              disabled={busy}
            >
              <option value="">— unspecified —</option>
              <option value="cover">Cover (slide 1)</option>
              <option value="body">Body (slides 2..N-1)</option>
              <option value="cta">CTA (final slide)</option>
              <option value="full_post">Full post (cover + body + CTA)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Default category
            </span>
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="cm-input text-xs"
              disabled={busy}
            >
              <option value="">— any —</option>
              {categorySlugs.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Label (optional)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. HWC ketamine cover"
              className="cm-input text-xs"
              disabled={busy}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Notes — what the AI should pay attention to (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Navy rounded card with white headline, accent chip top-left, logo bottom-right."
            className="cm-input text-xs"
            disabled={busy}
          />
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver
              ? 'border-sky-400 bg-sky-50'
              : 'border-neutral-200 bg-neutral-50 hover:border-sky-300 hover:bg-sky-50/50'
          }`}
        >
          <p className="text-sm font-medium text-neutral-800">
            {busy ? 'Uploading…' : 'Drop or click to upload PNG / JPG / WebP'}
          </p>
          <p className="text-xs text-neutral-500">
            Multiple files allowed. Max 8 MB each. Apply tags above before dropping —
            they pre-fill on each new upload.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={onPickFile}
            className="hidden"
            disabled={busy}
          />
        </div>

        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {refs.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No references yet. Drop your best real-world posts (cover / body / CTA slides) —
            the AI will treat them as the visual benchmark.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {refs.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2"
              >
                <div className="overflow-hidden rounded border border-neutral-200 bg-white">
                  <img
                    src={r.image_url}
                    alt={r.label ?? 'Reference'}
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.mode && (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                      {r.mode === 'photo' ? 'Photo-rich' : 'Clean'}
                    </span>
                  )}
                  {r.role && (
                    <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                      {ROLE_LABEL[r.role]}
                    </span>
                  )}
                  {r.category_slug && (
                    <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                      {r.category_slug}
                    </span>
                  )}
                </div>
                {r.label && (
                  <p className="line-clamp-2 text-[11px] font-medium text-neutral-800">
                    {r.label}
                  </p>
                )}
                {r.notes && (
                  <p className="line-clamp-3 text-[11px] italic text-neutral-500">
                    {r.notes}
                  </p>
                )}
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <select
                    value={r.role ?? ''}
                    onChange={(e) => patch(r.id, { role: e.target.value as Role })}
                    className="cm-input flex-1 px-1 py-0.5 text-[11px]"
                  >
                    <option value="">role…</option>
                    <option value="cover">Cover</option>
                    <option value="body">Body</option>
                    <option value="cta">CTA</option>
                    <option value="full_post">Full</option>
                  </select>
                  <select
                    value={r.mode ?? ''}
                    onChange={(e) => patch(r.id, { mode: e.target.value as Mode })}
                    className="cm-input flex-1 px-1 py-0.5 text-[11px]"
                  >
                    <option value="">mode…</option>
                    <option value="photo">Photo</option>
                    <option value="clean">Clean</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="text-neutral-500 hover:text-red-600"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
