import { PHASE_PRODUCTION_BUILD } from 'next/constants'

/**
 * Appelée une fois au démarrage d'une instance serveur : une configuration
 * invalide fait échouer le démarrage plutôt que la première requête.
 * Ignorée pendant `next build`, qui n'a pas besoin des secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return

  const { getEnv } = await import('@/lib/env')
  getEnv()
}
