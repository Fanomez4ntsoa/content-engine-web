import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

/** Au-delà, la requête est rejetée sans calcul HMAC. */
export const SIGNED_REQUEST_MAX_LENGTH = 8192

const HMAC_SHA256_BYTES = 32
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

/** Strict sur `algorithm`, tolérant sur le reste (champs inconnus conservés). */
const payloadSchema = z.looseObject({
  algorithm: z.literal('HMAC-SHA256'),
  user_id: z.union([z.string(), z.number()]).optional(),
})

export type SignedRequestPayload = z.infer<typeof payloadSchema>

export type SignedRequestFailure = 'malformed' | 'bad_signature' | 'bad_payload' | 'bad_algorithm'

export type SignedRequestResult =
  | { ok: true; payload: SignedRequestPayload }
  | { ok: false; reason: SignedRequestFailure }

/**
 * Vérifie un `signed_request` Meta : `<signature>.<payload>`, tous deux en
 * base64url, signature = HMAC-SHA256(payload encodé, app secret).
 * La signature est vérifiée avant toute lecture du payload.
 */
export function verifySignedRequest(signedRequest: unknown, appSecret: string): SignedRequestResult {
  if (typeof signedRequest !== 'string' || signedRequest.length > SIGNED_REQUEST_MAX_LENGTH) {
    return { ok: false, reason: 'malformed' }
  }

  const parts = signedRequest.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'malformed' }
  const [encodedSignature, encodedPayload] = parts as [string, string]
  if (!BASE64URL.test(encodedSignature) || !BASE64URL.test(encodedPayload)) {
    return { ok: false, reason: 'malformed' }
  }

  const received = Buffer.from(encodedSignature, 'base64url')
  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest()
  if (received.length !== HMAC_SHA256_BYTES || received.length !== expected.length) {
    return { ok: false, reason: 'bad_signature' }
  }
  if (!timingSafeEqual(received, expected)) return { ok: false, reason: 'bad_signature' }

  let json: unknown
  try {
    json = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'bad_payload' }
  }

  const parsed = payloadSchema.safeParse(json)
  if (parsed.success) return { ok: true, payload: parsed.data }

  const algorithmIssue = parsed.error.issues.some((issue) => issue.path[0] === 'algorithm')
  return { ok: false, reason: algorithmIssue ? 'bad_algorithm' : 'bad_payload' }
}
