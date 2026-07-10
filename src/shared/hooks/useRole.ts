'use client'

import { useSession } from 'next-auth/react'
import type { Role } from '@prisma/client'
import { roleMatches } from '@/shared/lib/role-access'

interface UseRoleResult {
  role: Role | null
  starLevel: number
  login: string | null
  grantedModules: string[]
  isLoading: boolean
  has: (...allowed: Role[]) => boolean
  hasStar: (min: number) => boolean
}

export function useRole(): UseRoleResult {
  const { data: session, status } = useSession()
  const role = (session?.user?.role as Role | undefined) ?? null
  const starLevel = session?.user?.starLevel ?? 0
  const login = session?.user?.login ?? null
  const grantedModules = (session?.user?.grantedModules as string[] | undefined) ?? []

  return {
    role,
    starLevel,
    login,
    grantedModules,
    isLoading: status === 'loading',
    has: (...allowed: Role[]) => roleMatches(allowed, role),
    hasStar: (min: number) => starLevel >= min,
  }
}
