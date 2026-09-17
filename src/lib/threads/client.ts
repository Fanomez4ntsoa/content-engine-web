import 'server-only'
import { z } from 'zod'
import type { SearchPost } from '@/lib/search-types'
import { SEARCH_RESULT_LIMIT, keywordSearchResponseSchema, normalizePosts } from '@/lib/threads/posts'

/**
 * Domaines de la documentation Threads en vigueur (septembre 2026) :
 * threads.com pour l'autorisation, graph.threads.com pour l'API.
 */
export const THREADS_AUTHORIZE_URL = 'https://threads.com/oauth/authorize'
export const THREADS_GRAPH_ORIGIN = 'https://graph.threads.com'
export const THREADS_API_VERSION = 'v1.0'
export const THREADS_SCOPES = ['threads_basic', 'threads_keyword_search'] as const

const REQUEST_TIMEOUT_MS = 10_000

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/** Résumé d'erreur sans aucun contenu renvoyé par Meta (ni message, ni corps). */
export type ThreadsError = {
  kind: 'network' | 'timeout' | 'http_error' | 'invalid_response'
  status?: number
  metaCode?: number
  metaSubcode?: number
}

export type ThreadsResult<T> = { ok: true; data: T } | { ok: false; error: ThreadsError }

const metaErrorSchema = z.object({
  error: z.object({
    code: z.number().int().optional(),
    error_subcode: z.number().int().optional(),
  }),
})

/**
 * Réponse de l'échange du code. `user_id` est volontairement ignoré : c'est
 * un nombre JSON qui dépasse Number.MAX_SAFE_INTEGER, donc imprécis une fois
 * parsé. L'identifiant fiable vient de /me (chaîne).
 */
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
})

export type ShortLivedToken = { accessToken: string; expiresIn?: number }

const meResponseSchema = z.object({
  id: z.string().regex(/^\d+$/),
  username: z.string().min(1).max(100),
})

export type ThreadsProfile = { id: string; username: string }

async function requestJson<T>(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<ThreadsResult<T>> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    return { ok: false, error: { kind: timedOut ? 'timeout' : 'network' } }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    json = undefined
  }

  const metaError = metaErrorSchema.safeParse(json)
  if (!response.ok || metaError.success) {
    const details = metaError.success ? metaError.data.error : {}
    return {
      ok: false,
      error: {
        kind: 'http_error',
        status: response.status,
        ...(details.code === undefined ? {} : { metaCode: details.code }),
        ...(details.error_subcode === undefined ? {} : { metaSubcode: details.error_subcode }),
      },
    }
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) return { ok: false, error: { kind: 'invalid_response', status: response.status } }
  return { ok: true, data: parsed.data }
}

export function buildAuthorizeUrl(params: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL(THREADS_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.appId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', THREADS_SCOPES.join(','))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', params.state)
  return url.toString()
}

/** Échange du code : tous les paramètres, dont le secret, dans le corps form-urlencoded. */
export async function exchangeCodeForToken(
  params: { appId: string; appSecret: string; redirectUri: string; code: string },
  fetchImpl: FetchLike = fetch,
): Promise<ThreadsResult<ShortLivedToken>> {
  const body = new URLSearchParams({
    client_id: params.appId,
    client_secret: params.appSecret,
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
  })
  const result = await requestJson(
    fetchImpl,
    `${THREADS_GRAPH_ORIGIN}/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    },
    tokenResponseSchema,
  )
  if (!result.ok) return result
  return {
    ok: true,
    data: {
      accessToken: result.data.access_token,
      ...(result.data.expires_in === undefined ? {} : { expiresIn: result.data.expires_in }),
    },
  }
}

/** Jeton dans l'en-tête Authorization, jamais dans l'URL. */
export function fetchProfile(accessToken: string, fetchImpl: FetchLike = fetch): Promise<ThreadsResult<ThreadsProfile>> {
  const url = new URL(`${THREADS_GRAPH_ORIGIN}/${THREADS_API_VERSION}/me`)
  url.searchParams.set('fields', 'id,username')
  return requestJson(
    fetchImpl,
    url.toString(),
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
    meResponseSchema,
  )
}

/**
 * Recherche des posts publics récents. Jeton dans l'en-tête Authorization ;
 * seule la première page est lue (pagination ignorée), plafonnée.
 */
export async function searchKeyword(
  accessToken: string,
  keyword: string,
  fetchImpl: FetchLike = fetch,
): Promise<ThreadsResult<{ posts: SearchPost[]; dropped: number }>> {
  const url = new URL(`${THREADS_GRAPH_ORIGIN}/${THREADS_API_VERSION}/keyword_search`)
  url.searchParams.set('q', keyword)
  url.searchParams.set('search_type', 'RECENT')
  url.searchParams.set('fields', 'id,text,username,timestamp,permalink')
  url.searchParams.set('limit', String(SEARCH_RESULT_LIMIT))

  const result = await requestJson(
    fetchImpl,
    url.toString(),
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
    keywordSearchResponseSchema,
  )
  if (!result.ok) return result
  return { ok: true, data: normalizePosts(result.data.data) }
}
