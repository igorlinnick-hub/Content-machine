'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function StandaloneRedirect() {
  const router = useRouter()
  useEffect(() => {
    const iosStandalone =
      'standalone' in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    const mqStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches
    if (iosStandalone || mqStandalone) {
      router.replace('/dashboard')
    }
  }, [router])
  return null
}
