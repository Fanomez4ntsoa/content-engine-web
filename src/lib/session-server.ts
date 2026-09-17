import 'server-only'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'
import { readActiveSession, sessionOptions, type SessionData } from '@/lib/session'

/** Session active pour les server components (lecture seule). */
export async function getServerSession(): Promise<SessionData | null> {
  const session = await getIronSession(await cookies(), sessionOptions(getEnv().SESSION_SECRET))
  return readActiveSession({ ...session })
}
