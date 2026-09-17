import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as deleteRoute from '@/app/api/threads/delete/route'
import * as uninstallRoute from '@/app/api/threads/uninstall/route'
import { META_CALLBACK_MAX_BODY_BYTES, buildDeletionStatusUrl } from '@/lib/meta-callback'

const SECRET = 'threads-app-secret-for-tests'
const APP_URL = 'https://cew.example.com'
const USER_ID = '17841400000000000'

beforeEach(() => {
  vi.stubEnv('THREADS_APP_ID', '1234567890')
  vi.stubEnv('THREADS_APP_SECRET', SECRET)
  vi.stubEnv('APP_URL', APP_URL)
  vi.stubEnv('THREADS_REDIRECT_URI', `${APP_URL}/api/auth/callback`)
  vi.stubEnv('SESSION_SECRET', 's'.repeat(32))
})

function sign(payload: object, secret = SECRET): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${createHmac('sha256', secret).update(encoded).digest('base64url')}.${encoded}`
}

const validSignedRequest = () => sign({ algorithm: 'HMAC-SHA256', issued_at: 1_790_000_000, user_id: USER_ID })

function formRequest(path: string, body: string, init: { contentType?: string | null; method?: string } = {}): Request {
  const headers = new Headers()
  const contentType = init.contentType === undefined ? 'application/x-www-form-urlencoded' : init.contentType
  if (contentType !== null) headers.set('content-type', contentType)
  return new Request(`${APP_URL}${path}`, { method: init.method ?? 'POST', headers, body })
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString()

const routes = [
  { name: 'uninstall', path: '/api/threads/uninstall', module: uninstallRoute },
  { name: 'delete', path: '/api/threads/delete', module: deleteRoute },
] as const

describe.each(routes)('POST /api/threads/$name — rejections', ({ name, path, module }) => {
  it('returns 400 for an invalid signature', async () => {
    const signedRequest = sign({ algorithm: 'HMAC-SHA256', user_id: USER_ID }, 'wrong-secret')
    const response = await module.POST(formRequest(path, form({ signed_request: signedRequest })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'bad_signature' })
  })

  it('returns 400 when the signed_request field is missing', async () => {
    const response = await module.POST(formRequest(path, form({ other: 'value' })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'missing_field' })
  })

  it('returns 400 for a malformed signed_request', async () => {
    const response = await module.POST(formRequest(path, form({ signed_request: 'not-a-signed-request' })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'malformed' })
  })

  it('returns 400 when signed_request is sent twice', async () => {
    const body = `signed_request=${validSignedRequest()}&signed_request=${validSignedRequest()}`
    const response = await module.POST(formRequest(path, body))
    expect(response.status).toBe(400)
  })

  it('returns 400 for a wrong algorithm', async () => {
    const response = await module.POST(formRequest(path, form({ signed_request: sign({ algorithm: 'none' }) })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'bad_algorithm' })
  })

  it.each([
    ['JSON', 'application/json'],
    ['multipart', 'multipart/form-data; boundary=x'],
    ['no content type', null],
  ])('returns 415 for a %s body', async (_label, contentType) => {
    const response = await module.POST(formRequest(path, form({ signed_request: validSignedRequest() }), { contentType }))
    expect(response.status).toBe(415)
  })

  it('returns 413 for a body over the limit, without a Content-Length header', async () => {
    const body = form({ signed_request: 'a'.repeat(META_CALLBACK_MAX_BODY_BYTES) })
    const response = await module.POST(formRequest(path, body))
    expect(response.status).toBe(413)
  })

  it('returns 413 as soon as Content-Length announces a body over the limit', async () => {
    const request = formRequest(path, 'signed_request=x')
    const withLength = new Request(request, {
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(1_000_000) },
    })
    const response = await module.POST(withLength)
    expect(response.status).toBe(413)
  })

  it.each(['GET', 'PUT', 'PATCH', 'DELETE'] as const)('returns 405 for %s', async (method) => {
    const response = await module[method]()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers OPTIONS with POST as the only allowed method', async () => {
    const response = await module.OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get('allow')).toBe('POST, OPTIONS')
  })

  it('sets Cache-Control: no-store on rejections', async () => {
    const response = await module.POST(formRequest(path, form({})))
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('logs only the failure reason', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const signedRequest = sign({ algorithm: 'HMAC-SHA256', user_id: USER_ID }, 'wrong-secret')
    await module.POST(formRequest(path, form({ signed_request: signedRequest })))

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ event: 'meta_callback_rejected', route: name, reason: 'bad_signature' }),
    )
  })

  it('accepts a charset parameter on the content type', async () => {
    const response = await module.POST(
      formRequest(path, form({ signed_request: validSignedRequest() }), {
        contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      }),
    )
    expect(response.status).toBe(200)
  })
})

describe('POST /api/threads/uninstall — valid', () => {
  it('returns 200 with no body and no-store', async () => {
    const response = await uninstallRoute.POST(
      formRequest('/api/threads/uninstall', form({ signed_request: validSignedRequest() })),
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('POST /api/threads/delete — valid', () => {
  it('returns the status URL and a 16-byte hex confirmation code', async () => {
    const warn = vi.spyOn(console, 'warn')
    const response = await deleteRoute.POST(formRequest('/api/threads/delete', form({ signed_request: validSignedRequest() })))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)

    const body = (await response.json()) as { url: string; confirmation_code: string }
    expect(Object.keys(body).sort()).toEqual(['confirmation_code', 'url'])
    expect(body.confirmation_code).toMatch(/^[0-9a-f]{32}$/)
    expect(body.url).toBe(`${APP_URL}/data-deletion/status?code=${body.confirmation_code}`)
    expect(JSON.stringify(body)).not.toContain(USER_ID)
    expect(warn).not.toHaveBeenCalled()
  })

  it('returns a different code on each call', async () => {
    const call = async () => {
      const response = await deleteRoute.POST(formRequest('/api/threads/delete', form({ signed_request: validSignedRequest() })))
      return ((await response.json()) as { confirmation_code: string }).confirmation_code
    }
    expect(await call()).not.toBe(await call())
  })
})

describe('buildDeletionStatusUrl', () => {
  it('encodes the code as a query parameter', () => {
    expect(buildDeletionStatusUrl('https://cew.example.com', 'a b&c=d')).toBe(
      'https://cew.example.com/data-deletion/status?code=a+b%26c%3Dd',
    )
  })
})
