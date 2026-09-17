/**
 * Contrat de /api/search, partagé avec le formulaire client.
 * Aucune dépendance serveur : ce fichier est importable côté navigateur.
 */

export const KEYWORD_MAX_LENGTH = 100

export type SearchPost = {
  id: string
  /** Absent pour un post sans texte (image ou vidéo seule). */
  text?: string
  username: string
  /** `iso` pour l'attribut dateTime, `label` déjà formaté côté serveur, en UTC. */
  timestamp: { iso: string; label: string }
  /** Absent si le lien renvoyé n'est pas un https sur threads.com ou threads.net. */
  permalink?: string
}

export type SearchErrorCode =
  | 'not_authenticated'
  | 'session_expired'
  | 'forbidden_origin'
  | 'unsupported_media_type'
  | 'body_too_large'
  | 'invalid_request'
  | 'invalid_keyword'
  | 'quota_exceeded'
  | 'permission_missing'
  | 'upstream_unavailable'
  | 'upstream_unknown'

export type SearchSuccessBody = { posts: SearchPost[] }
export type SearchErrorBody = { error: { code: SearchErrorCode; message: string } }
