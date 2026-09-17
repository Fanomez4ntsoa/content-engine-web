import { describe, expect, it } from 'vitest'
import { serializeCookie, serializeExpiredCookie } from '@/lib/cookies'

const attributes = { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth' } as const

describe('serializeCookie', () => {
  it('serializes every attribute', () => {
    expect(serializeCookie('__Secure-cew_oauth_state', 'abc_DEF-123', { ...attributes, maxAge: 600 })).toBe(
      '__Secure-cew_oauth_state=abc_DEF-123; Path=/api/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax',
    )
  })

  it('expires a cookie with the same path and an empty value', () => {
    expect(serializeExpiredCookie('__Secure-cew_oauth_state', attributes)).toBe(
      '__Secure-cew_oauth_state=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    )
  })

  it.each([
    ['a value with a separator', 'name', 'a;b'],
    ['a value with spaces', 'name', 'a b'],
    ['a name with a separator', 'na=me', 'value'],
  ])('refuses %s', (_label, name, value) => {
    expect(() => serializeCookie(name, value, { ...attributes, maxAge: 1 })).toThrow()
  })
})
