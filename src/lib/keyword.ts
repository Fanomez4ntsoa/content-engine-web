import { z } from 'zod'
import { KEYWORD_MAX_LENGTH } from '@/lib/search-types'

export { KEYWORD_MAX_LENGTH }

// Catégorie Unicode Cc : C0, DEL et C1 (dont tabulation et retour à la ligne).
const CONTROL_CHARACTER = /\p{Cc}/u

const keywordSchema = z
  .string({ error: 'Please enter a keyword.' })
  .trim()
  // NFC : « é » saisi en un ou deux points de code donne la même recherche.
  .normalize('NFC')
  .min(1, 'Please enter a keyword.')
  // Longueur en points de code, pour ne pas pénaliser les emojis.
  .refine((value) => [...value].length <= KEYWORD_MAX_LENGTH, {
    message: `Keywords are limited to ${KEYWORD_MAX_LENGTH} characters.`,
    abort: true,
  })
  .refine((value) => !CONTROL_CHARACTER.test(value), {
    message: 'The keyword contains invalid characters.',
  })

export type KeywordResult = { ok: true; keyword: string } | { ok: false; message: string }

export function parseKeyword(input: unknown): KeywordResult {
  const result = keywordSchema.safeParse(input)
  if (result.success) return { ok: true, keyword: result.data }
  return { ok: false, message: result.error.issues[0]?.message ?? 'Invalid keyword.' }
}
