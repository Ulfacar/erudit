'use client'

import { useSession } from 'next-auth/react'
import type { Role } from '@prisma/client'

interface UseRoleResult {
  role: Role | null
  starLevel: number
  login: string | null
  isLoading: boolean
  has: (...allowed: Role[]) => boolean
  hasStar: (min: number) => boolean
}

export function useRole(): UseRoleResult {
  const { data: session, status } = useSession()
  const role = (session?.user?.role as Role | undefined) ?? null
  const starLevel = session?.user?.starLevel ?? 0
  const login = session?.user?.login ?? null

  return {
    role,
    starLevel,
    login,
    isLoading: status === 'loading',
    has: (...allowed: Role[]) => (role ? allowed.includes(role) : false),
    hasStar: (min: number) => starLevel >= min,
  }
}
