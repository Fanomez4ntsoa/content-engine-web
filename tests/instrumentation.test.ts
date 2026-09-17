import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { register } from '@/instrumentation'
import { EnvError, parseEnv } from '@/lib/env'

const valid = {
  THREADS_APP_ID: '1234567890',
  THREADS_APP_SECRET: 'app-secret-value-xyz',
  THREADS_REDIRECT_URI: 'https://cew.example.com/api/auth/callback',
  APP_URL: 'https://cew.example.com',
  SESSION_SECRET: 'session-secret-value-'.padEnd(40, 'x'),
}

let warn: MockInstance

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubEnv('NEXT_RUNTIME', 'nodejs')
  vi.stubEnv('NEXT_PHASE', '')
  for (const [name, value] of Object.entries(valid)) vi.stubEnv(name, value)
})

describe('register (instrumentation)', () => {
  it('does not throw and logs only the names of the invalid variables', async () => {
    vi.stubEnv('SESSION_SECRET', 'short-secret-value')
    vi.stubEnv('THREADS_APP_ID', 'not-a-number')
    vi.stubEnv('THREADS_APP_SECRET', undefined)

    await expect(register()).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ event: 'env_invalid', variables: ['THREADS_APP_ID', 'THREADS_APP_SECRET', 'SESSION_SECRET'] }),
    )
    const logged = String(warn.mock.calls[0]?.[0])
    expect(logged).not.toContain('short-secret-value')
    expect(logged).not.toContain('not-a-number')
  })

  it('logs nothing when the configuration is valid', async () => {
    await register()
    expect(warn).not.toHaveBeenCalled()
  })

  it('does nothing during next build', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    vi.stubEnv('SESSION_SECRET', undefined)
    await register()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('EnvError.variables', () => {
  it('lists each invalid variable once, in declaration order', () => {
    try {
      parseEnv({ ...valid, APP_URL: 'http://cew.example.com', THREADS_REDIRECT_URI: 'https://other.example.com/cb' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError)
      expect((error as EnvError).variables).toEqual(['THREADS_REDIRECT_URI', 'APP_URL'])
    }
  })
})
