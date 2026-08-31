'use client'

import { useEffect, useState } from 'react'

// "N new" pill on the dashboard My videos card — photos and clips the
// MA team uploaded that this browser hasn't looked at yet (opening the
// From-the-floor tab stamps the visit). First visit ever → the last 7
// days count, same rule as NewClipsBadge, so the badge is useful
// without dredging up the whole archive.

export default function NewFloorBadge({ clinicId }: { clinicId: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/floor/summary?clinicId=${clinicId}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          media?: Array<{ uploaded_at: string }>
        }
        let seen = NaN
        try {
          seen = Date.parse(localStorage.getItem(`cm_floor_seen_${clinicId}`) ?? '')
        } catch {
          // storage denied — fall back to the 7-day window
        }
        const cutoff = Number.isNaN(seen) ? Date.now() - 7 * 24 * 3600 * 1000 : seen
        const fresh = (data.media ?? []).filter(
          (m) => Date.parse(m.uploaded_at) > cutoff
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
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-teal-700"
      style={{
        background: 'rgba(20,184,166,0.14)',
        border: '1px solid rgba(20,184,166,0.34)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
      }}
    >
      {count} new
    </span>
  )
}
