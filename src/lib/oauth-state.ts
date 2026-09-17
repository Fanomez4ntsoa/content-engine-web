import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'

export const OAUTH_STATE_COOKIE_NAME = '__Secure-cew_oauth_state'
export const OAUTH_STATE_TTL_SECONDS = 600

/** Le cookie n'est envoyé qu'aux routes /api/auth/*. */
export const oauthStateCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: OAUTH_STATE_TTL_SECONDS,
} as const

const STATE_BYTES = 32
const STATE_FORMAT = /^[A-Za-z0-9_-]{43}$/

/** 32 octets aléatoires en base64url (43 caractères). */
export function createOAuthState(): string {
  return randomBytes(STATE_BYTES).toString('base64url')
}

/** Compare le state du cookie et celui du callback, en temps constant. */
export function isValidOAuthState(expected: string | null | undefined, received: string | null | undefined): boolean {
  if (typeof expected !== 'string' || typeof received !== 'string') return false
  if (!STATE_FORMAT.test(expected) || !STATE_FORMAT.test(received)) return false

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
