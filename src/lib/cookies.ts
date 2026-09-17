export type CookieAttributes = {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict'
  path: string
  maxAge: number
}

const COOKIE_NAME = /^[A-Za-z0-9_-]+$/
const COOKIE_VALUE = /^[A-Za-z0-9_-]*$/

/**
 * Sérialise un Set-Cookie pour les cookies simples de l'app (valeurs
 * base64url). Le cookie de session passe, lui, par iron-session.
 */
export function serializeCookie(name: string, value: string, attributes: CookieAttributes): string {
  const bareName = name.replace(/^__(Secure|Host)-/, '')
  if (!COOKIE_NAME.test(bareName) || !COOKIE_VALUE.test(value)) throw new Error('Unsupported cookie name or value')

  const parts = [`${name}=${value}`, `Path=${attributes.path}`, `Max-Age=${Math.max(0, Math.floor(attributes.maxAge))}`]
  if (attributes.httpOnly) parts.push('HttpOnly')
  if (attributes.secure) parts.push('Secure')
  parts.push(`SameSite=${attributes.sameSite === 'lax' ? 'Lax' : 'Strict'}`)
  return parts.join('; ')
}

/** Expiration immédiate : mêmes Path et attributs que l'écriture, sinon le navigateur l'ignore. */
export function serializeExpiredCookie(name: string, attributes: Omit<CookieAttributes, 'maxAge'>): string {
  return serializeCookie(name, '', { ...attributes, maxAge: 0 })
}
