'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { KEYWORD_MAX_LENGTH, type SearchErrorBody, type SearchPost, type SearchSuccessBody } from '@/lib/search-types'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; keyword: string; posts: SearchPost[] }
  | { status: 'error'; message: string }

const GENERIC_ERROR = 'The search could not be completed. Try again, or log out and log in again.'

export function SearchForm() {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const loading = state.status === 'loading'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setState({ status: 'loading' })

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
        credentials: 'same-origin',
        cache: 'no-store',
      })

      // Session absente ou jeton expiré (190) : le serveur a déjà détruit la session.
      if (response.status === 401) {
        router.replace('/?login=expired')
        return
      }

      const body = (await response.json()) as SearchSuccessBody | SearchErrorBody
      if (!response.ok || 'error' in body) {
        setState({ status: 'error', message: 'error' in body ? body.error.message : GENERIC_ERROR })
        return
      }
      setState({ status: 'done', keyword: keyword.trim(), posts: body.posts })
    } catch {
      setState({ status: 'error', message: GENERIC_ERROR })
    }
  }

  return (
    <section>
      <form className="search-form" onSubmit={onSubmit}>
        <label htmlFor="keyword" className="visually-hidden">
          Keyword
        </label>
        <input
          id="keyword"
          name="keyword"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="e.g. écran cassé"
          maxLength={KEYWORD_MAX_LENGTH}
          required
          autoComplete="off"
        />
        <button type="submit" disabled={loading} aria-busy={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div aria-live="polite">
        {state.status === 'error' && (
          <p role="alert" className="notice notice-error">
            {state.message}
          </p>
        )}

        {state.status === 'done' && state.posts.length === 0 && (
          <p className="notice">No recent public posts were found for this keyword.</p>
        )}

        {state.status === 'done' && state.posts.length > 0 && (
          <ol className="results">
            {state.posts.map((post) => (
              <li key={post.id} className="post">
                <p className="post-meta">
                  <span className="post-author">@{post.username}</span>
                  <time dateTime={post.timestamp.iso}>{post.timestamp.label}</time>
                </p>
                {post.text === undefined ? (
                  <p className="post-text muted">(No text)</p>
                ) : (
                  <p className="post-text">{post.text}</p>
                )}
                {post.permalink !== undefined && (
                  <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                    View on Threads
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
