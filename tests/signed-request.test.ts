import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SIGNED_REQUEST_MAX_LENGTH, verifySignedRequest } from '@/lib/signed-request'

const SECRET = 'threads-app-secret'

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

/** Construit un signed_request comme Meta : signature calculée sur le payload encodé. */
function sign(payloadJson: string, secret = SECRET): string {
  const encodedPayload = encode(payloadJson)
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${signature}.${encodedPayload}`
}

const basePayload = { algorithm: 'HMAC-SHA256', issued_at: 1_790_000_000, user_id: '17841400000000000' }

describe('verifySignedRequest — valid', () => {
  it('accepts a correctly signed request and returns the payload', () => {
    const result = verifySignedRequest(sign(JSON.stringify(basePayload)), SECRET)
    expect(result).toEqual({ ok: true, payload: basePayload })
  })

  it('accepts a numeric user_id', () => {
    const result = verifySignedRequest(sign(JSON.stringify({ ...basePayload, user_id: 42 })), SECRET)
    expect(result.ok && result.payload.user_id).toBe(42)
  })

  it('keeps unknown fields and tolerates a missing user_id', () => {
    const payload = { algorithm: 'HMAC-SHA256', extra: { nested: true } }
    expect(verifySignedRequest(sign(JSON.stringify(payload)), SECRET)).toEqual({ ok: true, payload })
  })
})

describe('verifySignedRequest — invalid signature', () => {
  it('rejects a request signed with another secret', () => {
    expect(verifySignedRequest(sign(JSON.stringify(basePayload), 'other-secret'), SECRET)).toEqual({
      ok: false,
      reason: 'bad_signature',
    })
  })

  it('rejects a tampered payload', () => {
    const [signature] = sign(JSON.stringify(basePayload)).split('.')
    const tampered = `${signature}.${encode(JSON.stringify({ ...basePayload, user_id: 'someone-else' }))}`
    expect(verifySignedRequest(tampered, SECRET)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a signature of a different length without comparing', () => {
    const [signature, payload] = sign(JSON.stringify(basePayload)).split('.') as [string, string]
    const shorter = encode(Buffer.from(signature, 'base64url').subarray(0, 31))
    const longer = encode(Buffer.concat([Buffer.from(signature, 'base64url'), Buffer.from([0])]))
    expect(verifySignedRequest(`${shorter}.${payload}`, SECRET)).toEqual({ ok: false, reason: 'bad_signature' })
    expect(verifySignedRequest(`${longer}.${payload}`, SECRET)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a signature computed on the decoded payload instead of the encoded one', () => {
    const json = JSON.stringify(basePayload)
    const wrong = `${createHmac('sha256', SECRET).update(json).digest('base64url')}.${encode(json)}`
    expect(verifySignedRequest(wrong, SECRET)).toEqual({ ok: false, reason: 'bad_signature' })
  })
})

describe('verifySignedRequest — malformed', () => {
  it.each([
    ['not a string', 123],
    ['undefined', undefined],
    ['empty string', ''],
    ['no dot', 'abcdef'],
    ['empty signature', `.${encode('{}')}`],
    ['empty payload', 'abc.'],
    ['too many parts', 'a.b.c'],
    ['non base64url characters', 'ab+/cd.ef$gh'],
    ['too long', `${'a'.repeat(SIGNED_REQUEST_MAX_LENGTH)}.b`],
  ])('rejects %s', (_label, input) => {
    expect(verifySignedRequest(input, SECRET)).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('verifySignedRequest — payload', () => {
  it('rejects a wrong algorithm even when correctly signed', () => {
    const result = verifySignedRequest(sign(JSON.stringify({ ...basePayload, algorithm: 'HMAC-SHA1' })), SECRET)
    expect(result).toEqual({ ok: false, reason: 'bad_algorithm' })
  })

  it('rejects a missing algorithm', () => {
    const withoutAlgorithm = { issued_at: basePayload.issued_at, user_id: basePayload.user_id }
    expect(verifySignedRequest(sign(JSON.stringify(withoutAlgorithm)), SECRET)).toEqual({
      ok: false,
      reason: 'bad_algorithm',
    })
  })

  it('rejects invalid JSON even when correctly signed', () => {
    expect(verifySignedRequest(sign('{"algorithm": "HMAC-SHA256"'), SECRET)).toEqual({
      ok: false,
      reason: 'bad_payload',
    })
  })

  it('rejects a JSON value that is not an object', () => {
    expect(verifySignedRequest(sign('"HMAC-SHA256"'), SECRET)).toEqual({ ok: false, reason: 'bad_payload' })
  })

  it('rejects a user_id of an unexpected type', () => {
    expect(verifySignedRequest(sign(JSON.stringify({ ...basePayload, user_id: { id: 1 } })), SECRET)).toEqual({
      ok: false,
      reason: 'bad_payload',
    })
  })
})
