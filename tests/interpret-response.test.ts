import { describe, expect, it } from 'vitest'
import { GENERIC_SEARCH_ERROR, interpretSearchResponse } from '@/app/search/interpret-response'
import { SEARCH_ERRORS } from '@/lib/threads/errors'

const errorBody = (code: keyof typeof SEARCH_ERRORS) => ({ error: { code, message: SEARCH_ERRORS[code].message } })

describe('interpretSearchResponse', () => {
  it('tells the two 403 apart by the body code, not the status', () => {
    const origin = interpretSearchResponse(403, errorBody('forbidden_origin'))
    const permission = interpretSearchResponse(403, errorBody('permission_missing'))

    expect(origin).toEqual({ kind: 'error', code: 'forbidden_origin', message: SEARCH_ERRORS.forbidden_origin.message })
    expect(permission).toEqual({
      kind: 'error',
      code: 'permission_missing',
      message: SEARCH_ERRORS.permission_missing.message,
    })
    expect(origin).not.toEqual(permission)
  })

  it.each(['not_authenticated', 'session_expired'] as const)('redirects to /?login=expired on %s', (code) => {
    expect(interpretSearchResponse(401, errorBody(code))).toEqual({ kind: 'redirect', to: '/?login=expired' })
  })

  it('follows the body code even if the status disagrees', () => {
    expect(interpretSearchResponse(403, errorBody('session_expired'))).toEqual({ kind: 'redirect', to: '/?login=expired' })
    expect(interpretSearchResponse(401, errorBody('quota_exceeded')).kind).toBe('error')
  })

  it('shows the quota message from the body', () => {
    expect(interpretSearchResponse(429, errorBody('quota_exceeded'))).toEqual({
      kind: 'error',
      code: 'quota_exceeded',
      message: 'The daily search limit has been reached. Please try again later.',
    })
  })

  it('returns the posts of a 200 response', () => {
    expect(interpretSearchResponse(200, { posts: [] })).toEqual({ kind: 'results', posts: [] })
  })

  it.each([
    ['a non-JSON 502', 502, undefined],
    ['a body without code', 500, { error: { message: 'x' } }],
    ['a 200 without posts', 200, { data: [] }],
  ])('falls back to the generic message for %s', (_label, status, body) => {
    expect(interpretSearchResponse(status, body)).toEqual({ kind: 'error', code: 'unexpected', message: GENERIC_SEARCH_ERROR })
  })

  it('still redirects on a bare 401 without a readable body', () => {
    expect(interpretSearchResponse(401, undefined)).toEqual({ kind: 'redirect', to: '/?login=expired' })
  })
})
