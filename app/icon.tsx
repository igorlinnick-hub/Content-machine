import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0ea5e9',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <path
            d="M3 20 Q9 8 16 20 T29 20"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M3 13 Q9 25 16 13 T29 13"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="2.6" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
