import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PrivacyPolicy } from '@/components/legal/privacy-policy'
import { getAppUrl } from '@/lib/env'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default async function PrivacyPage() {
  // Rendu à la requête : le build ne dépend pas d'APP_URL. Aucune session, aucun secret.
  await connection()
  return (
    <main className="page">
      <PrivacyPolicy appUrl={getAppUrl()} />
    </main>
  )
}
