'use client'

import { useEffect, useState } from 'react'

// "N new" pill on the dashboard Video editor card — cleaned clips
// this browser hasn't seen yet (MarkClipsSeen stamps the visit on
// /clips). First visit ever → clips from the last 7 days count, so
// the badge is useful without being ancient history.

export default function NewClipsBadge({ clinicId }: { clinicId: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/clips/summary?clinicId=${clinicId}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          clips?: Array<{ status: string; completed_at: string | null }>
        }
        let seen = NaN
        try {
          seen = Date.parse(localStorage.getItem(`cm_clips_seen_${clinicId}`) ?? '')
        } catch {
          // storage denied — fall back to the 7-day window
        }
        const cutoff = Number.isNaN(seen)
          ? Date.now() - 7 * 24 * 3600 * 1000
          : seen
        const fresh = (data.clips ?? []).filter(
          (c) =>
            c.status === 'cleaned' &&
            c.completed_at &&
            Date.parse(c.completed_at) > cutoff
        ).length
        if (!cancelled) setCount(fresh)
      } catch {
        // network hiccup — no badge, no noise
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clinicId])

  if (count === 0) return null
  return (
    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
      {count} new
    </span>
  )
}
