import type { SearchErrorCode, SearchPost } from '@/lib/search-types'

export type SearchOutcome =
  | { kind: 'redirect'; to: '/?login=expired' }
  | { kind: 'results'; posts: SearchPost[] }
  | { kind: 'error'; code: SearchErrorCode | 'unexpected'; message: string }

export const GENERIC_SEARCH_ERROR = 'The search could not be completed. Try again, or log out and log in again.'

const REDIRECT_CODES = new Set<string>(['not_authenticated', 'session_expired'])

function readErrorBody(body: unknown): { code: SearchErrorCode; message: string } | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined
  const error = (body as { error: unknown }).error
  if (typeof error !== 'object' || error === null) return undefined
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code !== 'string' || typeof message !== 'string') return undefined
  return { code: code as SearchErrorCode, message }
}

/**
 * Décide quoi afficher à partir du corps de /api/search. Le code d'erreur du
 * corps fait foi : deux 403 (Origin refusée, permission manquante) donnent
 * des messages différents. Le statut ne sert qu'en dernier recours.
 */
export function interpretSearchResponse(status: number, body: unknown): SearchOutcome {
  const error = readErrorBody(body)
  if (error) {
    if (REDIRECT_CODES.has(error.code)) return { kind: 'redirect', to: '/?login=expired' }
    return { kind: 'error', code: error.code, message: error.message }
  }

  if (status === 200 && typeof body === 'object' && body !== null && Array.isArray((body as { posts?: unknown }).posts)) {
    return { kind: 'results', posts: (body as { posts: SearchPost[] }).posts }
  }

  if (status === 401) return { kind: 'redirect', to: '/?login=expired' }
  return { kind: 'error', code: 'unexpected', message: GENERIC_SEARCH_ERROR }
}
