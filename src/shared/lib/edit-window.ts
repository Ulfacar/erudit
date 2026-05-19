export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

export interface EditWindowState {
  expired: boolean
  msRemaining: number
  hoursRemaining: number
  minutesRemaining: number
}

export function getEditWindowState(createdAt: string | Date): EditWindowState {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const elapsed = Date.now() - created.getTime()
  const remaining = EDIT_WINDOW_MS - elapsed
  if (remaining <= 0) {
    return { expired: true, msRemaining: 0, hoursRemaining: 0, minutesRemaining: 0 }
  }
  const hours = Math.floor(remaining / (60 * 60 * 1000))
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
  return {
    expired: false,
    msRemaining: remaining,
    hoursRemaining: hours,
    minutesRemaining: minutes,
  }
}

/**
 * Privileged roles can edit grades irrespective of the 24h window.
 * They still leave audit-trail.
 */
export function canBypassEditWindow(role: string | null | undefined): boolean {
  return role === 'zavuch' || role === 'super_admin' || role === 'analyst'
}

export function formatRemaining(state: EditWindowState): string {
  if (state.expired) return 'Окно редактирования закрыто'
  if (state.hoursRemaining > 0) {
    return `Можно править ещё ${state.hoursRemaining}ч ${state.minutesRemaining}мин`
  }
  return `Можно править ещё ${state.minutesRemaining}мин`
}
