'use client'

import { useEffect } from 'react'

// Stamps "last time this browser opened /clips" — the dashboard
// NewClipsBadge counts cleaned clips newer than this. Per-device by
// design (localStorage): each team member clears their own badge.
export default function MarkClipsSeen({ clinicId }: { clinicId: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(`cm_clips_seen_${clinicId}`, new Date().toISOString())
    } catch {
      // private mode / storage denied — badge just stays, harmless
    }
  }, [clinicId])
  return null
}
