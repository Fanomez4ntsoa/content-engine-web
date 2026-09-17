import 'server-only'
import type { MetaCallbackFailure } from '@/lib/meta-callback'
import type { OAuthFailureReason } from '@/lib/oauth'
import type { UpstreamSearchErrorCode } from '@/lib/threads/errors'
import type { ThreadsError } from '@/lib/threads/client'

/**
 * Seul point de journalisation de l'app. Les événements sont des unions
 * fermées : aucun champ ne peut transporter un jeton, un secret, un code,
 * un signed_request, un user_id ou un message renvoyé par Meta.
 */
export type LogEvent =
  | { event: 'meta_callback_rejected'; route: 'uninstall' | 'delete'; reason: MetaCallbackFailure }
  | { event: 'oauth_callback_failed'; reason: OAuthFailureReason; error?: ThreadsError }
  | { event: 'search_failed'; code: UpstreamSearchErrorCode; error: ThreadsError }

export function logWarning(event: LogEvent): void {
  // eslint-disable-next-line no-console -- unique sortie de log de l'app, limitée aux événements typés ci-dessus.
  console.warn(JSON.stringify(event))
}
