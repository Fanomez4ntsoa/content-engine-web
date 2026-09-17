import 'server-only'
import { z } from 'zod'
import type { Env } from '@/lib/env'
import { isValidOAuthState } from '@/lib/oauth-state'
import { createSessionData, type SessionData } from '@/lib/session'
import { exchangeCodeForToken, fetchProfile, type FetchLike, type ThreadsError } from '@/lib/threads/client'

/** Code fermé affiché sur l'accueil (`/?login=`). Rien d'autre ne remonte à l'utilisateur. */
export type LoginErrorCode = 'denied' | 'failed' | 'expired'

export type OAuthFailureReason =
  | 'authorization_denied'
  | 'authorization_error'
  | 'state_cookie_missing'
  | 'state_mismatch'
  | 'code_missing'
  | 'exchange_failed'
  | 'profile_failed'

export type OAuthCallbackResult =
  | { ok: true; session: SessionData }
  | { ok: false; login: LoginErrorCode; reason: OAuthFailureReason; error?: ThreadsError }

const codeSchema = z.string().min(1).max(2048)

function failure(login: LoginErrorCode, reason: OAuthFailureReason, error?: ThreadsError): OAuthCallbackResult {
  return error ? { ok: false, login, reason, error } : { ok: false, login, reason }
}

/**
 * Déroule le retour d'autorisation Threads, sans toucher aux cookies :
 * refus → state → code → échange → /me → données de session.
 * `error_reason` et `error_description` ne sont jamais lus.
 */
export async function resolveOAuthCallback(input: {
  searchParams: URLSearchParams
  stateCookie: string | undefined
  env: Pick<Env, 'THREADS_APP_ID' | 'THREADS_APP_SECRET' | 'THREADS_REDIRECT_URI'>
  now: number
  fetchImpl?: FetchLike
}): Promise<OAuthCallbackResult> {
  const { searchParams, stateCookie, env, now, fetchImpl } = input

  const authorizationError = searchParams.get('error')
  if (authorizationError !== null) {
    return authorizationError === 'access_denied'
      ? failure('denied', 'authorization_denied')
      : failure('failed', 'authorization_error')
  }

  if (!stateCookie) return failure('expired', 'state_cookie_missing')
  if (!isValidOAuthState(stateCookie, searchParams.get('state'))) return failure('failed', 'state_mismatch')

  const code = codeSchema.safeParse(searchParams.get('code'))
  if (!code.success) return failure('failed', 'code_missing')

  const token = await exchangeCodeForToken(
    {
      appId: env.THREADS_APP_ID,
      appSecret: env.THREADS_APP_SECRET,
      redirectUri: env.THREADS_REDIRECT_URI,
      code: code.data,
    },
    fetchImpl,
  )
  if (!token.ok) return failure('failed', 'exchange_failed', token.error)

  const profile = await fetchProfile(token.data.accessToken, fetchImpl)
  if (!profile.ok) return failure('failed', 'profile_failed', profile.error)

  return {
    ok: true,
    session: createSessionData(
      { userId: profile.data.id, username: profile.data.username, accessToken: token.data.accessToken },
      now,
      token.data.expiresIn,
    ),
  }
}
