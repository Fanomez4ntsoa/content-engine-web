import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Version explicite : la détection automatique d'eslint-plugin-react
    // repose sur une API retirée d'ESLint 10.
    settings: { react: { version: '19.3' } },
    rules: {
      // Aucune trace applicative : rien ne doit pouvoir fuiter dans les logs.
      'no-console': 'error',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
