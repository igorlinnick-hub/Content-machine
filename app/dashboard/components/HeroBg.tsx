'use client'

import { useEffect, useRef } from 'react'

export function HeroBg({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let t = 0

    function resize() {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function frame() {
      if (!canvas || !ctx) return
      t += 0.006
      const W = canvas.width
      const H = canvas.height
      const dpr = window.devicePixelRatio || 1

      // ── Base fill ───────────────────────────────────────────────────────
      ctx.fillStyle = '#07111e'
      ctx.fillRect(0, 0, W, H)

      // ── Blob 1 — sky blue, large, drifts across center ─────────────────
      const ax = W * (0.5 + 0.38 * Math.sin(t * 0.32))
      const ay = H * (0.45 + 0.28 * Math.cos(t * 0.27))
      const ar = Math.sqrt(W * W + H * H) * 0.68
      const ga1 = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar)
      ga1.addColorStop(0,    'rgba(14,165,233,0.55)')
      ga1.addColorStop(0.28, 'rgba(56,189,248,0.22)')
      ga1.addColorStop(0.6,  'rgba(2,132,199,0.06)')
      ga1.addColorStop(1,    'rgba(14,165,233,0)')
      ctx.fillStyle = ga1
      ctx.fillRect(0, 0, W, H)

      // ── Blob 2 — teal, mid-left, counter-rhythm ─────────────────────────
      const bx = W * (0.12 + 0.18 * Math.cos(t * 0.21))
      const by = H * (0.65 + 0.18 * Math.sin(t * 0.18))
      const br = Math.sqrt(W * W + H * H) * 0.52
      const ga2 = ctx.createRadialGradient(bx, by, 0, bx, by, br)
      ga2.addColorStop(0,    'rgba(20,184,166,0.48)')
      ga2.addColorStop(0.35, 'rgba(13,148,136,0.18)')
      ga2.addColorStop(0.7,  'rgba(20,184,166,0.04)')
      ga2.addColorStop(1,    'rgba(20,184,166,0)')
      ctx.fillStyle = ga2
      ctx.fillRect(0, 0, W, H)

      // ── Blob 3 — deep indigo, right side ────────────────────────────────
      const cx2 = W * (0.88 + 0.1 * Math.sin(t * 0.15))
      const cy2 = H * (0.3  + 0.2 * Math.cos(t * 0.19))
      const cr  = Math.sqrt(W * W + H * H) * 0.45
      const ga3 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr)
      ga3.addColorStop(0,   'rgba(99,102,241,0.38)')
      ga3.addColorStop(0.4, 'rgba(79,70,229,0.12)')
      ga3.addColorStop(1,   'rgba(79,70,229,0)')
      ctx.fillStyle = ga3
      ctx.fillRect(0, 0, W, H)

      // ── Blob 4 — amber warmth, bottom-left corner ───────────────────────
      const warmR = W * (0.42 + 0.07 * Math.sin(t * 0.14))
      const ga4 = ctx.createRadialGradient(0, H, 0, 0, H, warmR)
      ga4.addColorStop(0,   'rgba(245,158,11,0.28)')
      ga4.addColorStop(0.4, 'rgba(251,146,60,0.08)')
      ga4.addColorStop(1,   'rgba(245,158,11,0)')
      ctx.fillStyle = ga4
      ctx.fillRect(0, 0, W, H)

      // ── Shimmer sweep ────────────────────────────────────────────────────
      const hx = W * (Math.sin(t * 0.4) * 0.5 + 0.5)
      const gh = ctx.createLinearGradient(hx - W * 0.35, 0, hx + W * 0.35, H)
      gh.addColorStop(0,   'rgba(255,255,255,0)')
      gh.addColorStop(0.45,'rgba(255,255,255,0.04)')
      gh.addColorStop(0.5, 'rgba(255,255,255,0.09)')
      gh.addColorStop(0.55,'rgba(255,255,255,0.04)')
      gh.addColorStop(1,   'rgba(255,255,255,0)')
      ctx.fillStyle = gh
      ctx.fillRect(0, 0, W, H)

      // ── Vignette ─────────────────────────────────────────────────────────
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.05, W/2, H/2, Math.max(W,H)*0.8)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: 'block' }}
    />
  )
}
