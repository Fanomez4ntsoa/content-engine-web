import 'server-only'
import { z } from 'zod'
import { parseKeyword } from '@/lib/keyword'
import type { SearchErrorBody, SearchErrorCode } from '@/lib/search-types'
import { noStoreJson } from '@/lib/http'
import { SEARCH_ERRORS } from '@/lib/threads/errors'

export const SEARCH_MAX_BODY_BYTES = 4096

const searchBodySchema = z.object({ keyword: z.unknown() })

export type SearchBodyResult =
  | { ok: true; keyword: string }
  | { ok: false; code: 'invalid_request' | 'invalid_keyword'; message?: string }

/** Corps attendu : {"keyword": "..."}. Le mot-clé passe par parseKeyword. */
export function parseSearchBody(text: string): SearchBodyResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, code: 'invalid_request' }
  }
  const body = searchBodySchema.safeParse(json)
  if (!body.success) return { ok: false, code: 'invalid_request' }

  const keyword = parseKeyword(body.data.keyword)
  return keyword.ok ? { ok: true, keyword: keyword.keyword } : { ok: false, code: 'invalid_keyword', message: keyword.message }
}

export function searchErrorResponse(
  code: SearchErrorCode,
  options: { message?: string | undefined; setCookies?: readonly string[] } = {},
): Response {
  const { status, message } = SEARCH_ERRORS[code]
  const body: SearchErrorBody = { error: { code, message: options.message ?? message } }
  const response = noStoreJson(body, status)
  for (const cookie of options.setCookies ?? []) response.headers.append('Set-Cookie', cookie)
  return response
}
