'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  clinicId: string
  initialStatus?: string | null
}

const STAGES = [
  { label: 'Analyzing clinic profile', duration: 4000 },
  { label: 'Pulling published content history', duration: 5000 },
  { label: 'Researching pillar topics', duration: 8000 },
  { label: 'Building 8-week structure', duration: 12000 },
  { label: 'Assigning content formats', duration: 8000 },
  { label: 'Finalizing editorial plan', duration: 6000 },
]

function PlanningAnimation() {
  const [stageIndex, setStageIndex] = useState(0)
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    let elapsed = 0
    let current = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    function advance() {
      if (current < STAGES.length - 1) {
        const delay = STAGES[current].duration
        const t = setTimeout(() => {
          current++
          setStageIndex(current)
          elapsed += delay
          advance()
        }, delay)
        timers.push(t)
      }
    }
    advance()

    const dots = setInterval(() => setDotCount((d) => (d % 3) + 1), 500)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(dots)
    }
  }, [])

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-violet-100 bg-white/70 p-6 backdrop-blur-sm">
      {/* Pulsing orb */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-20" />
          <span className="absolute inset-1 animate-pulse rounded-full bg-violet-200 opacity-40" />
          <svg className="relative h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-neutral-800">
            {STAGES[stageIndex].label}{'.'.repeat(dotCount)}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            This continues in the background — you can navigate away safely
          </p>
        </div>
      </div>

      {/* Stage progress */}
      <div className="flex flex-col gap-2">
        {STAGES.map((stage, i) => {
          const done = i < stageIndex
          const active = i === stageIndex
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                  done
                    ? 'bg-violet-500'
                    : active
                    ? 'bg-violet-100 ring-2 ring-violet-400 ring-offset-1'
                    : 'bg-neutral-100'
                }`}
              >
                {done ? (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : active ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                )}
              </div>
              <span
                className={`text-[12px] transition-colors duration-300 ${
                  done
                    ? 'text-neutral-400 line-through decoration-neutral-300'
                    : active
                    ? 'font-medium text-neutral-800'
                    : 'text-neutral-400'
                }`}
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Shimmer bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-violet-50">
        <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
      </div>
    </div>
  )
}

export function GeneratePlanButton({ clinicId, initialStatus }: Props) {
  const isGenerating =
    initialStatus === 'generating' ||
    (typeof sessionStorage !== 'undefined' &&
      !!sessionStorage.getItem(`plan-generating-${clinicId}`))
  const [generating, setGenerating] = useState(isGenerating)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startPolling() {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/content-plan/status?clinicId=${clinicId}`)
        const data = await res.json() as { status: string | null; error: string | null }
        if (data.status === 'error') {
          sessionStorage.removeItem(`plan-generating-${clinicId}`)
          setError(data.error ?? 'Generation failed')
          setGenerating(false)
          stopPolling()
        } else if (!data.status) {
          // Done — refresh page to show the new plan
          sessionStorage.removeItem(`plan-generating-${clinicId}`)
          stopPolling()
          router.refresh()
          setGenerating(false)
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Resume polling if page was loaded while already generating (server flag or sessionStorage)
  useEffect(() => {
    if (generating) startPolling()
    return stopPolling
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerate() {
    if (!confirm('Generate an AI content plan? This will replace the current plan for this clinic.')) return
    setError(null)
    setGenerating(true)
    // Persist generating state so navigation away + return still shows animation
    sessionStorage.setItem(`plan-generating-${clinicId}`, '1')

    try {
      const res = await fetch('/api/content-plan/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicId }),
        // keepalive: browser sends this request even if the page navigates away
        keepalive: true,
      })
      const data = await res.json()
      if (!res.ok && res.status !== 202) throw new Error(data?.error ?? `HTTP ${res.status}`)
      startPolling()
    } catch (e) {
      sessionStorage.removeItem(`plan-generating-${clinicId}`)
      setError(e instanceof Error ? e.message : 'failed to start')
      setGenerating(false)
    }
  }

  if (generating) {
    return <PlanningAnimation />
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
      >
        ✨ Generate plan with AI
      </button>
      {error && (
        <p className="text-[11px] text-red-500">{error}</p>
      )}
    </div>
  )
}
