/**
 * Anti-CSRF pour les POST déclenchés depuis l'interface (logout, recherche) :
 * l'en-tête Origin doit être présent et égal à APP_URL.
 * Ne pas utiliser sur les callbacks Meta, appelés de serveur à serveur.
 */
export function hasTrustedOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get('origin')
  return origin !== null && origin === appUrl
}
