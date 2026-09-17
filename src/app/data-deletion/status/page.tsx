import type { Metadata } from 'next'
import { DeletionStatus } from '@/components/legal/deletion-status'

export const metadata: Metadata = { title: 'Deletion Request Status', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Aucune session, aucun secret, aucune variable : lit seulement ?code= (rendu à la requête via searchParams). */
export default async function DeletionStatusPage({ searchParams }: Props) {
  const { code } = await searchParams
  return (
    <main className="page">
      <DeletionStatus code={code} />
    </main>
  )
}
