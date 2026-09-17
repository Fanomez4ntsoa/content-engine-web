import type { Metadata } from 'next'
import { connection } from 'next/server'
import { DataDeletionInstructions } from '@/components/legal/data-deletion-instructions'
import { getAppUrl } from '@/lib/env'

export const metadata: Metadata = { title: 'Data Deletion Instructions' }

export default async function DataDeletionPage() {
  // Rendu à la requête : le build ne dépend pas d'APP_URL. Aucune session, aucun secret.
  await connection()
  return (
    <main className="page">
      <DataDeletionInstructions appUrl={getAppUrl()} />
    </main>
  )
}
