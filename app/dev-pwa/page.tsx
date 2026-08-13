'use client'
// TEMP preview route — remove after review.
import { IOSInstallEntry } from '@/app/dashboard/components/PWAInstallCard'
export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-amber-50 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Preview</p>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Install instructions</h1>
      <p className="mt-1 text-sm text-neutral-500">Sheet auto-opens. Close it to see the small pill below.</p>
      <div className="h-[60vh]" />
      <IOSInstallEntry />
      <footer className="pb-2 pt-4 text-center text-xs text-neutral-400">Content Machine · regen-med</footer>
    </main>
  )
}
