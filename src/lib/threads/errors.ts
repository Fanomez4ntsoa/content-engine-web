import type { SearchErrorCode } from '@/lib/search-types'
import type { ThreadsError } from '@/lib/threads/client'

/** Jeton invalide ou expiré (Graph API). */
const TOKEN_ERROR_CODES = new Set([190])
/** Limites de débit Graph API ; la doc keyword_search ne précise pas le code exact. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
/** Permission absente ou refusée : 10 et la plage 200-299. */
const isPermissionCode = (code: number) => code === 10 || (code >= 200 && code <= 299)

export type UpstreamSearchErrorCode = Extract<
  SearchErrorCode,
  'session_expired' | 'quota_exceeded' | 'permission_missing' | 'upstream_unavailable' | 'upstream_unknown'
>

export function classifySearchError(error: ThreadsError): UpstreamSearchErrorCode {
  if (error.kind === 'network' || error.kind === 'timeout') return 'upstream_unavailable'
  if (error.metaCode !== undefined) {
    if (TOKEN_ERROR_CODES.has(error.metaCode)) return 'session_expired'
    if (RATE_LIMIT_CODES.has(error.metaCode)) return 'quota_exceeded'
    if (isPermissionCode(error.metaCode)) return 'permission_missing'
  }
  if (error.status === 429) return 'quota_exceeded'
  if (error.status === 401) return 'session_expired'
  // Cas vécu : 500 « An unknown error occurred » quand la permission manque au jeton.
  // Impossible à distinguer d'une vraie panne : message prudent.
  return 'upstream_unknown'
}

export const SEARCH_ERRORS: Record<SearchErrorCode, { status: number; message: string }> = {
  not_authenticated: { status: 401, message: 'Please log in with Threads.' },
  session_expired: { status: 401, message: 'Your session has expired. Please log in again.' },
  forbidden_origin: { status: 403, message: 'This request was not allowed. Reload the page and try again.' },
  unsupported_media_type: { status: 415, message: 'Unsupported request format.' },
  body_too_large: { status: 413, message: 'The request is too large.' },
  invalid_request: { status: 400, message: 'Invalid request.' },
  invalid_keyword: { status: 400, message: 'Invalid keyword.' },
  quota_exceeded: {
    status: 429,
    message: 'The daily search limit has been reached. Please try again later.',
  },
  permission_missing: {
    status: 403,
    message: 'Keyword search is not allowed for this account. Log out, then log in again and accept all requested permissions.',
  },
  upstream_unavailable: { status: 502, message: 'Threads could not be reached. Please try again in a moment.' },
  upstream_unknown: { status: 502, message: 'The search could not be completed. Try again, or log out and log in again.' },
}
