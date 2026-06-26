'use client'

import { ReactNode } from 'react'
import { Box, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import type { Role } from '@prisma/client'
import { useRole } from '@/shared/hooks/useRole'
import { roleMatches } from '@/shared/lib/role-access'

interface RoleGateProps {
  roles?: Role[]
  minStarLevel?: number
  /** What to render when access is denied. By default — friendly stub. */
  fallback?: ReactNode
  /** When true — render nothing on deny instead of fallback. */
  silent?: boolean
  children: ReactNode
}

export function RoleGate({ roles, minStarLevel, fallback, silent, children }: RoleGateProps) {
  const { role, starLevel, isLoading } = useRole()

  if (isLoading) return null

  const roleOk = roleMatches(roles, role)
  const starOk = minStarLevel === undefined || starLevel >= minStarLevel

  if (roleOk && starOk) return <>{children}</>

  if (silent) return null
  if (fallback !== undefined) return <>{fallback}</>

  return (
    <Box p="xl">
      <Stack align="center" gap="sm">
        <ThemeIcon size={48} radius="xl" variant="light" color="gray">
          <IconLock size={28} stroke={1.5} />
        </ThemeIcon>
        <Text fw={500}>Доступ ограничен</Text>
        <Text size="sm" c="dimmed" ta="center" maw={400}>
          У вашей роли нет прав для просмотра этого раздела. Обратитесь к администратору, если считаете это ошибкой.
        </Text>
      </Stack>
    </Box>
  )
}
