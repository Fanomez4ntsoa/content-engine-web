import type { NextRequest } from 'next/server'
import { getEnv } from '@/lib/env'
import { methodNotAllowed, noStoreJson, redirectHeaders, seeOther } from '@/lib/http'
import { hasTrustedOrigin } from '@/lib/origin'
import { destroySession } from '@/lib/session'

export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv()
  if (!hasTrustedOrigin(request, env.APP_URL)) return noStoreJson({ error: 'forbidden_origin' }, 403)

  const headers = redirectHeaders(env.APP_URL, '/')
  await destroySession(request, headers, env.SESSION_SECRET)
  return seeOther(headers)
}

export function GET(): Response {
  return methodNotAllowed(['POST'])
}
