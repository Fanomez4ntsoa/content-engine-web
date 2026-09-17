import { describe, expect, it } from 'vitest'
import { EnvError, parseAppUrl, parseEnv } from '@/lib/env'

const valid = {
  THREADS_APP_ID: '1234567890',
  THREADS_APP_SECRET: 'app-secret-value',
  THREADS_REDIRECT_URI: 'https://cew.example.com/api/auth/callback',
  APP_URL: 'https://cew.example.com',
  SESSION_SECRET: 'x'.repeat(32),
}

function errorOf(source: Record<string, string | undefined>): EnvError {
  try {
    parseEnv(source)
  } catch (error) {
    if (error instanceof EnvError) return error
    throw error
  }
  throw new Error('expected parseEnv to throw')
}

describe('parseEnv', () => {
  it('accepts a valid configuration', () => {
    expect(parseEnv(valid)).toEqual(valid)
  })

  it('normalizes a trailing slash on APP_URL', () => {
    expect(parseEnv({ ...valid, APP_URL: 'https://cew.example.com/' }).APP_URL).toBe('https://cew.example.com')
  })

  it('allows http on localhost only', () => {
    const local = {
      ...valid,
      APP_URL: 'http://localhost:3000',
      THREADS_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
    }
    expect(parseEnv(local).APP_URL).toBe('http://localhost:3000')
    expect(errorOf({ ...valid, APP_URL: 'http://cew.example.com' }).message).toMatch(/APP_URL must use https/)
  })

  it('rejects a SESSION_SECRET shorter than 32 characters', () => {
    expect(errorOf({ ...valid, SESSION_SECRET: 'x'.repeat(31) }).message).toMatch(/SESSION_SECRET must be at least 32/)
  })

  it('reports every missing variable by name', () => {
    const message = errorOf({}).message
    for (const name of Object.keys(valid)) expect(message).toContain(`${name} is required`)
  })

  it('rejects a redirect URI that does not match APP_URL', () => {
    const error = errorOf({ ...valid, THREADS_REDIRECT_URI: 'https://other.example.com/api/auth/callback' })
    expect(error.message).toMatch(/THREADS_REDIRECT_URI must be exactly APP_URL/)
  })

  it('rejects an APP_URL with a path', () => {
    expect(errorOf({ ...valid, APP_URL: 'https://cew.example.com/app' }).message).toMatch(/APP_URL must be an origin/)
  })

  it('rejects a non-numeric app id', () => {
    expect(errorOf({ ...valid, THREADS_APP_ID: 'abc' }).message).toMatch(/THREADS_APP_ID/)
  })

  it('never includes secret values in the error message', () => {
    const message = errorOf({ ...valid, SESSION_SECRET: 'short-secret', THREADS_APP_ID: 'abc' }).message
    expect(message).not.toContain('short-secret')
    expect(message).not.toContain(valid.THREADS_APP_SECRET)
  })
})

describe('parseAppUrl', () => {
  it('only needs APP_URL', () => {
    expect(parseAppUrl({ APP_URL: 'https://cew.example.com/' })).toBe('https://cew.example.com')
  })

  it('rejects a missing or invalid APP_URL by name', () => {
    expect(() => parseAppUrl({})).toThrow('APP_URL is required')
    expect(() => parseAppUrl({ APP_URL: 'http://cew.example.com' })).toThrow(/APP_URL must use https/)
  })
})
