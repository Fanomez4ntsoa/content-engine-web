import 'server-only'
import { randomBytes } from 'node:crypto'
import { hasMediaType, methodNotAllowed, noStoreEmpty, noStoreJson, readBodyWithLimit } from '@/lib/http'
import { logWarning } from '@/lib/log'
import { verifySignedRequest, type SignedRequestFailure, type SignedRequestPayload } from '@/lib/signed-request'

/** Largement au-dessus d'un signed_request réel (limité à 8 Ko par verifySignedRequest). */
export const META_CALLBACK_MAX_BODY_BYTES = 16 * 1024

export const META_CALLBACK_ALLOWED_METHODS = ['POST'] as const

export type MetaCallbackFailure = SignedRequestFailure | 'missing_field' | 'unsupported_media_type' | 'body_too_large'

export type MetaCallbackResult =
  | { ok: true; payload: SignedRequestPayload }
  | { ok: false; reason: MetaCallbackFailure }

/**
 * Lit et vérifie le corps d'un callback Meta (désinstallation ou suppression) :
 * form-urlencoded, un seul champ `signed_request`, signature valide.
 */
export async function readMetaCallback(request: Request, appSecret: string): Promise<MetaCallbackResult> {
  if (!hasMediaType(request, 'application/x-www-form-urlencoded')) {
    return { ok: false, reason: 'unsupported_media_type' }
  }

  const body = await readBodyWithLimit(request, META_CALLBACK_MAX_BODY_BYTES)
  if (body === null) return { ok: false, reason: 'body_too_large' }

  const values = new URLSearchParams(body).getAll('signed_request')
  if (values.length === 0) return { ok: false, reason: 'missing_field' }
  if (values.length > 1) return { ok: false, reason: 'malformed' }

  return verifySignedRequest(values[0], appSecret)
}

const FAILURE_STATUS: Record<MetaCallbackFailure, number> = {
  malformed: 400,
  bad_signature: 400,
  bad_payload: 400,
  bad_algorithm: 400,
  missing_field: 400,
  unsupported_media_type: 415,
  body_too_large: 413,
}

/**
 * Réponse d'échec. Seul le motif est journalisé : jamais le signed_request,
 * le user_id ni aucun code.
 */
export function rejectMetaCallback(route: 'uninstall' | 'delete', reason: MetaCallbackFailure): Response {
  logWarning({ event: 'meta_callback_rejected', route, reason })
  return noStoreJson({ error: reason }, FAILURE_STATUS[reason])
}

export function metaCallbackMethodNotAllowed(): Response {
  return methodNotAllowed(META_CALLBACK_ALLOWED_METHODS)
}

/** Remplace l'OPTIONS automatique de Next, qui listerait aussi les méthodes refusées. */
export function metaCallbackOptions(): Response {
  return noStoreEmpty(204, { Allow: [...META_CALLBACK_ALLOWED_METHODS, 'OPTIONS'].join(', ') })
}

/** 16 octets aléatoires en hexadécimal (format vérifié par isConfirmationCode). Non stocké : rien n'est à supprimer côté web. */
export function createConfirmationCode(): string {
  return randomBytes(16).toString('hex')
}

export function buildDeletionStatusUrl(appUrl: string, confirmationCode: string): string {
  const url = new URL('/data-deletion/status', appUrl)
  url.searchParams.set('code', confirmationCode)
  return url.toString()
}
