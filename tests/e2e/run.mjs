// Vérification de bout en bout dans Chromium, sur le build de production (`next start`), CSP active.
// Lancement : `npm run e2e` (build puis ce script). Exclu de `npm test`.
//
// Aucun jeton réel : la session est forgée localement avec un SESSION_SECRET aléatoire et un
// faux jeton. L'étape « appel réel » envoie ce faux jeton à Threads, qui doit le refuser (190) ;
// sans réseau, une erreur 502 affichée est aussi acceptée.
//
// Navigateur : celui de playwright-core (`npx playwright-core install chromium`) ou CHROME_PATH.

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { sealData } from 'iron-session'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.E2E_PORT ?? 3199)
const BASE = `http://localhost:${PORT}`
const SESSION_SECRET = randomBytes(48).toString('base64')
const FAKE_TOKEN = `e2e-fake-token-${randomBytes(8).toString('hex')}`
const REAL_CALL_KEYWORD = `e2e-keyword-${randomBytes(4).toString('hex')}`
const SESSION_COOKIE = '__Host-cew_session'

const expectedRealPost = JSON.parse(readFileSync(new URL('../fixtures/keyword-search-real.expected.json', import.meta.url), 'utf8'))

const out = (line) => process.stdout.write(`${line}\n`)
const results = []
function check(label, ok, detail = '') {
  results.push(Boolean(ok))
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ` — ${detail}` : ''}`)
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

/** Lance `next start` dans son propre groupe de processus ; `stop()` arrête next start et next-server. */
function startServer(port, env) {
  const base = `http://localhost:${port}`
  let log = ''
  const child = spawn('node_modules/.bin/next', ['start', '-p', String(port)], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...env },
  })
  child.stdout.on('data', (chunk) => (log += chunk))
  child.stderr.on('data', (chunk) => (log += chunk))

  return {
    base,
    log: () => log,
    async stop() {
      if (child.exitCode !== null) return
      const exited = new Promise((resolve) => child.once('exit', resolve))
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        return // déjà arrêté
      }
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))])
    },
    async ready() {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        try {
          await fetch(`${base}/privacy`, { redirect: 'manual' })
          return
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 250))
        }
      }
      throw new Error(`Server did not start on ${base}`)
    },
  }
}

const server = startServer(PORT, {
  THREADS_APP_ID: '1000000000',
  THREADS_APP_SECRET: 'e2e-not-a-real-secret',
  APP_URL: BASE,
  THREADS_REDIRECT_URI: `${BASE}/api/auth/callback`,
  SESSION_SECRET,
})

async function sessionCookie() {
  const value = await sealData(
    { userId: '17841400000000000', username: 'e2e_user', accessToken: FAKE_TOKEN, expiresAt: Date.now() + 3_600_000 },
    { password: SESSION_SECRET, ttl: 3600 },
  )
  // Cookie `__Host-` : posé pour l'hôte localhost, Secure, Path=/ (Chromium l'envoie en http sur localhost).
  return { name: SESSION_COOKIE, value, url: 'https://localhost/', httpOnly: true, secure: true, sameSite: 'Lax' }
}

// ---------------------------------------------------------------------------
// Scénario
// ---------------------------------------------------------------------------

async function run() {
  await server.ready()
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  const context = await browser.newContext()
  const page = await context.newPage()

  const violations = []
  const consoleErrors = []
  const failedResources = []
  // Les 4xx volontaires de /api/search apparaissent aussi en console : on ne garde que le reste.
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('/api/')) {
      failedResources.push(`${response.status()} ${new URL(response.url()).pathname}`)
    }
  })
  await page.exposeFunction('reportCspViolation', (violation) => violations.push(violation))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) =>
      window.reportCspViolation(`${event.violatedDirective} ${event.blockedURI}`),
    )
  })

  const externalRequests = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== BASE) externalRequests.push(request.url())
  })

  // --- Pages publiques, sans session
  const publicPages = [
    ['/', 'Content Engine Listening'],
    ['/privacy', 'Privacy Policy — Content Engine Listening'],
    ['/data-deletion', 'Data Deletion Instructions — Content Engine Listening'],
    ['/data-deletion/status', 'Deletion Request Status — Content Engine Listening'],
  ]
  for (const [path, title] of publicPages) {
    const response = await page.goto(`${BASE}${path}`)
    check(`${path} : 200 sans session`, response.status() === 200, String(response.status()))
    check(`${path} : titre « ${title} »`, (await page.title()) === title, await page.title())
    const visibleText = await page.locator('body').innerText()
    check(
      `${path} : notes d'implémentation absentes`,
      !["Notes d'implémentation", 'Delete Callback URL', 'Uninstall Callback URL', 'collecteur local'].some((marker) => visibleText.includes(marker)),
    )
    const footer = page.locator('footer.site-footer')
    check(
      `${path} : pied de page vers /privacy et /data-deletion`,
      (await footer.locator('a[href="/privacy"]').count()) === 1 && (await footer.locator('a[href="/data-deletion"]').count()) === 1,
    )
  }

  await page.goto(`${BASE}/`)
  check('accueil : bouton « Log in with Threads » vers /api/auth/login', (await page.getByRole('link', { name: 'Log in with Threads' }).getAttribute('href')) === '/api/auth/login')
  const icon = await page.locator('link[rel="icon"]').first().getAttribute('href')
  const iconResponse = await page.request.get(`${BASE}${icon}`)
  check('favicon local servi', icon?.startsWith('/icon') && iconResponse.status() === 200 && iconResponse.headers()['content-type']?.includes('image/svg+xml'), `${icon} ${iconResponse.status()}`)

  for (const [value, expected] of [
    ['denied', 'Login was cancelled. No access was granted to the app.'],
    ['failed', 'Login with Threads did not complete. Please try again.'],
    ['expired', 'Your session has expired. Please log in again.'],
  ]) {
    await page.goto(`${BASE}/?login=${value}`)
    check(`?login=${value} : message fixe`, (await page.getByRole('status').textContent()) === expected)
  }
  for (const value of ['bogus', encodeURIComponent('<b>injected</b>'), 'toString']) {
    await page.goto(`${BASE}/?login=${value}`)
    // Le HTML brut contient l'URL échappée dans les données du routeur Next (script JSON) :
    // on vérifie ce qui est rendu (texte visible, éléments), pas la source.
    check(
      `?login=${decodeURIComponent(value)} : ignoré`,
      (await page.locator('main [role="status"]').count()) === 0 &&
        !(await page.locator('body').innerText()).includes('injected') &&
        (await page.locator('body b').count()) === 0,
    )
  }

  await page.goto(`${BASE}/privacy`)
  check('/privacy : APP_URL injectée', (await page.locator('main').textContent()).includes(`Web app (${BASE})`) && !(await page.content()).includes('[APP_URL]'))
  await page.goto(`${BASE}/data-deletion`)
  const permissionsLink = page.locator('main a[href="https://www.threads.com/settings/website_permissions"]')
  check(
    '/data-deletion : lien cliquable vers les autorisations Threads',
    (await permissionsLink.count()) === 1 &&
      (await permissionsLink.getAttribute('rel')) === 'noopener noreferrer' &&
      (await permissionsLink.getAttribute('target')) === '_blank',
  )
  check('/data-deletion : URL de statut avec APP_URL', (await page.locator('main code').textContent()) === `${BASE}/data-deletion/status?code=YOUR_CONFIRMATION_CODE`)

  const validCode = randomBytes(16).toString('hex')
  const statusResponse = await page.goto(`${BASE}/data-deletion/status?code=${validCode}`)
  check('/data-deletion/status : no-store', (statusResponse.headers()['cache-control'] ?? '').includes('no-store'), statusResponse.headers()['cache-control'])
  check('/data-deletion/status : code valide affiché', (await page.locator('main').textContent()).includes('Your request has been processed.') && (await page.locator('main code').textContent()) === validCode)
  const invalidCode = `${validCode.slice(0, 31)}<i>zz</i>`
  await page.goto(`${BASE}/data-deletion/status?code=${encodeURIComponent(invalidCode)}`)
  check(
    '/data-deletion/status : code invalide jamais réaffiché',
    (await page.locator('main').textContent()).includes('This status link is not valid.') &&
      !(await page.locator('body').innerText()).includes(validCode.slice(0, 31)) &&
      (await page.locator('main code, body i').count()) === 0,
  )

  // --- Protection de /search
  await page.goto(`${BASE}/search`)
  check('/search sans session redirige vers /', new URL(page.url()).pathname === '/')

  await context.addCookies([await sessionCookie()])
  const searchResponse = await page.goto(`${BASE}/search`)
  const headers = searchResponse.headers()
  check('/search avec session : 200', searchResponse.status() === 200)
  check("CSP : script-src 'self' 'unsafe-inline'", (headers['content-security-policy'] ?? '').includes("script-src 'self' 'unsafe-inline'"))
  check('Cache-Control no-store sur /search', (headers['cache-control'] ?? '').includes('no-store'), headers['cache-control'])
  check('username affiché', await page.getByText('@e2e_user').isVisible())
  check('titre de /search', (await page.title()) === 'Search — Content Engine Listening', await page.title())
  await page.waitForLoadState('networkidle')

  const submit = page.locator('form.search-form button')

  // --- Formulaire hydraté : l'erreur 400 du serveur s'affiche sans soumission native
  await page.fill('#keyword', '   ')
  await submit.click()
  await page.locator('.notice-error').waitFor({ timeout: 5000 })
  check(
    'formulaire hydraté (400 affichée, pas de rechargement)',
    (await page.locator('.notice-error').textContent()) === 'Please enter a keyword.' && new URL(page.url()).search === '',
  )

  // --- Deux 403 distingués par le corps
  for (const [code, message] of [
    ['forbidden_origin', 'This request was not allowed. Reload the page and try again.'],
    ['permission_missing', 'Keyword search is not allowed for this account. Log out, then log in again and accept all requested permissions.'],
  ]) {
    await page.route('**/api/search', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code, message } }) }),
    )
    await page.fill('#keyword', 'phone')
    await submit.click()
    await page.getByText(message).waitFor({ timeout: 5000 })
    check(`403 ${code} : message propre affiché`, true)
    await page.unroute('**/api/search')
  }

  // --- Réponse réelle Meta (fixture normalisée) : bouton désactivé, texte accentué, lien
  await page.route('**/api/search', async (route) => {
    check('fetch envoie la bonne Origin', route.request().headers().origin === BASE, route.request().headers().origin)
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(expectedRealPost) })
  })
  await page.fill('#keyword', 'iOS 27')
  await submit.click()
  await page.waitForTimeout(150)
  check('bouton désactivé pendant la requête', await submit.isDisabled())
  await page.locator('.post').first().waitFor()
  check('bouton réactivé ensuite', !(await submit.isDisabled()))
  const realPost = expectedRealPost.posts[0]
  check('texte accentué affiché', (await page.locator('.post-text').first().textContent()) === realPost.text)
  const realLink = page.locator('.post a').first()
  check('lien vers le post réel', (await realLink.getAttribute('href')) === realPost.permalink)
  check('lien rel="noopener noreferrer" target="_blank"', (await realLink.getAttribute('rel')) === 'noopener noreferrer' && (await realLink.getAttribute('target')) === '_blank')
  check('date UTC affichée', (await page.locator('.post time').first().textContent()) === '17 Sep 2026, 10:17 UTC')
  await page.unroute('**/api/search')

  // --- Texte brut, post sans texte ni lien, aucun résultat
  await page.route('**/api/search', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        posts: [
          { id: '1', text: '<img src=x onerror="window.__xss=1"> <b>bold</b>', username: 'alice', timestamp: realPost.timestamp },
          { id: '2', username: 'bob', timestamp: realPost.timestamp },
        ],
      }),
    }),
  )
  await page.fill('#keyword', 'xss')
  await submit.click()
  await page.getByText('@bob').waitFor()
  check('HTML rendu comme texte brut', (await page.locator('.post img, .post b').count()) === 0 && (await page.evaluate(() => window.__xss)) === undefined)
  check('post sans texte ni lien', (await page.locator('.post').nth(1).locator('a').count()) === 0 && (await page.locator('.post').nth(1).textContent()).includes('(No text)'))
  await page.unroute('**/api/search')

  await page.route('**/api/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"posts":[]}' }))
  await page.fill('#keyword', 'nothing')
  await submit.click()
  await page.getByText('No recent public posts were found for this keyword.').waitFor({ timeout: 5000 })
  check('message neutre si aucun résultat', true)
  await page.unroute('**/api/search')

  // --- Appel réel : le faux jeton doit être refusé par Threads
  await page.fill('#keyword', REAL_CALL_KEYWORD)
  const apiResponse = page.waitForResponse('**/api/search')
  await submit.click()
  const realStatus = (await apiResponse).status()
  if (realStatus === 401) {
    await page.waitForURL(`${BASE}/?login=expired`, { timeout: 5000 })
    check('faux jeton refusé par Threads → /?login=expired, session supprimée', !(await context.cookies(BASE)).some((c) => c.name === SESSION_COOKIE))
  } else {
    check(`appel réel sans réseau ou refusé (statut ${realStatus})`, realStatus === 502 || realStatus === 403)
  }

  // --- Logout depuis le vrai bouton
  await context.addCookies([await sessionCookie()])
  await page.goto(`${BASE}/`)
  check('accueil avec session : lien vers la recherche', await page.getByRole('link', { name: 'Continue to search as @e2e_user' }).isVisible())
  await page.goto(`${BASE}/search`)
  const logoutRequest = page.waitForRequest('**/api/auth/logout')
  await page.click('button:has-text("Log out")')
  check('le formulaire de logout envoie la bonne Origin', (await logoutRequest).headers().origin === BASE)
  await page.waitForURL(`${BASE}/`, { timeout: 5000 })
  check('logout → /, cookie supprimé', !(await context.cookies(BASE)).some((c) => c.name === SESSION_COOKIE))

  // --- Bilan
  check('aucune violation CSP', violations.length === 0, violations.join(' | '))
  check('aucune erreur console', consoleErrors.length === 0, consoleErrors.join(' | '))
  check('aucune ressource en erreur', failedResources.length === 0, failedResources.join(' | '))
  check('aucune ressource externe chargée', externalRequests.length === 0, externalRequests.join(' | '))
  check('logs serveur sans jeton ni mot-clé', !server.log().includes(FAKE_TOKEN) && !server.log().includes(REAL_CALL_KEYWORD))
  check('aucun env_invalid avec une configuration complète', !server.log().includes('env_invalid'))

  await browser.close()
}

// ---------------------------------------------------------------------------
// Configuration incomplète : seule APP_URL est valide
// ---------------------------------------------------------------------------

async function runWithPartialConfig() {
  const port = PORT + 1
  const base = `http://localhost:${port}`
  const invalidSecret = 'too-short-secret-e2e'
  const partial = startServer(port, { APP_URL: base, SESSION_SECRET: invalidSecret })
  try {
    await partial.ready()
    for (const path of ['/privacy', '/data-deletion', `/data-deletion/status?code=${randomBytes(16).toString('hex')}`]) {
      const response = await fetch(`${base}${path}`)
      check(`config partielle : ${path.split('?')[0]} en 200`, response.status === 200, String(response.status))
    }
    // React sépare les nœuds de texte par <!-- --> dans le HTML serveur.
    const privacy = (await (await fetch(`${base}/privacy`)).text()).replaceAll('<!-- -->', '')
    check('config partielle : APP_URL injectée dans /privacy', privacy.includes(`Web app (${base})`))

    const search = await fetch(`${base}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ keyword: 'phone' }),
    })
    check('config partielle : /api/search reste strict (500)', search.status === 500, String(search.status))
    const login = await fetch(`${base}/api/auth/login`, { redirect: 'manual' })
    check('config partielle : /api/auth/login reste strict (500)', login.status === 500, String(login.status))

    const event = partial.log().split('\n').find((line) => line.includes('"event":"env_invalid"'))
    check(
      'config partielle : env_invalid loggé avec les noms seulement',
      event === JSON.stringify({ event: 'env_invalid', variables: ['THREADS_APP_ID', 'THREADS_APP_SECRET', 'THREADS_REDIRECT_URI', 'SESSION_SECRET'] }),
      event,
    )
    check('config partielle : aucune valeur de variable dans les logs', !partial.log().includes(invalidSecret))
  } finally {
    await partial.stop()
  }
}

try {
  await run()
} catch (error) {
  results.push(false)
  out(`FAIL  exception : ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await server.stop()
}

try {
  await runWithPartialConfig()
} catch (error) {
  results.push(false)
  out(`FAIL  exception (config partielle) : ${error instanceof Error ? error.message : String(error)}`)
}

const failed = results.filter((ok) => !ok).length
out(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
