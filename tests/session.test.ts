import { unsealData } from 'iron-session'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_TTL_SECONDS,
  createSessionData,
  readActiveSession,
  sealSession,
  sessionOptions,
  unsealSession,
} from '@/lib/session'

const SECRET = 'a'.repeat(32)
const OTHER_SECRET = 'b'.repeat(32)
const T0 = Date.UTC(2026, 8, 17, 12, 0, 0)
const user = { userId: '17841400000000000', username: 'laplateformeduportable', accessToken: 'THQV-token' }

afterEach(() => {
  vi.useRealTimers()
})

describe('sessionOptions', () => {
  it('uses an httpOnly, secure, lax cookie with a one-hour TTL', () => {
    const options = sessionOptions(SECRET)
    expect(options.ttl).toBe(3600)
    expect(options.cookieOptions).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
  })
})

describe('createSessionData', () => {
  it('sets expiresAt one hour after now', () => {
    expect(createSessionData(user, T0)).toEqual({ ...user, expiresAt: T0 + 3_600_000 })
  })

  it('refuses incomplete user data', () => {
    expect(() => createSessionData({ ...user, accessToken: '' }, T0)).toThrow()
  })
})

describe('readActiveSession', () => {
  const data = { ...user, expiresAt: T0 + 1000 }

  it('returns a complete, unexpired session', () => {
    expect(readActiveSession(data, T0)).toEqual(data)
  })

  it('returns null once expiresAt is reached', () => {
    expect(readActiveSession(data, T0 + 1000)).toBeNull()
  })

  it('returns null for an empty or incomplete session', () => {
    expect(readActiveSession({}, T0)).toBeNull()
    expect(readActiveSession({ ...data, username: undefined }, T0)).toBeNull()
    expect(readActiveSession(null, T0)).toBeNull()
  })
})

describe('sealSession / unsealSession', () => {
  it('round-trips the session data', async () => {
    const data = createSessionData(user)
    const seal = await sealSession(data, SECRET)
    expect(await unsealSession(seal, SECRET)).toEqual(data)
  })

  it('does not expose the token in clear text', async () => {
    const seal = await sealSession(createSessionData(user), SECRET)
    expect(seal).not.toContain(user.accessToken)
    expect(seal).not.toContain(user.username)
  })

  it('rejects a seal made with another secret', async () => {
    const seal = await sealSession(createSessionData(user), OTHER_SECRET)
    expect(await unsealSession(seal, SECRET)).toBeNull()
  })

  it('rejects a tampered seal', async () => {
    const seal = await sealSession(createSessionData(user), SECRET)
    const index = Math.floor(seal.length / 2)
    const tampered = `${seal.slice(0, index)}${seal[index] === 'A' ? 'B' : 'A'}${seal.slice(index + 1)}`
    expect(await unsealSession(tampered, SECRET)).toBeNull()
    expect(await unsealSession('garbage', SECRET)).toBeNull()
  })

  describe('with a simulated clock', () => {
    it('is valid just before the hour', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: T0 })
      const seal = await sealSession(createSessionData(user), SECRET)

      vi.setSystemTime(T0 + SESSION_TTL_SECONDS * 1000 - 1)
      expect(await unsealSession(seal, SECRET)).not.toBeNull()
    })

    it('is rejected by expiresAt as soon as the hour is over, even inside the seal skew', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: T0 })
      const seal = await sealSession(createSessionData(user), SECRET)

      // iron accepte encore le scellé (tolérance d'horloge de 60 s) : c'est expiresAt qui coupe.
      vi.setSystemTime(T0 + SESSION_TTL_SECONDS * 1000 + 1)
      expect(await unsealData(seal, { password: SECRET, ttl: SESSION_TTL_SECONDS })).toMatchObject(user)
      expect(await unsealSession(seal, SECRET)).toBeNull()
    })

    it('is rejected by the seal TTL even if expiresAt were still in the future', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: T0 })
      const forged = { ...user, expiresAt: T0 + 24 * 3_600_000 }
      const seal = await sealSession(forged, SECRET)

      vi.setSystemTime(T0 + 2 * SESSION_TTL_SECONDS * 1000)
      expect(await unsealSession(seal, SECRET)).toBeNull()
    })
  })
})
