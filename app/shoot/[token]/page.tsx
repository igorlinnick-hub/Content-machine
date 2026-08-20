import { notFound } from 'next/navigation'
import {
  boardToday,
  clinicByShootBoardToken,
  listShootBoard,
} from '@/lib/studio/schedule'
import ShootBoard from './ShootBoard'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: "What we're filming",
  // The link gets forwarded around a work chat; keep it out of search.
  robots: { index: false, follow: false },
}

// Public read-only shoot board — the link the MAs open.
//
// Auth is the token in the URL and nothing else: no login, no app install,
// no download. That is the entire point, so the surface is kept as small as
// it can be — this page reads scheduled cards for one clinic and exposes no
// mutation anywhere. It deliberately does NOT go through access_tokens,
// which would hand the holder a clinic-wide role.
export default async function ShootBoardPage({
  params,
}: {
  params: { token: string }
}) {
  const clinic = await clinicByShootBoardToken(params.token)
  if (!clinic) notFound()

  const today = boardToday()
  const cards = await listShootBoard(clinic.clinicId, { from: today })

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white">
      <ShootBoard clinicName={clinic.clinicName} cards={cards} today={today} />
    </div>
  )
}
