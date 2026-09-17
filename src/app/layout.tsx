import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Content Engine Listening', template: '%s — Content Engine Listening' },
  description: 'Search recent public Threads posts about mobile phones.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <nav aria-label="Legal">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/data-deletion">Data Deletion</Link>
          </nav>
        </footer>
      </body>
    </html>
  )
}
