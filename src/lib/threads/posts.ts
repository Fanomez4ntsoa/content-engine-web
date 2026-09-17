import { z } from 'zod'
import type { SearchPost } from '@/lib/search-types'

/** Plafond de résultats affichés ; la pagination Meta est ignorée. */
export const SEARCH_RESULT_LIMIT = 25

const PERMALINK_HOSTS = new Set(['threads.com', 'www.threads.com', 'threads.net', 'www.threads.net'])

/** https uniquement, sur un domaine Threads, sans identifiants ni port. Sinon `undefined`. */
export function sanitizePermalink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || !PERMALINK_HOSTS.has(url.hostname)) return undefined
  if (url.username || url.password || url.port) return undefined
  return url.toString()
}

// Format Graph API : 2026-09-17T10:15:30+0000 (on accepte aussi Z et +00:00).
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Parse un horodatage Meta et le formate en UTC, sans dépendre de la locale du serveur. */
export function formatTimestamp(value: string): { iso: string; label: string } | undefined {
  const match = TIMESTAMP.exec(value)
  if (!match) return undefined
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [number, number, number, number, number, number]
  const zone = match[7] ?? 'Z'

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return undefined
  const localMs = Date.UTC(year, month - 1, day, hour, minute, second)
  // Date.UTC normalise un 31 février en 3 mars : on le rejette.
  if (new Date(localMs).getUTCDate() !== day) return undefined

  let offsetMinutes = 0
  if (zone !== 'Z') {
    const digits = zone.replace(':', '')
    const sign = digits.startsWith('-') ? -1 : 1
    offsetMinutes = sign * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5)))
  }
  const date = new Date(localMs - offsetMinutes * 60_000)

  const pad = (n: number) => String(n).padStart(2, '0')
  const label = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  return { iso: date.toISOString(), label }
}

const rawPostSchema = z.object({
  id: z.string().regex(/^\d+$/),
  text: z.string().optional(),
  username: z.string().min(1).max(100),
  timestamp: z.string(),
  permalink: z.unknown().optional(),
})

export const keywordSearchResponseSchema = z.object({ data: z.array(z.unknown()) })

/**
 * Ne garde que id, text, username, timestamp et permalink. Un post invalide
 * (id, username ou date inexploitables) est ignoré ; un permalink hors
 * domaine est retiré sans masquer le post.
 */
export function normalizePosts(data: readonly unknown[]): SearchPost[] {
  const posts: SearchPost[] = []
  for (const item of data) {
    if (posts.length >= SEARCH_RESULT_LIMIT) break
    const parsed = rawPostSchema.safeParse(item)
    if (!parsed.success) continue
    const timestamp = formatTimestamp(parsed.data.timestamp)
    if (!timestamp) continue

    const permalink = sanitizePermalink(parsed.data.permalink)
    const text = parsed.data.text === undefined || parsed.data.text.trim() === '' ? undefined : parsed.data.text
    posts.push({
      id: parsed.data.id,
      ...(text === undefined ? {} : { text }),
      username: parsed.data.username,
      timestamp,
      ...(permalink === undefined ? {} : { permalink }),
    })
  }
  return posts
}
