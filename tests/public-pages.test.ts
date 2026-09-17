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
    expect(html).toContain('Your request has been processed.')
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
    expect(html).toContain('Settings → Account → Website permissions')
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
