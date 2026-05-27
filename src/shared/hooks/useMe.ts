'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export interface MeProfile {
  id: string
  login: string
  email: string | null
  role: string
  starLevel: number
  teacherId: string | null
  studentId: string | null
  parentId: string | null
  teacher: { id: string; firstName: string; lastName: string; middleName: string | null; position: string | null } | null
  student: { id: string; firstName: string; lastName: string; classId: string | null } | null
  parent: { id: string; firstName: string; lastName: string } | null
  children: { studentId: string; firstName: string; lastName: string; classId: string | null; className: string | null }[]
}

let cache: MeProfile | null = null

/**
 * Fetches and caches the current user's profile (role-specific IDs).
 * Cache is process-wide for the session lifetime; cleared on auth change.
 */
export function useMe(): { me: MeProfile | null; isLoading: boolean } {
  const { status } = useSession()
  const [me, setMe] = useState<MeProfile | null>(cache)
  const [isLoading, setIsLoading] = useState(cache === null)

  useEffect(() => {
    if (status !== 'authenticated') {
      cache = null
      setMe(null)
      setIsLoading(false)
      return
    }
    if (cache) {
      setMe(cache)
      setIsLoading(false)
      return
    }
    let cancelled = false
    fetch('/api/v1/me')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) {
          cache = j.data as MeProfile
          setMe(cache)
        }
      })
      .catch(() => {
        /* ignored — will retry on remount */
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  return { me, isLoading }
}
