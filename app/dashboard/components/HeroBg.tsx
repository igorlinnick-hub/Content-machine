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

      // ── Base dark fill ──────────────────────────────────────────────────
      ctx.fillStyle = '#08101f'
      ctx.fillRect(0, 0, W, H)

      // ── Diagonal stripe texture ─────────────────────────────────────────
      // Angle: -45deg. Each stripe slightly lighter, animated with sin wave.
      const sw = 24 * dpr
      const count = Math.ceil((W + H) / sw) + 2
      for (let i = -1; i < count; i++) {
        const wave = Math.sin(i * 0.28 + t * 1.5) * 0.5 + 0.5
        const alpha = 0.04 + wave * 0.055
        ctx.fillStyle = `rgba(148,163,184,${alpha.toFixed(3)})`
        ctx.beginPath()
        // top-right to bottom-left diagonal
        const x = i * sw - H
        ctx.moveTo(x, 0)
        ctx.lineTo(x + sw * 0.72, 0)
        ctx.lineTo(x + sw * 0.72 + H, H)
        ctx.lineTo(x + H, H)
        ctx.closePath()
        ctx.fill()
      }

      // ── Aurora glow 1 — sky blue, slowly drifting ──────────────────────
      const ax = W * (0.45 + 0.35 * Math.sin(t * 0.45))
      const ay = H * (0.5  + 0.25 * Math.cos(t * 0.38))
      const ar = Math.sqrt(W * W + H * H) * 0.58
      const ga1 = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar)
      ga1.addColorStop(0,   'rgba(14,165,233,0.42)')
      ga1.addColorStop(0.35,'rgba(56,189,248,0.18)')
      ga1.addColorStop(1,   'rgba(14,165,233,0)')
      ctx.fillStyle = ga1
      ctx.fillRect(0, 0, W, H)

      // ── Aurora glow 2 — teal, opposite rhythm ──────────────────────────
      const bx = W * (0.18 + 0.14 * Math.cos(t * 0.3))
      const by = H * (0.75 + 0.12 * Math.sin(t * 0.26))
      const ga2 = ctx.createRadialGradient(bx, by, 0, bx, by, W * 0.5)
      ga2.addColorStop(0,   'rgba(20,184,166,0.32)')
      ga2.addColorStop(0.5, 'rgba(20,184,166,0.08)')
      ga2.addColorStop(1,   'rgba(20,184,166,0)')
      ctx.fillStyle = ga2
      ctx.fillRect(0, 0, W, H)

      // ── Warm accent — top-left corner, subtle ──────────────────────────
      const warmR = W * (0.38 + 0.06 * Math.sin(t * 0.2))
      const ga3 = ctx.createRadialGradient(0, 0, 0, 0, 0, warmR)
      ga3.addColorStop(0,   'rgba(251,146,60,0.22)')
      ga3.addColorStop(0.5, 'rgba(251,146,60,0.06)')
      ga3.addColorStop(1,   'rgba(251,146,60,0)')
      ctx.fillStyle = ga3
      ctx.fillRect(0, 0, W, H)

      // ── Bright highlight sweep — the "shimmer" ─────────────────────────
      const hx = W * (Math.sin(t * 0.55) * 0.5 + 0.5)
      const gh = ctx.createLinearGradient(hx - W * 0.3, 0, hx + W * 0.3, H)
      gh.addColorStop(0,   'rgba(255,255,255,0)')
      gh.addColorStop(0.4, 'rgba(255,255,255,0.03)')
      gh.addColorStop(0.5, 'rgba(255,255,255,0.07)')
      gh.addColorStop(0.6, 'rgba(255,255,255,0.03)')
      gh.addColorStop(1,   'rgba(255,255,255,0)')
      ctx.fillStyle = gh
      ctx.fillRect(0, 0, W, H)

      // ── Vignette — darken edges for depth ─────────────────────────────
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.1, W/2, H/2, Math.max(W, H) * 0.75)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.55)')
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
