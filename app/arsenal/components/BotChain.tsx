'use client'

interface BotChainProps {
  activeCount: number
}

interface ChainStep {
  emoji: string
  name: string
  role: string
  model: string
  color: string
}

// Static SVG-and-flex visualisation of what happens AFTER a template
// gets picked: Writer → Critic → Splitter → Captioner → Renderer →
// final slide_set. Five named in-process agents are listed with their
// model so it's obvious where cost lands. This is intentionally
// read-only — the chain itself isn't user-editable (the modules are
// the modules) but seeing it concretely answers "what do my templates
// feed into?".

const STEPS: ChainStep[] = [
  {
    emoji: '📝',
    name: 'Writer',
    role: '3 script variants',
    model: 'Sonnet 4.6',
    color: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  {
    emoji: '🧐',
    name: 'Critic',
    role: 'scores + picks winner',
    model: 'Opus 4.7',
    color: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  {
    emoji: '✂️',
    name: 'Splitter',
    role: 'script → 7 slides',
    model: 'Haiku 4.5',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    emoji: '💬',
    name: 'Captioner',
    role: 'short + long captions',
    model: 'Haiku 4.5',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    emoji: '🖼',
    name: 'Renderer',
    role: 'HTML → PNG slides',
    model: 'Puppeteer',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
]

export function BotChain({ activeCount }: BotChainProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          🔗 Bot chain — where templates feed
        </h2>
        <p className="text-xs text-neutral-500">
          {activeCount} active template{activeCount === 1 ? '' : 's'} feed every
          script generation through this pipeline.
        </p>
      </header>

      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-1">
        {/* Source node: templates */}
        <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/60 p-3 text-center text-xs">
          <span className="text-lg">🧱</span>
          <span className="font-semibold text-violet-900">
            Active Templates
          </span>
          <span className="text-violet-600">
            {activeCount} scaffold{activeCount === 1 ? '' : 's'}
          </span>
        </div>

        <Arrow />

        {/* Chain steps */}
        {STEPS.map((step, i) => (
          <Step key={step.name} step={step} last={i === STEPS.length - 1} />
        ))}

        <Arrow />

        {/* Sink node */}
        <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 bg-white p-3 text-center text-xs">
          <span className="text-lg">📤</span>
          <span className="font-semibold text-neutral-900">Slide Set</span>
          <span className="text-neutral-500">posted to dashboard</span>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-neutral-500">
        Models gated by{' '}
        <code className="rounded bg-neutral-100 px-1">ENABLE_LLM_AGENTS</code> —
        switch off in Vercel env to run the arsenal pipeline on Claude
        subscription only.
      </p>
    </section>
  )
}

function Step({ step, last }: { step: ChainStep; last: boolean }) {
  return (
    <>
      <div
        className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center text-xs ${step.color}`}
      >
        <span className="text-lg">{step.emoji}</span>
        <span className="font-semibold">{step.name}</span>
        <span className="text-[10px] opacity-80">{step.role}</span>
        <span className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[10px]">
          {step.model}
        </span>
      </div>
      {!last && <Arrow />}
    </>
  )
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-neutral-300 md:flex-shrink-0">
      <span className="hidden text-2xl md:inline">→</span>
      <span className="text-xl md:hidden">↓</span>
    </div>
  )
}
