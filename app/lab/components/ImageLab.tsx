'use client'

import { useState } from 'react'

interface ImageLabProps {
  clinicId: string
  clinicName?: string
  // Optional prompt seed — set by the dashboard tab when launching
  // the lab in-context (e.g. "make background for THIS script").
  initialPrompt?: string
  // Compact = render as embed (no big intro section). Default false
  // is the standalone /lab page.
  compact?: boolean
}

type ModelKey = 'flux_schnell' | 'flux_pro' | 'sdxl_lightning'
type Aspect = '1:1' | '4:5' | '9:16' | '16:9' | '3:4'

interface GenResult {
  id: string
  model: ModelKey
  prompt: string
  imageUrls: string[]
  predictTime: number
  cost_estimate_usd: number
}

// Compact-by-default Image Lab. The form shows ONLY prompt + Generate.
// Aspect, model, variant count live behind an Advanced toggle —
// defaults are tuned for slide-quality posts: 4:5 portrait at Flux
// Schnell, single image per generation. Each result tile gets a
// Download button so the operator can grab the PNG straight into
// the post they're working on.

const MODELS: Array<{ key: ModelKey; label: string; tag: string }> = [
  { key: 'flux_schnell', label: 'Flux Schnell', tag: '~$0.003 · fast' },
  { key: 'flux_pro', label: 'Flux 1.1 Pro', tag: '~$0.04 · best' },
  { key: 'sdxl_lightning', label: 'SDXL Lightning', tag: '~$0.002 · alt' },
]

const ASPECTS: Aspect[] = ['4:5', '1:1', '9:16', '16:9', '3:4']

export function ImageLab({
  clinicId,
  clinicName,
  initialPrompt,
  compact = false,
}: ImageLabProps) {
  void clinicId
  const [prompt, setPrompt] = useState(initialPrompt ?? '')
  const [model, setModel] = useState<ModelKey>('flux_schnell')
  const [aspect, setAspect] = useState<Aspect>('4:5')
  const [num, setNum] = useState(1)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [history, setHistory] = useState<GenResult[]>([])

  async function generate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!prompt.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/lab/image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspect_ratio: aspect,
          num_outputs: num,
        }),
      })
      const payload = (await res.json()) as {
        ok?: boolean
        result?: GenResult
        error?: string
      }
      if (!res.ok || !payload.ok || !payload.result) {
        setErr(payload.error ?? `request failed (${res.status})`)
        return
      }
      setHistory((cur) => [payload.result!, ...cur].slice(0, 12))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!compact && clinicName && (
        <p className="rounded border border-fuchsia-200 bg-fuchsia-50/60 p-3 text-xs text-fuchsia-700">
          Generate images for {clinicName}&apos;s slides. Default size is{' '}
          <strong>4:5 portrait</strong> — matches the post template. Click any
          result to download the PNG.
        </p>
      )}

      <form
        onSubmit={generate}
        className="flex flex-col gap-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/30 p-4"
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='What should this image show? Be specific. e.g. "Editorial close-up of healthy knee joint, soft studio light, photographic"'
          rows={3}
          disabled={busy}
          required
          className="cm-input min-h-[80px] resize-y text-sm"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-[11px] font-medium text-fuchsia-700 hover:underline"
          >
            {advancedOpen ? 'Hide' : 'Show'} advanced (model · aspect · ×N)
          </button>
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="cm-btn cm-btn-primary text-sm"
          >
            {busy ? 'Generating…' : `Generate ${num > 1 ? `×${num}` : ''}`}
          </button>
        </div>

        {advancedOpen && (
          <div className="grid gap-3 border-t border-fuchsia-200 pt-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-neutral-700">Model</span>
              <div className="flex flex-col gap-1">
                {MODELS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModel(m.key)}
                    disabled={busy}
                    className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition ${
                      model === m.key
                        ? 'border-fuchsia-400 bg-fuchsia-50 ring-1 ring-fuchsia-300'
                        : 'border-neutral-200 bg-white hover:border-fuchsia-200'
                    }`}
                  >
                    <span className="font-semibold text-neutral-900">
                      {m.label}
                    </span>
                    <span className="ml-1 text-neutral-500">{m.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-neutral-700">Aspect</span>
              <div className="grid grid-cols-3 gap-1">
                {ASPECTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAspect(a)}
                    disabled={busy}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                      aspect === a
                        ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-fuchsia-200'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-neutral-700">Variants</span>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNum(n)}
                    disabled={busy}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                      num === n
                        ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-fuchsia-200'
                    }`}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {err && <p className="text-xs text-rose-600">{err}</p>}
      </form>

      {history.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Type a prompt above and Generate to see results.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {history.map((r, idx) => (
            <ResultBlock key={r.id + idx} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultBlock({ result }: { result: GenResult }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="line-clamp-2 max-w-xl text-xs italic text-neutral-700">
          “{result.prompt}”
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
          <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 font-medium text-fuchsia-700">
            {result.model.replace('_', ' ')}
          </span>
          <span>{result.predictTime.toFixed(1)}s</span>
          <span>·</span>
          <span>~${result.cost_estimate_usd.toFixed(3)}</span>
        </div>
      </header>
      <div
        className={`grid gap-2 ${
          result.imageUrls.length === 1
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {result.imageUrls.map((url, i) => (
          <ImageTile key={i} url={url} index={i + 1} prompt={result.prompt} />
        ))}
      </div>
    </article>
  )
}

function ImageTile({
  url,
  index,
  prompt,
}: {
  url: string
  index: number
  prompt: string
}) {
  const [downloading, setDownloading] = useState(false)

  async function download(): Promise<void> {
    setDownloading(true)
    try {
      // Stream the Replicate URL through fetch → blob so the browser
      // saves with a sensible filename instead of opening the image.
      // CORS is enabled on Replicate's CDN so this works directly.
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      const safe = prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image'
      a.href = URL.createObjectURL(blob)
      a.download = `${safe}-${index}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch {
      // fall back to opening the URL — better than nothing
      window.open(url, '_blank', 'noopener')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`gen ${index}`}
        className="h-auto w-full object-cover"
      />
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition group-hover:opacity-100">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          open ↗
        </a>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className="rounded bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
        >
          {downloading ? '…' : '⬇ Download'}
        </button>
      </div>
    </div>
  )
}
