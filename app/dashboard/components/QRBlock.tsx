/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  url: string
}

// Small QR-code renderer split into its own client module so the
// 30KB qrcode bundle only loads when the install card opens it.
export default function QRBlock({ url }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 192, margin: 1 })
      .then((d) => {
        if (!cancelled) setDataUrl(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [url])

  if (!dataUrl) {
    return (
      <div className="h-[192px] w-[192px] animate-pulse rounded bg-neutral-100" />
    )
  }
  return (
    <div className="rounded-lg bg-white p-2 ring-1 ring-neutral-200 self-start">
      <img src={dataUrl} alt="Scan to open on phone" width={192} height={192} />
    </div>
  )
}
