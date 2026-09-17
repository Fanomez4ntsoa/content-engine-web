import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/session-server'
import { SearchForm } from './search-form'

export const metadata: Metadata = { title: 'Search' }

export default async function SearchPage() {
  // Protection vérifiée ici, dans la page elle-même.
  const session = await getServerSession()
  if (!session) redirect('/')

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Search Threads</h1>
          <p className="muted">
            Logged in as <strong>@{session.username}</strong>
          </p>
        </div>
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="button-secondary">
            Log out
          </button>
        </form>
      </header>

      <p className="muted">
        Recent public posts matching a keyword. Results are displayed only and are not stored.
      </p>

      <SearchForm />
    </main>
  )
}
