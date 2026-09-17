import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

/**
 * CSP sans nonce (pages statiques possibles) : 'unsafe-inline' est requis
 * pour les scripts d'hydratation de Next. 'unsafe-eval' uniquement en dev.
 * Aucun domaine tiers : tous les appels Threads partent du serveur.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  // Empêche `next dev` de générer des fichiers d'instructions pour agents de code à la racine.
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          // Pas `no-referrer` : Chrome enverrait alors `Origin: null` sur le POST du
          // formulaire de logout, rejeté par le contrôle Origin. `same-origin` ne
          // transmet toujours rien aux sites externes.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
      {
        source: '/search',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/data-deletion/status',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
