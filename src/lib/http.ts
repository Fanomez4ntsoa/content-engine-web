/** En-têtes communs : aucune réponse de l'app ne doit être mise en cache. */
export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const

export function noStoreJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE_HEADERS, ...headers } })
}

export function noStoreEmpty(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...NO_STORE_HEADERS, ...headers } })
}

/** En-têtes d'une redirection 303 vers un chemin fixe de l'app, sans paramètre repris de la requête. */
export function redirectHeaders(appUrl: string, pathWithQuery: string): Headers {
  return new Headers({ ...NO_STORE_HEADERS, Location: new URL(pathWithQuery, appUrl).toString() })
}

export function seeOther(headers: Headers): Response {
  return new Response(null, { status: 303, headers })
}

export function methodNotAllowed(allow: readonly string[]): Response {
  return noStoreJson({ error: 'method_not_allowed' }, 405, { Allow: allow.join(', ') })
}

/**
 * Lit le corps en texte en s'arrêtant dès que `maxBytes` est dépassé,
 * que Content-Length soit annoncé ou non. Renvoie `null` si trop gros.
 */
export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const declared = request.headers.get('content-length')
  if (declared !== null && Number(declared) > maxBytes) return null
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/** Compare le type MIME (sans paramètres comme `charset`). */
export function hasMediaType(request: Request, mediaType: string): boolean {
  const header = request.headers.get('content-type')
  if (!header) return false
  return header.split(';')[0]?.trim().toLowerCase() === mediaType
}
