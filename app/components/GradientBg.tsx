'use client'

export function GradientBg() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div className="cm-blob cm-blob-1" />
      <div className="cm-blob cm-blob-2" />
      <div className="cm-blob cm-blob-3" />
      <div className="cm-blob cm-blob-4" />
    </div>
  )
}
