import { sealData } from 'iron-session'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as callbackRoute from '@/app/api/auth/callback/route'
import * as loginRoute from '@/app/api/auth/login/route'
import * as logoutRoute from '@/app/api/auth/logout/route'
import { OAUTH_STATE_COOKIE_NAME, createOAuthState } from '@/lib/oauth-state'
import { SESSION_COOKIE_NAME, sealSession, unsealSession } from '@/lib/session'

const APP_URL = 'https://cew.example.com'
const APP_ID = '1234567890'
const APP_SECRET = 'threads-app-secret-for-tests'
const SESSION_SECRET = 's'.repeat(32)
const REDIRECT_URI = `${APP_URL}/api/auth/callback`
const ACCESS_TOKEN = 'THQVJ-short-lived-token-value'
const AUTH_CODE = 'AQBx-authorization-code-value'
const USER_ID = '17841405793187218'
const USERNAME = 'laplateformeduportable'
const T0 = Date.UTC(2026, 8, 17, 12, 0, 0)

let consoleSpies: MockInstance[] = []

beforeEach(() => {
  vi.stubEnv('THREADS_APP_ID', APP_ID)
  vi.stubEnv('THREADS_APP_SECRET', APP_SECRET)
  vi.stubEnv('THREADS_REDIRECT_URI', REDIRECT_URI)
  vi.stubEnv('APP_URL', APP_URL)
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
  vi.useFakeTimers({ toFake: ['Date'], now: T0 })
  consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

/** Tout ce qui a été journalisé pendant le test, concaténé. */
function loggedText(): string {
  return consoleSpies.flatMap((spy) => spy.mock.calls.flat().map(String)).join('\n')
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie()
}

function findCookie(response: Response, name: string): string | undefined {
  return setCookies(response).find((cookie) => cookie.startsWith(`${name}=`))
}

function cookieValue(setCookie: string): string {
  return setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'))
}

// ---------------------------------------------------------------------------
// fetch simulé : échange du code puis /me
// ---------------------------------------------------------------------------

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>

function mockThreads(handlers: { exchange?: Handler; me?: Handler }) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    if (url.origin === 'https://graph.threads.com' && url.pathname === '/oauth/access_token' && handlers.exchange) {
      return handlers.exchange(url, init)
    }
    if (url.origin === 'https://graph.threads.com' && url.pathname === '/v1.0/me' && handlers.me) {
      return handlers.me(url, init)
    }
    throw new Error(`Unexpected fetch: ${url.origin}${url.pathname}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const okExchange: Handler = () => Response.json({ access_token: ACCESS_TOKEN, token_type: 'bearer', user_id: 17841405793187218 })
const okMe: Handler = () => Response.json({ id: USER_ID, username: USERNAME })

function callbackRequest(options: { query: Record<string, string>; stateCookie?: string; extraCookies?: string[] }) {
  const url = new URL('/api/auth/callback', APP_URL)
  for (const [key, value] of Object.entries(options.query)) url.searchParams.set(key, value)
  const cookies = [
    ...(options.stateCookie === undefined ? [] : [`${OAUTH_STATE_COOKIE_NAME}=${options.stateCookie}`]),
    ...(options.extraCookies ?? []),
  ]
  return new NextRequest(url, { headers: cookies.length ? { cookie: cookies.join('; ') } : {} })
}

/** Le cookie state doit être expiré, avec le même Path que lors de son écriture. */
function expectStateCookieDeleted(response: Response) {
  const cookie = findCookie(response, OAUTH_STATE_COOKIE_NAME)
  expect(cookie).toBeDefined()
  expect(cookie).toMatch(/Max-Age=0/)
  expect(cookie).toMatch(/Path=\/api\/auth(;|$)/)
  expect(cookieValue(cookie ?? '')).toBe('')
}

function expectLoginRedirect(response: Response, code: 'denied' | 'failed' | 'expired') {
  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe(`${APP_URL}/?login=${code}`)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(findCookie(response, SESSION_COOKIE_NAME)).toBeUndefined()
  expectStateCookieDeleted(response)
}

// ---------------------------------------------------------------------------

describe('GET /api/auth/login', () => {
  it('redirects to the Threads authorization window with a fresh state', () => {
    const response = loginRoute.GET()
    expect(response.status).toBe(303)
    expect(response.headers.get('cache-control')).toBe('no-store')

    const location = new URL(response.headers.get('location') ?? '')
    expect(`${location.origin}${location.pathname}`).toBe('https://threads.com/oauth/authorize')
    expect(Object.fromEntries(location.searchParams)).toEqual({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'threads_basic,threads_keyword_search',
      response_type: 'code',
      state: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    })

    const stateCookie = findCookie(response, OAUTH_STATE_COOKIE_NAME) ?? ''
    expect(cookieValue(stateCookie)).toBe(location.searchParams.get('state'))
    expect(stateCookie).toBe(
      `${OAUTH_STATE_COOKIE_NAME}=${location.searchParams.get('state')}; Path=/api/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    )
    expect(response.headers.get('location')).not.toContain(APP_SECRET)
  })

  it('uses a different state on each call', () => {
    const state = (response: Response) => new URL(response.headers.get('location') ?? '').searchParams.get('state')
    expect(state(loginRoute.GET())).not.toBe(state(loginRoute.GET()))
  })
})

describe('GET /api/auth/callback — failures', () => {
  it('redirects with login=expired when the state cookie is missing, without calling Threads', async () => {
    const fetchMock = mockThreads({ exchange: okExchange, me: okMe })
    const response = await callbackRoute.GET(callbackRequest({ query: { code: AUTH_CODE, state: createOAuthState() } }))
    expectLoginRedirect(response, 'expired')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirects with login=failed when the state differs', async () => {
    const fetchMock = mockThreads({ exchange: okExchange, me: okMe })
    const response = await callbackRoute.GET(
      callbackRequest({ query: { code: AUTH_CODE, state: createOAuthState() }, stateCookie: createOAuthState() }),
    )
    expectLoginRedirect(response, 'failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirects with login=failed when the state parameter is missing', async () => {
    mockThreads({})
    const response = await callbackRoute.GET(callbackRequest({ query: { code: AUTH_CODE }, stateCookie: createOAuthState() }))
    expectLoginRedirect(response, 'failed')
  })

  it('redirects with login=failed when the code is missing', async () => {
    const state = createOAuthState()
    const fetchMock = mockThreads({})
    const response = await callbackRoute.GET(callbackRequest({ query: { state }, stateCookie: state }))
    expectLoginRedirect(response, 'failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirects with login=denied on ?error=access_denied and never echoes the error details', async () => {
    const state = createOAuthState()
    const fetchMock = mockThreads({})
    const response = await callbackRoute.GET(
      callbackRequest({
        query: {
          error: 'access_denied',
          error_reason: 'user_denied',
          error_description: 'The user denied your request <script>',
          state,
        },
        stateCookie: state,
      }),
    )
    expectLoginRedirect(response, 'denied')
    expect(await response.text()).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(loggedText()).not.toMatch(/user_denied|denied your request/)
  })

  it('redirects with login=failed on any other ?error=', async () => {
    mockThreads({})
    const response = await callbackRoute.GET(callbackRequest({ query: { error: 'server_error' } }))
    expectLoginRedirect(response, 'failed')
  })

  it('redirects with login=failed when the exchange is rejected, logging only the error kind and Meta code', async () => {
    const state = createOAuthState()
    mockThreads({
      exchange: () =>
        Response.json(
          {
            error: {
              message: `Invalid verification code format ${AUTH_CODE}`,
              type: 'OAuthException',
              code: 100,
              error_subcode: 36007,
              fbtrace_id: 'trace-id-value',
            },
          },
          { status: 400 },
        ),
    })
    const response = await callbackRoute.GET(callbackRequest({ query: { code: AUTH_CODE, state }, stateCookie: state }))
    expectLoginRedirect(response, 'failed')

    expect(loggedText()).toBe(
      JSON.stringify({
        event: 'oauth_callback_failed',
        reason: 'exchange_failed',
        error: { kind: 'http_error', status: 400, metaCode: 100, metaSubcode: 36007 },
      }),
    )
  })

  it('redirects with login=failed when the exchange response is not the expected shape', async () => {
    const state = createOAuthState()
    mockThreads({ exchange: () => Response.json({ token: 'unexpected' }) })
    const response = await callbackRoute.GET(callbackRequest({ query: { code: AUTH_CODE, state }, stateCookie: state }))
    expectLoginRedirect(response, 'failed')
    expect(loggedText()).not.toContain('unexpected')
  })

  it('redirects with login=failed when the exchange hits a network error', async () => {
    const state = createOAuthState()
    mockThreads({
      exchange: () => {
        throw new TypeError('fetch failed')
      },
    })
    const response = await callbackRoute.GET(callbackRequest({ query: { code: AUTH_CODE, state }, stateCookie: state }))
    expectLoginRedirect(response, 'failed')
  })

  it.each([
    ['missing username', () => Response.json({ id: USER_ID })],
    ['numeric id', () => Response.json({ id: 17841405793187218, username: USERNAME })],
    ['non-JSON body', () => new Response('<html>oops</html>', { status: 200 })],
    ['HTTP 500', () => Response.json({ error: { message: 'An unknown error occurred', code: 1 } }, { status: 500 })],
  ])('redirects with login=failed when /me is invalid (%s), without leaking the token', async (_label, me) => {
    const state = createOAuthState()
    mockThreads({ exchange: okExchange, me })
    const response = await callbackRoute.GET(callbackRequest({ query: { code: AUTH_CODE, state }, stateCookie: state }))
    expectLoginRedirect(response, 'failed')
    expect(loggedText()).toContain('"reason":"profile_failed"')
    expect(loggedText()).not.toContain(ACCESS_TOKEN)
    expect(loggedText()).not.toContain('unknown error')
  })
})

describe('GET /api/auth/callback — success', () => {
  async function succeed(options: { exchange?: Handler; extraCookies?: string[] } = {}) {
    const state = createOAuthState()
    const fetchMock = mockThreads({ exchange: options.exchange ?? okExchange, me: okMe })
    const request = callbackRequest({
      query: { code: AUTH_CODE, state },
      stateCookie: state,
      ...(options.extraCookies ? { extraCookies: options.extraCookies } : {}),
    })
    const response = await callbackRoute.GET(request)
    return { response, fetchMock }
  }

  it('redirects to /search with no parameters, sets the session cookie and deletes the state cookie', async () => {
    const { response } = await succeed()

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${APP_URL}/search`)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expectStateCookieDeleted(response)

    const sessionCookie = findCookie(response, SESSION_COOKIE_NAME) ?? ''
    expect(sessionCookie).toMatch(/; Path=\/(;|$)/)
    expect(sessionCookie).toMatch(/HttpOnly/)
    expect(sessionCookie).toMatch(/Secure/)
    expect(sessionCookie).toMatch(/SameSite=Lax/)
    expect(sessionCookie).toMatch(/Max-Age=3540/)

    expect(await unsealSession(cookieValue(sessionCookie), SESSION_SECRET)).toEqual({
      userId: USER_ID,
      username: USERNAME,
      accessToken: ACCESS_TOKEN,
      expiresAt: T0 + 3_600_000,
    })
  })

  it('never exposes the token or the code in headers, body or logs', async () => {
    const { response } = await succeed()
    const visible = [...response.headers.entries()].map(([name, value]) => `${name}: ${value}`).join('\n')
    const everything = `${visible}\n${await response.text()}\n${loggedText()}`
    for (const secret of [ACCESS_TOKEN, AUTH_CODE, APP_SECRET, USERNAME]) expect(everything).not.toContain(secret)
    expect(loggedText()).toBe('')
  })

  it('exchanges the code with a form-urlencoded POST, secret in the body only', async () => {
    const { fetchMock } = await succeed()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toBe('https://graph.threads.com/oauth/access_token')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      code: AUTH_CODE,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    })
  })

  it('calls /me with the token in the Authorization header, never in the URL', async () => {
    const { fetchMock } = await succeed()
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]

    expect(url).toBe('https://graph.threads.com/v1.0/me?fields=id%2Cusername')
    expect(url).not.toContain(ACCESS_TOKEN)
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it.each([
    ['shorter than one hour', 600, T0 + 600_000],
    ['longer than one hour', 7200, T0 + 3_600_000],
  ])('caps expiresAt with expires_in when %s', async (_label, expiresIn, expected) => {
    const { response } = await succeed({
      exchange: () => Response.json({ access_token: ACCESS_TOKEN, user_id: 1, expires_in: expiresIn }),
    })
    const session = await unsealSession(cookieValue(findCookie(response, SESSION_COOKIE_NAME) ?? ''), SESSION_SECRET)
    expect(session?.expiresAt).toBe(expected)
  })

  it('replaces an existing session instead of merging into it', async () => {
    const previous = await sealData(
      { userId: '1', username: 'previous-user', accessToken: 'old-token', expiresAt: T0 + 1000, legacy: 'field' },
      { password: SESSION_SECRET, ttl: 3600 },
    )
    const { response } = await succeed({ extraCookies: [`${SESSION_COOKIE_NAME}=${previous}`] })
    const seal = cookieValue(findCookie(response, SESSION_COOKIE_NAME) ?? '')

    const { unsealData } = await import('iron-session')
    expect(await unsealData(seal, { password: SESSION_SECRET, ttl: 3600 })).toEqual({
      userId: USER_ID,
      username: USERNAME,
      accessToken: ACCESS_TOKEN,
      expiresAt: T0 + 3_600_000,
    })
  })
})

describe('POST /api/auth/logout', () => {
  async function logoutRequest(headers: Record<string, string>) {
    const seal = await sealSession(
      { userId: USER_ID, username: USERNAME, accessToken: ACCESS_TOKEN, expiresAt: T0 + 3_600_000 },
      SESSION_SECRET,
    )
    return new NextRequest(new URL('/api/auth/logout', APP_URL), {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${seal}`, ...headers },
    })
  }

  it('destroys the session and redirects to / with 303 when the Origin matches', async () => {
    const response = await logoutRoute.POST(await logoutRequest({ origin: APP_URL }))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${APP_URL}/`)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const cookie = findCookie(response, SESSION_COOKIE_NAME) ?? ''
    expect(cookie).toMatch(/^__Host-cew_session=;/)
    expect(cookie).toMatch(/Max-Age=0/)
    expect(cookie).toMatch(/Path=\//)
  })

  it('refuses a request without Origin', async () => {
    const response = await logoutRoute.POST(await logoutRequest({}))
    expect(response.status).toBe(403)
    expect(setCookies(response)).toEqual([])
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it.each(['https://evil.example.com', 'https://cew.example.com.evil.com', 'http://cew.example.com', 'null'])(
    'refuses a request from Origin %s',
    async (origin) => {
      const response = await logoutRoute.POST(await logoutRequest({ origin }))
      expect(response.status).toBe(403)
      expect(setCookies(response)).toEqual([])
    },
  )

  it('refuses GET with 405', () => {
    const response = logoutRoute.GET()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
