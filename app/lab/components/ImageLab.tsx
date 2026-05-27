'use client'

import { useState } from 'react'

interface ImageLabProps {
  clinicId: string
  clinicName: string
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

const MODELS: Array<{ key: ModelKey; label: string; tag: string; note: string }> = [
  {
    key: 'flux_schnell',
    label: 'Flux Schnell',
    tag: '~$0.003 · fast',
    note: 'Cheapest, 2-4s. Great for quick iteration on composition.',
  },
  {
    key: 'flux_pro',
    label: 'Flux 1.1 Pro',
    tag: '~$0.04 · best',
    note: 'Highest fidelity. Use when you found a prompt that works.',
  },
  {
    key: 'sdxl_lightning',
    label: 'SDXL Lightning',
    tag: '~$0.002 · alt',
    note: '4-step SDXL. Different aesthetic from Flux — try it.',
  },
]

const ASPECTS: Aspect[] = ['1:1', '4:5', '9:16', '16:9', '3:4']

const EXAMPLES = [
  'Editorial close-up of healthy knee joint anatomy, soft natural studio light, light neutral background, photorealistic medical illustration',
  'Calm patient smiling after recovery, mid-50s, neutral consult-room background, soft window light, photographic',
  'Glowing microscopic view of cellular regeneration, biology-textbook accuracy, soft blue/green palette, no text',
]

export function ImageLab({ clinicId, clinicName }: ImageLabProps) {
  void clinicId
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ModelKey>('flux_schnell')
  const [aspect, setAspect] = useState<Aspect>('4:5')
  const [num, setNum] = useState(1)
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
      // Prepend so the freshest result is at the top.
      setHistory((cur) => [payload.result!, ...cur].slice(0, 12))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  const selectedModel = MODELS.find((m) => m.key === model) ?? MODELS[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Generator form */}
      <form
        onSubmit={generate}
        className="flex flex-col gap-4 rounded-xl border border-fuchsia-200 bg-fuchsia-50/30 p-5 shadow-sm"
      >
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-neutral-700">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`What should this image show? Be specific. Example:\n${EXAMPLES[0]}`}
            rows={3}
            disabled={busy}
            required
            className="cm-input min-h-[80px] resize-y text-sm"
          />
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
            <span className="font-medium uppercase tracking-wide text-neutral-400">
              examples:
            </span>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPrompt(ex)}
                disabled={busy}
                className="rounded bg-white px-2 py-0.5 text-neutral-600 hover:text-fuchsia-700"
              >
                {ex.slice(0, 38)}…
              </button>
            ))}
          </div>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-neutral-700">Model</span>
            <div className="flex flex-col gap-1">
              {MODELS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setModel(m.key)}
                  disabled={busy}
                  className={`rounded-md border px-2.5 py-1.5 text-left transition ${
                    model === m.key
                      ? 'border-fuchsia-400 bg-fuchsia-50 ring-1 ring-fuchsia-300'
                      : 'border-neutral-200 bg-white hover:border-fuchsia-200'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-900">
                      {m.label}
                    </span>
                    <span className="text-[10px] text-neutral-500">{m.tag}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-neutral-700">Aspect</span>
            <div className="grid grid-cols-3 gap-1">
              {ASPECTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  disabled={busy}
                  className={`rounded-md border px-2 py-1.5 font-mono text-[11px] transition ${
                    aspect === a
                      ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-fuchsia-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">
              4:5 = Instagram feed. 9:16 = Reels. 1:1 = post.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-neutral-700">Variants</span>
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNum(n)}
                  disabled={busy}
                  className={`rounded-md border px-2 py-1.5 font-mono text-[11px] transition ${
                    num === n
                      ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-fuchsia-200'
                  }`}
                >
                  ×{n}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">
              Same prompt, different seeds.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fuchsia-100 pt-3">
          <p className="text-[11px] text-neutral-500">
            <span className="font-semibold text-fuchsia-700">
              {selectedModel.label}:
            </span>{' '}
            {selectedModel.note} Clinic context: {clinicName}.
          </p>
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="cm-btn cm-btn-primary text-sm"
          >
            {busy ? 'Generating…' : `Generate (×${num})`}
          </button>
        </div>

        {err && <p className="text-xs text-rose-600">{err}</p>}
      </form>

      {/* Results — latest first */}
      {history.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          No images yet. Type a prompt above and hit Generate to see results.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
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
    <article className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="line-clamp-2 max-w-xl text-sm italic text-neutral-700">
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {result.imageUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group relative block overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 transition hover:border-fuchsia-300"
          >
            <img
              src={url}
              alt={`gen ${i + 1}`}
              className="h-auto w-full object-cover transition group-hover:opacity-95"
            />
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
              open ↗
            </span>
          </a>
        ))}
      </div>
    </article>
  )
}
