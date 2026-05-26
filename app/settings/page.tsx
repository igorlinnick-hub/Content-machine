import { redirect } from 'next/navigation'

// /settings is gone — clinic profile + brand + install link live in
// /clinics (the back-office hub). Keep this route as a permanent
// redirect so old bookmarks, TG links, and admin muscle-memory all
// still land in the right place.

interface SettingsPageProps {
  searchParams: { clinicId?: string }
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  const qs = searchParams.clinicId
    ? `?clinicId=${searchParams.clinicId}`
    : ''
  redirect(`/clinics${qs}`)
}
