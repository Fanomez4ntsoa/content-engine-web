# content-engine-web

Petite app web de **Content Engine Listening**, l'outil de veille Threads de La Plateforme du Portable.
Elle sert à deux choses :

- l'**App Review Meta** : parcours OAuth complet, URL de rappel publiques, pages légales en ligne ;
- la **consultation ponctuelle** de posts publics récents correspondant à un mot-clé.

Elle ne publie rien, ne répond à rien, ne like rien, n'envoie aucun message. Les réponses se font à la
main, depuis Threads. Elle est indépendante du worker local `content-engine` : les deux programmes ne
communiquent pas.

## Ce que fait l'app

| Chemin | Rôle |
|---|---|
| `/` | Présentation, bouton « Log in with Threads », messages de retour de connexion (`?login=denied\|failed\|expired`) |
| `/search` | Protégée. Username connecté, champ mot-clé, résultats (texte, @username, date UTC, lien), bouton Log out |
| `/privacy` | Politique de confidentialité |
| `/data-deletion` | Instructions de suppression des données |
| `/data-deletion/status?code=` | Statut d'une demande de suppression |
| `/api/auth/login` | Redirection vers l'écran d'autorisation Threads (state anti-CSRF en cookie) |
| `/api/auth/callback` | Retour OAuth : vérification du state, échange du code, `/me`, ouverture de session |
| `/api/auth/logout` | POST, contrôle Origin, destruction de la session |
| `/api/search` | POST JSON, protégée, appelle `keyword_search` côté serveur |
| `/api/threads/uninstall` | Uninstall Callback Meta (signed_request vérifié, 200) |
| `/api/threads/delete` | Delete Callback Meta (signed_request vérifié, JSON `{ url, confirmation_code }`) |

Les textes légaux de référence sont dans [`docs/pages-legales.md`](docs/pages-legales.md). Un test vérifie
que les pages affichent exactement ces textes : toute modification doit être faite aux deux endroits.

### Garanties de confidentialité (celles promises par la politique)

- **Aucune base de données, aucun stockage de posts.** Les résultats sont affichés puis oubliés.
- **Session = cookie chiffré** (iron-session) `httpOnly`, `Secure`, `SameSite=Lax`, 1 h au plus :
  user id, username, jeton. La session expire au plus tôt entre 1 h et la durée de vie du jeton.
- **Le jeton et les secrets ne vont jamais au navigateur.** Tous les appels Threads partent du serveur,
  jeton dans l'en-tête `Authorization: Bearer`, jamais dans une URL.
- **Aucun jeton, secret, code ou mot-clé dans les logs.** Un seul module de log (`src/lib/log.ts`),
  limité à des événements aux champs fermés (motif d'échec, type d'erreur, statut HTTP, code Meta,
  noms de variables).
- **Permissions demandées** : `threads_basic` et `threads_keyword_search`, rien d'autre.
- **En-têtes** : CSP sans ressource externe, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`,
  `nosniff`, `Cache-Control: no-store` sur `/search`, `/api/*` et la page de statut.

## Installation

Prérequis : **Node.js 22.13 ou plus récent**.

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
```

`.env` et `.env.local` sont ignorés par git. Seul `.env.example` est suivi.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (http://localhost:3000) |
| `npm run build` | Build de production (ne nécessite aucune variable d'environnement) |
| `npm run start` | Sert le build de production |
| `npm run typecheck` | TypeScript strict (`tsc --noEmit`) |
| `npm run lint` | ESLint (`no-console` en erreur) |
| `npm test` | Tests unitaires vitest, sans aucun appel réseau |
| `npm run check` | typecheck + lint + tests |
| `npm run e2e` | Build, puis scénario Playwright dans Chromium sur `next start` (voir plus bas) |

### Tests de bout en bout (`npm run e2e`)

Le script [`tests/e2e/run.mjs`](tests/e2e/run.mjs) lance l'app en production (CSP active) avec des
variables factices et un `SESSION_SECRET` aléatoire, forge une session locale avec un **faux jeton**,
puis vérifie les pages publiques, la protection de `/search`, le formulaire, le rendu des résultats,
le logout, et un second serveur où seule `APP_URL` est définie. Aucun jeton réel n'est utilisé.

Une étape envoie ce faux jeton à Threads, qui doit le refuser (erreur 190 → retour sur
`/?login=expired`) ; sans réseau, une erreur 502 affichée est acceptée.

Chromium est requis une fois :

```bash
npx playwright-core install chromium
```

Variables optionnelles : `E2E_PORT` (3199 par défaut, le port suivant sert au second serveur),
`CHROME_PATH` (navigateur à utiliser à la place de celui de Playwright).

## Variables d'environnement

Toutes sont obligatoires pour que la connexion et la recherche fonctionnent.

| Variable | Règle |
|---|---|
| `THREADS_APP_ID` | Numérique. **Threads App ID** (cas d'usage Threads), pas l'identifiant de l'app Meta |
| `THREADS_APP_SECRET` | Non vide. **Threads App Secret**, pas la clé secrète de l'app Meta |
| `APP_URL` | Origine seule, sans chemin ni slash final (`https://mon-app.vercel.app`). HTTPS obligatoire, sauf `http://localhost` |
| `THREADS_REDIRECT_URI` | Exactement `APP_URL` + `/api/auth/callback` |
| `SESSION_SECRET` | Au moins 32 caractères aléatoires, par exemple `openssl rand -base64 48` |

Comportement si la configuration est incomplète :

- au démarrage, l'app **ne plante pas** : elle journalise `{"event":"env_invalid","variables":[...]}`
  avec les **noms** des variables fautives, jamais leurs valeurs ;
- `/privacy`, `/data-deletion` et `/data-deletion/status` restent en **200** tant qu'`APP_URL` est valide ;
- les routes qui ont besoin des secrets (connexion, recherche, callbacks Meta, accueil) répondent **500**.

Changer `SESSION_SECRET` déconnecte tout le monde (les cookies existants deviennent illisibles).

## Déploiement Vercel

1. Importer le dépôt dans Vercel (framework détecté : Next.js). Rien à changer dans les réglages de build.
2. **Avant le premier déploiement**, renseigner les 5 variables dans *Settings → Environment Variables*
   pour l'environnement **Production**. `APP_URL` et `THREADS_REDIRECT_URI` doivent utiliser le
   domaine de production définitif (celui qui sera déclaré chez Meta).
3. Déployer. Après toute modification d'une variable, **redéployer** : Vercel ne l'applique pas aux
   déploiements existants.
4. Vérifier que le domaine de production est accessible sans authentification Vercel
   (Deployment Protection) : Meta et les examinateurs doivent pouvoir joindre les pages et les callbacks.

Vérification rapide après déploiement (remplacer `APP_URL`) :

```bash
APP_URL=https://mon-app.vercel.app
for path in / /privacy /data-deletion /data-deletion/status; do
  curl -s -o /dev/null -w "%{http_code}  $path\n" "$APP_URL$path"
done
# Callbacks joignables : un POST sans signature doit renvoyer 400 (pas 404 ni 500)
curl -s -o /dev/null -w "%{http_code}  delete\n" -X POST -d 'signed_request=x.y' "$APP_URL/api/threads/delete"
curl -s -o /dev/null -w "%{http_code}  uninstall\n" -X POST -d 'signed_request=x.y' "$APP_URL/api/threads/uninstall"
```

## URL à déclarer dans le tableau de bord Meta

À partir d'`APP_URL` (domaine de production), dans les réglages du cas d'usage Threads et de l'app :

| Champ Meta | URL |
|---|---|
| Redirect Callback URL (URI de redirection OAuth) | `APP_URL/api/auth/callback` |
| Uninstall Callback URL | `APP_URL/api/threads/uninstall` |
| Delete Callback URL | `APP_URL/api/threads/delete` |
| Privacy Policy URL (URL de la politique de confidentialité) | `APP_URL/privacy` |

La page `APP_URL/data-deletion` décrit la suppression des données ; `APP_URL/data-deletion/status?code=…`
est l'URL renvoyée à Meta par le Delete Callback.

L'URI de redirection doit être **identique au caractère près** à `THREADS_REDIRECT_URI`.

## Limites connues

- **OAuth indisponible sur les previews Vercel.** L'URI de redirection est vérifiée à l'identique par
  Meta et par l'app : seul le domaine déclaré (production) fonctionne. Sur une preview, les variables de
  production pointent vers un autre domaine, et le contrôle Origin refuse aussi la recherche et le logout.
- **OAuth indisponible en local** sans URI de redirection HTTPS correspondante déclarée chez Meta
  (l'URI doit être identique à `THREADS_REDIRECT_URI`). En local, on peut vérifier
  les pages publiques, les callbacks (avec un signed_request signé à la main) et l'interface via
  `npm run e2e`, qui forge une session.
- **Cookies `Secure` refusés sur `http://localhost` par certains navigateurs.** Les cookies de session et
  de state sont toujours `Secure` (préfixes `__Host-` et `__Secure-`), y compris en local, et ce n'est
  pas configurable. Chromium les accepte sur `localhost` (vérifié par `npm run e2e`) ; d'autres
  navigateurs peuvent les refuser, et la session ne tient alors pas en local.
- **Code OAuth visible dans les logs Vercel.** Le code d'autorisation arrive en query string sur
  `/api/auth/callback`, et Vercel journalise les URL de requête. L'app ne logge rien elle-même ; le code
  est à usage unique et de courte durée, et la politique de confidentialité le mentionne.
- **Jeton non révocable au logout.** Le logout supprime le cookie, mais le jeton reste valide chez Meta
  jusqu'à son expiration (1 h au plus). Pour couper l'accès immédiatement : retirer l'app dans les
  autorisations de site Web de Threads.
- **Code de confirmation non vérifiable.** Rien n'étant stocké, `/data-deletion/status` ne peut pas
  vérifier qu'un code a réellement été émis : tout code au bon format (32 caractères hexadécimaux
  minuscules) affiche le même message.
- **Avant l'approbation de Meta**, la recherche ne renvoie que les posts des comptes testeurs.
- **Quota** : 2 200 recherches par 24 h glissantes par compte, toutes apps confondues (les recherches
  sans résultat ne comptent pas). L'app affiche un message et ne relance jamais automatiquement.
- **Valeurs de l'URL dans le HTML source.** Next.js intègre l'URL courante, échappée, dans les données de
  routage de la page. Une valeur invalide de `?login=` ou `?code=` n'est jamais affichée, mais elle figure
  sous forme de JSON échappé dans la source.

## Checklist avant la vidéo App Review

**Configuration**

- [ ] Les 5 variables **Production** sont renseignées sur Vercel, avec le domaine de production dans
      `APP_URL` et `THREADS_REDIRECT_URI`, et un redéploiement a suivi la dernière modification.
- [ ] Threads App ID et Threads App Secret (pas la paire de l'app Meta).
- [ ] Les 4 URL du tableau ci-dessus sont déclarées chez Meta, sur le domaine de production.
- [ ] Permissions du cas d'usage : `threads_basic` et `threads_keyword_search` uniquement.
- [ ] `npm run check` et `npm run e2e` sont verts sur le commit déployé.

**Pages et callbacks**

- [ ] `/`, `/privacy`, `/data-deletion` et `/data-deletion/status` répondent **200 sans connexion**
      (fenêtre de navigation privée, ou la commande `curl` ci-dessus).
- [ ] Les callbacks répondent 400 à un POST non signé (joignables, pas de 404).
- [ ] Le **nom affiché dans l'écran d'autorisation Threads** est identique à celui des pages légales :
      « Content Engine Listening ».
- [ ] Le lien vers les autorisations de site Web Threads, sur `/data-deletion`, s'ouvre correctement.

**Données de démonstration**

- [ ] Le compte utilisé est bien testeur de l'app, et l'invitation a été acceptée.
- [ ] Un **post de test public** contenant le mot-clé utilisé dans la vidéo a été publié récemment
      (recherche de type RECENT), et apparaît dans les résultats.
- [ ] Le quota de recherche n'est pas épuisé.

**Tournage** (fenêtre privée, sans session préalable)

1. Accueil → « Log in with Threads ».
2. Écran d'autorisation Threads → accepter.
3. Retour sur `/search` avec le username affiché.
4. Saisie du mot-clé → Search → liste des posts (texte, @username, date, lien).
5. Log out.
6. Montrer `/privacy` et `/data-deletion` depuis le pied de page.

## Structure

```
src/app/                  pages, route handlers, CSS, favicon
src/components/legal/     textes légaux (miroir de docs/pages-legales.md)
src/lib/                  logique testable : env, session, OAuth, signed_request, recherche, logs
src/lib/threads/          client Threads (zod), normalisation des posts, classification des erreurs
src/instrumentation.ts    validation non bloquante de la configuration au démarrage
tests/                    tests vitest (fetch simulé), fixtures, e2e Playwright
docs/pages-legales.md     textes légaux de référence
```
