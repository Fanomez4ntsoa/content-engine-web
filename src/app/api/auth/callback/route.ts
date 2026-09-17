import type { NextRequest } from 'next/server'
import { serializeExpiredCookie } from '@/lib/cookies'
import { getEnv } from '@/lib/env'
import { redirectHeaders, seeOther } from '@/lib/http'
import { logWarning } from '@/lib/log'
import { resolveOAuthCallback } from '@/lib/oauth'
import { OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions } from '@/lib/oauth-state'
import { replaceSession } from '@/lib/session'

/** Retour d'autorisation Threads. Le cookie state est supprimé quelle que soit l'issue. */
export async function GET(request: NextRequest): Promise<Response> {
  const env = getEnv()
  const result = await resolveOAuthCallback({
    searchParams: request.nextUrl.searchParams,
    stateCookie: request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value,
    env,
    now: Date.now(),
  })

  const headers = redirectHeaders(env.APP_URL, result.ok ? '/search' : `/?login=${result.login}`)
  headers.append('Set-Cookie', serializeExpiredCookie(OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions))

  if (!result.ok) {
    logWarning({
      event: 'oauth_callback_failed',
      reason: result.reason,
      ...(result.error ? { error: result.error } : {}),
    })
    return seeOther(headers)
  }

  await replaceSession(request, headers, result.session, env.SESSION_SECRET)
  return seeOther(headers)
}
