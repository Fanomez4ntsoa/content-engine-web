import { getEnv } from '@/lib/env'
import { noStoreEmpty } from '@/lib/http'
import { metaCallbackMethodNotAllowed, metaCallbackOptions, readMetaCallback, rejectMetaCallback } from '@/lib/meta-callback'

/** Uninstall Callback Threads : aucune donnée stockée, il suffit de vérifier et d'acquitter. */
export async function POST(request: Request): Promise<Response> {
  const result = await readMetaCallback(request, getEnv().THREADS_APP_SECRET)
  if (!result.ok) return rejectMetaCallback('uninstall', result.reason)
  return noStoreEmpty(200)
}

export const GET = metaCallbackMethodNotAllowed
export const PUT = metaCallbackMethodNotAllowed
export const PATCH = metaCallbackMethodNotAllowed
export const DELETE = metaCallbackMethodNotAllowed
export const OPTIONS = metaCallbackOptions
