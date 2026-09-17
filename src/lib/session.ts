import 'server-only'
import { sealData, unsealData, type SessionOptions } from 'iron-session'
import { z } from 'zod'

/** Aligné sur la durée de vie du jeton court Threads. */
export const SESSION_TTL_SECONDS = 3600
export const SESSION_COOKIE_NAME = '__Host-cew_session'

export const sessionDataSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  accessToken: z.string().min(1),
  /** Horodatage en millisecondes. */
  expiresAt: z.number().int().positive(),
})

export type SessionData = z.infer<typeof sessionDataSchema>

export function sessionOptions(secret: string): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: secret,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    },
  }
}

export function createSessionData(
  user: Pick<SessionData, 'userId' | 'username' | 'accessToken'>,
  now: number = Date.now(),
): SessionData {
  return sessionDataSchema.parse({ ...user, expiresAt: now + SESSION_TTL_SECONDS * 1000 })
}

/**
 * Renvoie la session si elle est complète et que `expiresAt` n'est pas
 * dépassé, sinon `null`. Contrôle indépendant du TTL du cookie scellé.
 */
export function readActiveSession(raw: unknown, now: number = Date.now()): SessionData | null {
  const parsed = sessionDataSchema.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data.expiresAt > now ? parsed.data : null
}

export function sealSession(data: SessionData, secret: string): Promise<string> {
  return sealData(data, { password: secret, ttl: SESSION_TTL_SECONDS })
}

/** Un scellé altéré, expiré ou chiffré avec un autre secret donne `null`. */
export async function unsealSession(seal: string, secret: string, now: number = Date.now()): Promise<SessionData | null> {
  const raw = await unsealData<unknown>(seal, { password: secret, ttl: SESSION_TTL_SECONDS })
  return readActiveSession(raw, now)
}
