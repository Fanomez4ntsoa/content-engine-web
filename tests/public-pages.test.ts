import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataDeletionInstructions } from '@/components/legal/data-deletion-instructions'
import { DeletionStatus } from '@/components/legal/deletion-status'
import { PrivacyPolicy } from '@/components/legal/privacy-policy'
import { isConfirmationCode } from '@/lib/confirmation-code'
import { LOGIN_MESSAGES, loginMessageFor } from '@/lib/login-message'
import { createConfirmationCode } from '@/lib/meta-callback'

const APP_URL = 'https://cew.example.com'

describe('loginMessageFor', () => {
  it.each(['denied', 'failed', 'expired'] as const)('returns the fixed message for %s', (code) => {
    expect(loginMessageFor(code)).toBe(LOGIN_MESSAGES[code])
  })

  it.each([
    ['an unknown value', 'error_description'],
    ['a value with HTML', '<script>alert(1)</script>'],
    ['an inherited key', 'toString'],
    ['__proto__', '__proto__'],
    ['a different case', 'DENIED'],
    ['an empty string', ''],
    ['a repeated parameter', ['denied', 'failed']],
    ['no parameter', undefined],
  ])('ignores %s', (_label, value) => {
    expect(loginMessageFor(value)).toBeUndefined()
  })
})

describe('isConfirmationCode', () => {
  it('accepts the codes produced by the delete callback', () => {
    for (let i = 0; i < 20; i += 1) expect(isConfirmationCode(createConfirmationCode())).toBe(true)
  })

  it.each(['a'.repeat(31), 'a'.repeat(33), 'A'.repeat(32), 'g'.repeat(32), `${'a'.repeat(31)}\n`, undefined, ['a'.repeat(32)]])(
    'rejects %j',
    (value) => {
      expect(isConfirmationCode(value)).toBe(false)
    },
  )
})

describe('DeletionStatus', () => {
  it('shows the processed message and the code when the code is valid', () => {
    const code = createConfirmationCode()
    const html = renderToStaticMarkup(createElement(DeletionStatus, { code }))
    expect(html).toContain('Your request has been processed. This web app stores no data linked to your account.')
    expect(html).toContain(code)
  })

  it.each([
    ['a script', '<script>alert(1)</script>'],
    ['a near-valid code', 'e'.repeat(31)],
    ['an uppercase code', 'ABCDEF0123456789ABCDEF0123456789'],
  ])('never echoes an invalid value (%s)', (_label, code) => {
    const html = renderToStaticMarkup(createElement(DeletionStatus, { code }))
    expect(html).toContain('This status link is not valid.')
    expect(html).not.toContain(code)
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('processed')
  })

  it('shows the neutral message without a code', () => {
    expect(renderToStaticMarkup(createElement(DeletionStatus, { code: undefined }))).toContain('This status link is not valid.')
  })
})

describe('legal pages', () => {
  it('replaces [APP_URL] in the privacy policy', () => {
    const html = renderToStaticMarkup(createElement(PrivacyPolicy, { appUrl: APP_URL }))
    expect(html).toContain(`Web app (${APP_URL})`)
    expect(html).not.toContain('[APP_URL]')
    expect(html).toContain('voary.fanomezantsoa+threadsapp@gmail.com')
    for (const heading of ['1. Who I am', '2. What the app does', '3. Data I collect', '4. How the data is used', '5. Sharing', '6. Your rights', '7. Children', '8. Changes']) {
      expect(html).toContain(heading)
    }
  })

  it('replaces [APP_URL] in the data deletion instructions', () => {
    const html = renderToStaticMarkup(createElement(DataDeletionInstructions, { appUrl: APP_URL }))
    expect(html).toContain(`${APP_URL}/data-deletion/status?code=YOUR_CONFIRMATION_CODE`)
    expect(html).not.toContain('[APP_URL]')
    expect(html).toContain('(or Settings → More settings → Website permissions)')
    expect(html).toContain(
      '<a href="https://www.threads.com/settings/website_permissions" target="_blank" rel="noopener noreferrer">https://www.threads.com/settings/website_permissions</a>',
    )
    expect(html).toContain('The listening worker is a separate tool that does not receive these notifications')
    expect(html).not.toContain('any data linked to your account is deleted')
  })

  it('uses the validated wording in the privacy policy', () => {
    const html = renderToStaticMarkup(createElement(PrivacyPolicy, { appUrl: APP_URL }))
    expect(html).toContain('On the web app, the keyword is typed by the logged-in user')
    expect(html).toContain('IP address, request time and requested URL')
    expect(html).toContain('this code is short-lived and can only be used once')
    expect(html).not.toContain('a short list of French keywords related to mobile phones')
  })
})

describe('legal pages match docs/pages-legales.md', () => {
  const doc = readFileSync(new URL('../docs/pages-legales.md', import.meta.url), 'utf8')

  /** Blocs de texte (paragraphes, éléments de liste, titres) d'une page du fichier, sans syntaxe Markdown. */
  function markdownBlocks(start: string, end: string): string[] {
    const section = doc.slice(doc.indexOf(start) + start.length, doc.indexOf(end))
    const blocks: string[] = []
    for (const rawLine of section.split('\n')) {
      if (rawLine.trim() === '' || rawLine.trim() === '---') {
        blocks.push('')
        continue
      }
      const isContinuation = /^\s{2,}\S/.test(rawLine) && blocks.length > 0 && blocks[blocks.length - 1] !== ''
      const line = rawLine
        .trim()
        .replace(/^(#+|-|\d+\.)\s+/, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*|`/g, '')
        .replace(/^\*(.*)\*$/, '$1')
        .replaceAll('[APP_URL]', APP_URL)
      const isNewItem = /^\s*(-|\d+\.)\s/.test(rawLine) || /^#/.test(rawLine.trim())
      if (isContinuation && !isNewItem) blocks[blocks.length - 1] += ` ${line}`
      else blocks.push(line)
    }
    return blocks.filter(Boolean)
  }

  const renderedText = (html: string) =>
    html
      .replace(/<\/?(article|h1|h2|p|ul|ol|li)[^>]*>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'")
      .replaceAll('&amp;', '&')
      .replace(/\s+/g, ' ')

  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

  it.each([
    ['privacy', '## PAGE 1 — `/privacy`', '## PAGE 2', () => createElement(PrivacyPolicy, { appUrl: APP_URL })],
    ['data deletion', '## PAGE 2 — `/data-deletion`', "## Notes d'implémentation", () => createElement(DataDeletionInstructions, { appUrl: APP_URL })],
  ])('renders every block of the %s page', (_label, start, end, element) => {
    const text = normalize(renderedText(renderToStaticMarkup(element())))
    const blocks = markdownBlocks(start, end)
    expect(blocks.length).toBeGreaterThan(10)
    for (const block of blocks) expect(text).toContain(normalize(block))
  })
})

describe("docs/pages-legales.md implementation notes", () => {
  const doc = readFileSync(new URL('../docs/pages-legales.md', import.meta.url), 'utf8')
  const NOTES_HEADING = "## Notes d'implémentation"

  // Phrases propres à la section de notes (absentes des textes publics).
  const notesMarkers = ["Notes d'implémentation", 'Delete Callback URL', 'Uninstall Callback URL', 'La page de statut peut rester simple', 'collecteur local']

  it('is the last section of the file and contains the expected markers', () => {
    expect(doc.split('\n').filter((line) => line.startsWith('## Notes'))).toEqual([NOTES_HEADING])
    const notes = doc.slice(doc.indexOf(NOTES_HEADING))
    for (const marker of notesMarkers) expect(notes).toContain(marker)
    expect(doc).not.toContain('Notes pour la spec')
  })

  it('is rendered on no public page', () => {
    const rendered = [
      renderToStaticMarkup(createElement(PrivacyPolicy, { appUrl: APP_URL })),
      renderToStaticMarkup(createElement(DataDeletionInstructions, { appUrl: APP_URL })),
      renderToStaticMarkup(createElement(DeletionStatus, { code: createConfirmationCode() })),
      renderToStaticMarkup(createElement(DeletionStatus, { code: undefined })),
    ]
      .join('\n')
      .replaceAll('&#x27;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&')
    for (const marker of notesMarkers) expect(rendered).not.toContain(marker)
  })

  it('is not read by any page, layout or component', () => {
    const sources = [
      'app/page.tsx',
      'app/layout.tsx',
      'app/search/page.tsx',
      'app/search/search-form.tsx',
      'app/privacy/page.tsx',
      'app/data-deletion/page.tsx',
      'app/data-deletion/status/page.tsx',
      'components/legal/privacy-policy.tsx',
      'components/legal/data-deletion-instructions.tsx',
      'components/legal/deletion-status.tsx',
    ].map((path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'))
    for (const source of sources) {
      // Les composants citent le fichier en commentaire ; ils ne doivent jamais le lire ni l'importer.
      expect(source).not.toMatch(/(import|require|readFile\w*|fetch)\b[^\n]*pages-legales/)
      for (const marker of notesMarkers) expect(source).not.toContain(marker)
    }
  })
})

describe('public page dependencies', () => {
  const source = (path: string) => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')
  const imports = (path: string) => [...source(path).matchAll(/^import .+ from '([^']+)'$/gm)].map((match) => match[1]).sort()
  // Code sans commentaires, pour ne vérifier que les usages réels.
  const code = (path: string) => source(path).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

  it.each([
    ['privacy/page.tsx', '@/components/legal/privacy-policy'],
    ['data-deletion/page.tsx', '@/components/legal/data-deletion-instructions'],
  ])('%s only reads APP_URL through getAppUrl(), at request time', (path, component) => {
    expect(imports(path)).toEqual([component, '@/lib/env', 'next', 'next/server'].sort())
    expect(source(path)).toContain("import { getAppUrl } from '@/lib/env'")
    expect(code(path)).toContain('await connection()')
    expect(code(path)).not.toMatch(/getEnv|getServerSession|cookies\(|process\.env/)
  })

  it('status page reads no environment variable and no session', () => {
    expect(imports('data-deletion/status/page.tsx')).toEqual(['@/components/legal/deletion-status', 'next'])
    expect(code('data-deletion/status/page.tsx')).not.toMatch(/getEnv|getAppUrl|getServerSession|cookies\(|process\.env/)
  })
})
