import { z } from 'zod'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Origine seule (schéma + hôte + port), HTTPS obligatoire hors machine locale. */
const originUrl = z
  .url()
  .transform((value) => new URL(value))
  .refine((url) => url.pathname === '/' && !url.search && !url.hash && !url.username, {
    message: 'must be an origin only (no path, query or fragment)',
  })
  .refine((url) => url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname)), {
    message: 'must use https (http is only allowed on localhost)',
  })
  .transform((url) => url.origin)

const envSchema = z
  .object({
    THREADS_APP_ID: z.string().regex(/^\d+$/, 'must be the numeric Threads App ID'),
    THREADS_APP_SECRET: z.string().min(1, 'is required'),
    THREADS_REDIRECT_URI: z.url(),
    APP_URL: originUrl,
    SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  })
  .refine((env) => env.THREADS_REDIRECT_URI === `${env.APP_URL}/api/auth/callback`, {
    path: ['THREADS_REDIRECT_URI'],
    message: 'must be exactly APP_URL + /api/auth/callback',
  })

export type Env = z.infer<typeof envSchema>

export class EnvError extends Error {
  override name = 'EnvError'
}

/**
 * Valide un jeu de variables. Le message d'erreur ne cite que les noms des
 * variables fautives, jamais leurs valeurs.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({
    THREADS_APP_ID: source.THREADS_APP_ID,
    THREADS_APP_SECRET: source.THREADS_APP_SECRET,
    THREADS_REDIRECT_URI: source.THREADS_REDIRECT_URI,
    APP_URL: source.APP_URL,
    SESSION_SECRET: source.SESSION_SECRET,
  })
  if (result.success) return result.data

  const details = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || 'env'
    const message = issue.code === 'invalid_type' ? 'is required' : issue.message
    return `${name} ${message}`
  })
  throw new EnvError(`Invalid environment variables: ${details.join('; ')}`)
}

let cached: Env | undefined

/** Lecture paresseuse : n'est appelée qu'à l'exécution, jamais pendant `next build`. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
