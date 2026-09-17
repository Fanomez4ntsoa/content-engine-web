import 'server-only'
import { getIronSession, sealData, unsealData, webCookies, type SessionOptions } from 'iron-session'
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

/**
 * `expiresAt` = min(maintenant + 1 h, maintenant + expires_in) : la session
 * ne survit jamais au jeton, ni à la durée maximale fixée par l'app.
 */
export function createSessionData(
  user: Pick<SessionData, 'userId' | 'username' | 'accessToken'>,
  now: number = Date.now(),
  expiresInSeconds?: number,
): SessionData {
  const lifetimeSeconds =
    expiresInSeconds === undefined ? SESSION_TTL_SECONDS : Math.min(SESSION_TTL_SECONDS, expiresInSeconds)
  return sessionDataSchema.parse({ ...user, expiresAt: now + lifetimeSeconds * 1000 })
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

/**
 * Remplace entièrement la session : les champs d'un éventuel cookie existant
 * sont effacés avant l'écriture. Le Set-Cookie est ajouté à `responseHeaders`.
 */
export async function replaceSession(
  request: Request,
  responseHeaders: Headers,
  data: SessionData,
  secret: string,
): Promise<void> {
  const session = await getIronSession<Record<string, unknown>>(webCookies(request, responseHeaders), sessionOptions(secret))
  for (const key of Object.keys(session)) delete session[key]
  Object.assign(session, sessionDataSchema.parse(data))
  await session.save()
}

/** Vide la session et expire le cookie (Set-Cookie ajouté à `responseHeaders`). */
export async function destroySession(request: Request, responseHeaders: Headers, secret: string): Promise<void> {
  const session = await getIronSession(webCookies(request, responseHeaders), sessionOptions(secret))
  session.destroy()
}

/** Lecture seule depuis une Request (route handlers) : aucun Set-Cookie n'est émis. */
export async function readSessionFromRequest(
  request: Request,
  secret: string,
  now: number = Date.now(),
): Promise<SessionData | null> {
  const session = await getIronSession(webCookies(request, new Headers()), sessionOptions(secret))
  return readActiveSession({ ...session }, now)
}
