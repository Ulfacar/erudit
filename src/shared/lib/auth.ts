import { getServerSession as nextAuthGetServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import type { Role } from '@prisma/client'

/** Extended session user with custom fields */
export interface SessionUser {
  id: string
  login: string
  role: Role
  starLevel: number
  name?: string | null
  email?: string | null
  image?: string | null
}

/** Extended session type */
export interface AppSession {
  user: SessionUser
  expires: string
}

/**
 * Get the current server session.
 * Returns null if not authenticated.
 */
export async function getServerSession(): Promise<AppSession | null> {
  const session = await nextAuthGetServerSession(authOptions)
  return session as AppSession | null
}

/**
 * Require authentication. Throws if no session.
 */
export async function requireAuth(): Promise<AppSession> {
  const session = await getServerSession()
  if (!session) {
    throw new Error('Unauthorized: not authenticated')
  }
  return session
}

/**
 * Require one of the specified roles. Throws if role doesn't match.
 */
export async function requireRole(roles: Role[]): Promise<AppSession> {
  const session = await requireAuth()
  if (!roles.includes(session.user.role)) {
    throw new Error(
      `Forbidden: required role ${roles.join(' | ')}, got ${session.user.role}`
    )
  }
  return session
}

/**
 * Require a minimum star level. Throws if star level is insufficient.
 */
export async function requireStarLevel(level: number): Promise<AppSession> {
  const session = await requireAuth()
  if (session.user.starLevel < level) {
    throw new Error(
      `Forbidden: required star level ${level}, got ${session.user.starLevel}`
    )
  }
  return session
}
