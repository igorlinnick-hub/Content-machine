'use client'

export function GradientBg() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: '#f8faff' }}
    >
      {/* Sky blue — drifts across center */}
      <div
        className="absolute rounded-full"
        style={{
          width: 700,
          height: 700,
          left: '10%',
          top: '-10%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)',
          filter: 'blur(64px)',
          animation: 'gb-blob-1 18s ease-in-out infinite alternate',
        }}
      />
      {/* Teal — bottom right */}
      <div
        className="absolute rounded-full"
        style={{
          width: 600,
          height: 600,
          right: '-5%',
          bottom: '10%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.20) 0%, transparent 70%)',
          filter: 'blur(72px)',
          animation: 'gb-blob-2 22s ease-in-out infinite alternate',
        }}
      />
      {/* Indigo — top right */}
      <div
        className="absolute rounded-full"
        style={{
          width: 500,
          height: 500,
          right: '15%',
          top: '5%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'gb-blob-3 26s ease-in-out infinite alternate',
        }}
      />
      {/* Amber — bottom left */}
      <div
        className="absolute rounded-full"
        style={{
          width: 450,
          height: 450,
          left: '5%',
          bottom: '0%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.13) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'gb-blob-4 20s ease-in-out infinite alternate',
        }}
      />

      <style>{`
        @keyframes gb-blob-1 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(120px, 80px) scale(1.12); }
          66%  { transform: translate(-60px, 140px) scale(0.95); }
          100% { transform: translate(80px, -60px) scale(1.08); }
        }
        @keyframes gb-blob-2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-100px, -80px) scale(1.1); }
          66%  { transform: translate(60px, -120px) scale(0.9); }
          100% { transform: translate(-80px, 60px) scale(1.15); }
        }
        @keyframes gb-blob-3 {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(-140px, 100px) scale(1.2); }
          100% { transform: translate(80px, 60px) scale(0.88); }
        }
        @keyframes gb-blob-4 {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(100px, -80px) scale(1.15); }
          100% { transform: translate(-50px, -40px) scale(0.92); }
        }
      `}</style>
    </div>
  )
}
