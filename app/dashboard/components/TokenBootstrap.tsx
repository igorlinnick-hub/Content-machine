'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { setStoredToken } from '@/lib/clinic-storage'

// Reads ?cm_bootstrap=<token> after /c/[token] redirect, persists token to
// localStorage as backup against iOS PWA cookie isolation, then removes the
// param from the URL so it doesn't sit in the address bar / history.
export function TokenBootstrap() {
  const router = useRouter()
  const sp = useSearchParams()
  const pathname = usePathname()

  useEffect(() => {
    const token = sp.get('cm_bootstrap')
    if (!token) return
    setStoredToken(token)
    const next = new URLSearchParams(sp.toString())
    next.delete('cm_bootstrap')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [sp, router, pathname])

  return null
}
