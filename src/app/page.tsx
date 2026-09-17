import type { Metadata } from 'next'
import Link from 'next/link'
import { loginMessageFor } from '@/lib/login-message'
import { getServerSession } from '@/lib/session-server'

export const metadata: Metadata = { title: { absolute: 'Content Engine Listening' } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function HomePage({ searchParams }: Props) {
  const { login } = await searchParams
  const message = loginMessageFor(login)
  const session = await getServerSession()

  return (
    <main className="page">
      <h1>Content Engine Listening</h1>
      <p className="lead">
        A personal tool that finds recent public Threads posts about mobile phones, so that the team of La Plateforme du
        Portable can reply to them manually on Threads.
      </p>
      <ul className="facts">
        <li>Reads public posts only, through the Threads keyword search.</li>
        <li>Never publishes, replies, likes, follows or sends messages.</li>
        <li>Search results are displayed on screen and never stored.</li>
      </ul>

      {message !== undefined && (
        <p role="status" className="notice">
          {message}
        </p>
      )}

      <div className="actions">
        {session ? (
          <Link className="button" href="/search">
            Continue to search as @{session.username}
          </Link>
        ) : (
          // Lien simple (pas de formulaire ni de préchargement) : la redirection vers threads.com
          // ne doit pas passer par une soumission de formulaire, bloquée par form-action 'self'.
          <a className="button" href="/api/auth/login">
            Log in with Threads
          </a>
        )}
      </div>

      <p className="muted">
        Read the <Link href="/privacy">Privacy Policy</Link> and the{' '}
        <Link href="/data-deletion">Data Deletion Instructions</Link>.
      </p>
    </main>
  )
}
