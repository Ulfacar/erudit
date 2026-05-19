'use client'

import { useEffect, useState } from 'react'
import { Badge, Tooltip } from '@mantine/core'
import { IconClock, IconLock } from '@tabler/icons-react'
import {
  canBypassEditWindow,
  formatRemaining,
  getEditWindowState,
} from '@/shared/lib/edit-window'
import { useRole } from '@/shared/hooks/useRole'

interface EditWindowBadgeProps {
  createdAt: string | Date
  /** Compact (icon only) display for cells. */
  compact?: boolean
}

/**
 * Visual indicator of the 24h grade-edit window for teachers.
 * Privileged roles (zavuch/analyst/super_admin) bypass the window — badge is hidden for them.
 */
export function EditWindowBadge({ createdAt, compact }: EditWindowBadgeProps) {
  const { role } = useRole()
  const [state, setState] = useState(() => getEditWindowState(createdAt))

  useEffect(() => {
    const tick = () => setState(getEditWindowState(createdAt))
    tick()
    const interval = window.setInterval(tick, 60_000)
    return () => window.clearInterval(interval)
  }, [createdAt])

  if (canBypassEditWindow(role)) return null

  const label = formatRemaining(state)

  if (compact) {
    return (
      <Tooltip label={label} withArrow>
        <Badge
          size="xs"
          radius="sm"
          variant="light"
          color={state.expired ? 'gray' : state.hoursRemaining < 2 ? 'orange' : 'blue'}
          leftSection={
            state.expired
              ? <IconLock size={10} />
              : <IconClock size={10} />
          }
          px={4}
        >
          {state.expired ? '0ч' : `${state.hoursRemaining}ч`}
        </Badge>
      </Tooltip>
    )
  }

  return (
    <Badge
      variant="light"
      color={state.expired ? 'gray' : state.hoursRemaining < 2 ? 'orange' : 'blue'}
      leftSection={state.expired ? <IconLock size={12} /> : <IconClock size={12} />}
      size="sm"
    >
      {label}
    </Badge>
  )
}
