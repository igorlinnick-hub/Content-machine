'use client'

export function GradientBg() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundColor: '#f0f6ff' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {/* Sky blue — top left, large anchor blob */}
        <div style={{
          position: 'absolute',
          width: 900, height: 900,
          left: '-15%', top: '-20%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(14,165,233,0.32) 0%, transparent 65%)',
          filter: 'blur(80px)',
          animation: 'gb1 20s ease-in-out infinite alternate',
        }} />
        {/* Teal — bottom right */}
        <div style={{
          position: 'absolute',
          width: 800, height: 800,
          right: '-10%', bottom: '-10%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(20,184,166,0.28) 0%, transparent 65%)',
          filter: 'blur(80px)',
          animation: 'gb2 24s ease-in-out infinite alternate',
        }} />
        {/* Indigo — top right */}
        <div style={{
          position: 'absolute',
          width: 650, height: 650,
          right: '5%', top: '0%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(99,102,241,0.20) 0%, transparent 65%)',
          filter: 'blur(90px)',
          animation: 'gb3 28s ease-in-out infinite alternate',
        }} />
        {/* Amber — bottom left */}
        <div style={{
          position: 'absolute',
          width: 600, height: 600,
          left: '10%', bottom: '5%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(245,158,11,0.18) 0%, transparent 65%)',
          filter: 'blur(70px)',
          animation: 'gb4 22s ease-in-out infinite alternate',
        }} />
        {/* Center soft white glow — keeps it readable */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.55) 0%, transparent 100%)',
        }} />

        <style>{`
          @keyframes gb1 {
            0%   { transform: translate(0,0) scale(1); }
            40%  { transform: translate(140px,100px) scale(1.15); }
            70%  { transform: translate(60px,180px) scale(0.92); }
            100% { transform: translate(100px,-80px) scale(1.08); }
          }
          @keyframes gb2 {
            0%   { transform: translate(0,0) scale(1); }
            35%  { transform: translate(-120px,-100px) scale(1.12); }
            70%  { transform: translate(80px,-140px) scale(0.9); }
            100% { transform: translate(-60px,80px) scale(1.18); }
          }
          @keyframes gb3 {
            0%   { transform: translate(0,0) scale(1); }
            50%  { transform: translate(-160px,120px) scale(1.22); }
            100% { transform: translate(100px,80px) scale(0.85); }
          }
          @keyframes gb4 {
            0%   { transform: translate(0,0) scale(1); }
            45%  { transform: translate(120px,-100px) scale(1.18); }
            100% { transform: translate(-70px,-50px) scale(0.9); }
          }
        `}</style>
      </div>
    </>
  )
}
