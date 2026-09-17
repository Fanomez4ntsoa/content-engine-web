import { describe, expect, it } from 'vitest'
import { createOAuthState, isValidOAuthState, oauthStateCookieOptions } from '@/lib/oauth-state'

describe('createOAuthState', () => {
  it('produces 43 base64url characters (32 random bytes)', () => {
    const state = createOAuthState()
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(state, 'base64url')).toHaveLength(32)
  })

  it('never repeats', () => {
    const states = new Set(Array.from({ length: 100 }, createOAuthState))
    expect(states.size).toBe(100)
  })
})

describe('isValidOAuthState', () => {
  const state = createOAuthState()

  it('accepts identical values', () => {
    expect(isValidOAuthState(state, state)).toBe(true)
  })

  it('rejects different values', () => {
    expect(isValidOAuthState(state, createOAuthState())).toBe(false)
  })

  it('rejects a missing cookie or a missing query parameter', () => {
    expect(isValidOAuthState(undefined, state)).toBe(false)
    expect(isValidOAuthState(state, null)).toBe(false)
    expect(isValidOAuthState(undefined, undefined)).toBe(false)
    expect(isValidOAuthState('', '')).toBe(false)
  })

  it('rejects values of different lengths', () => {
    expect(isValidOAuthState(state, state.slice(0, 42))).toBe(false)
    expect(isValidOAuthState(state, `${state}A`)).toBe(false)
  })

  it('rejects values that do not match the expected format, even if equal', () => {
    const forged = 'é'.repeat(43)
    expect(isValidOAuthState(forged, forged)).toBe(false)
  })
})

describe('oauthStateCookieOptions', () => {
  it('is httpOnly, secure, lax, scoped to /api/auth and lives 10 minutes', () => {
    expect(oauthStateCookieOptions).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 600,
    })
  })
})
