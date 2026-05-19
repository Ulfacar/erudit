const RU_MONTHS_FULL = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const RU_WEEKDAYS = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота',
]

const RU_WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input)
}

/** "2026-04-29" — ISO date for inputs / API params. */
export function toIsoDate(input: Date | string | number): string {
  const d = toDate(input)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "29.04.2026" */
export function formatDateShort(input: Date | string | number): string {
  return toDate(input).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** "29 апреля" — без года */
export function formatDateNoYear(input: Date | string | number): string {
  const d = toDate(input)
  return `${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`
}

/** "29 апреля 2026" */
export function formatDateLong(input: Date | string | number): string {
  const d = toDate(input)
  return `${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
}

/** "29.04.2026, 14:25" */
export function formatDateTime(input: Date | string | number): string {
  return toDate(input).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function weekdayName(input: Date | string | number, short?: boolean): string {
  const d = toDate(input)
  return (short ? RU_WEEKDAYS_SHORT : RU_WEEKDAYS)[d.getDay()]
}

/**
 * Day-of-week index per ТЗ: Monday=1 .. Sunday=7
 * (matches schedule.dayOfWeek convention).
 */
export function dayOfWeek1to7(input: Date | string | number): number {
  const dow = toDate(input).getDay() // 0..6, Sunday=0
  return dow === 0 ? 7 : dow
}
