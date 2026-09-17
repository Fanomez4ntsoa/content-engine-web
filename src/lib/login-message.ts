/** Table fixe des messages affichés sur l'accueil après un retour d'OAuth. */
export const LOGIN_MESSAGES = {
  denied: 'Login was cancelled. No access was granted to the app.',
  failed: 'Login with Threads did not complete. Please try again.',
  expired: 'Your session has expired. Please log in again.',
} as const

export type LoginMessageCode = keyof typeof LOGIN_MESSAGES

/** Toute valeur hors table (y compris tableau ou clé héritée comme `toString`) est ignorée. */
export function loginMessageFor(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string' || !Object.hasOwn(LOGIN_MESSAGES, value)) return undefined
  return LOGIN_MESSAGES[value as LoginMessageCode]
}
