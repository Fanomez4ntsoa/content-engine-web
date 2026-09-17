import { getAppUrl, getEnv } from '@/lib/env'
import { noStoreJson } from '@/lib/http'
import {
  buildDeletionStatusUrl,
  createConfirmationCode,
  metaCallbackMethodNotAllowed,
  metaCallbackOptions,
  readMetaCallback,
  rejectMetaCallback,
} from '@/lib/meta-callback'

/** Delete Callback Threads : rien n'est stocké côté web, on renvoie un code de confirmation. */
export async function POST(request: Request): Promise<Response> {
  const result = await readMetaCallback(request, getEnv().THREADS_APP_SECRET)
  if (!result.ok) return rejectMetaCallback('delete', result.reason)

  const confirmationCode = createConfirmationCode()
  return noStoreJson({
    url: buildDeletionStatusUrl(getAppUrl(), confirmationCode),
    confirmation_code: confirmationCode,
  })
}

export const GET = metaCallbackMethodNotAllowed
export const PUT = metaCallbackMethodNotAllowed
export const PATCH = metaCallbackMethodNotAllowed
export const DELETE = metaCallbackMethodNotAllowed
export const OPTIONS = metaCallbackOptions
