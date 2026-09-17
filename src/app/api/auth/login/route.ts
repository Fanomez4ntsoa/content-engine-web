import { serializeCookie } from '@/lib/cookies'
import { getEnv } from '@/lib/env'
import { NO_STORE_HEADERS } from '@/lib/http'
import { OAUTH_STATE_COOKIE_NAME, createOAuthState, oauthStateCookieOptions } from '@/lib/oauth-state'
import { buildAuthorizeUrl } from '@/lib/threads/client'

/** Démarre l'autorisation Threads : state aléatoire en cookie, puis redirection. */
export function GET(): Response {
  const env = getEnv()
  const state = createOAuthState()

  const headers = new Headers({
    ...NO_STORE_HEADERS,
    Location: buildAuthorizeUrl({ appId: env.THREADS_APP_ID, redirectUri: env.THREADS_REDIRECT_URI, state }),
  })
  headers.append('Set-Cookie', serializeCookie(OAUTH_STATE_COOKIE_NAME, state, oauthStateCookieOptions))
  return new Response(null, { status: 303, headers })
}
