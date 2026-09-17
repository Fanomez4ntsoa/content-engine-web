import type { NextRequest } from 'next/server'
import { getEnv } from '@/lib/env'
import { hasMediaType, methodNotAllowed, noStoreJson, readBodyWithLimit } from '@/lib/http'
import { logWarning } from '@/lib/log'
import { hasTrustedOrigin } from '@/lib/origin'
import { SEARCH_MAX_BODY_BYTES, parseSearchBody, searchErrorResponse } from '@/lib/search'
import type { SearchSuccessBody } from '@/lib/search-types'
import { destroySession, readSessionFromRequest } from '@/lib/session'
import { classifySearchError } from '@/lib/threads/errors'
import { searchKeyword } from '@/lib/threads/client'

export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv()
  if (!hasTrustedOrigin(request, env.APP_URL)) return searchErrorResponse('forbidden_origin')

  const session = await readSessionFromRequest(request, env.SESSION_SECRET)
  if (!session) return searchErrorResponse('not_authenticated')

  if (!hasMediaType(request, 'application/json')) return searchErrorResponse('unsupported_media_type')
  const text = await readBodyWithLimit(request, SEARCH_MAX_BODY_BYTES)
  if (text === null) return searchErrorResponse('body_too_large')

  const body = parseSearchBody(text)
  if (!body.ok) return searchErrorResponse(body.code, { message: body.message })

  const result = await searchKeyword(session.accessToken, body.keyword)
  if (!result.ok) {
    const code = classifySearchError(result.error)
    logWarning({ event: 'search_failed', code, error: result.error })

    if (code === 'session_expired') {
      // Jeton invalide ou expiré : la session ne sert plus à rien, on la détruit.
      const headers = new Headers()
      await destroySession(request, headers, env.SESSION_SECRET)
      return searchErrorResponse(code, { setCookies: headers.getSetCookie() })
    }
    return searchErrorResponse(code)
  }

  const payload: SearchSuccessBody = { posts: result.data }
  return noStoreJson(payload)
}

export function GET(): Response {
  return methodNotAllowed(['POST'])
}
