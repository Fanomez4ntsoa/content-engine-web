import { PHASE_PRODUCTION_BUILD } from 'next/constants'

/**
 * Appelée une fois au démarrage d'une instance serveur. Non bloquante : une
 * configuration invalide est signalée (noms des variables seulement) sans
 * empêcher le démarrage, pour que les pages légales restent en ligne tant
 * qu'APP_URL est valide. Les routes qui ont besoin des secrets restent
 * strictes via getEnv(). Ignorée pendant `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return

  const [{ EnvError, parseEnv }, { logWarning }] = await Promise.all([import('@/lib/env'), import('@/lib/log')])
  try {
    parseEnv(process.env)
  } catch (error) {
    if (!(error instanceof EnvError)) throw error
    logWarning({ event: 'env_invalid', variables: error.variables })
  }
}
