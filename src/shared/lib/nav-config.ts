import type { Role } from '@prisma/client'

/**
 * Source of truth for sidebar / top-tabs visibility AND for per-route gating.
 * If a user's role is not in `roles`, the link is hidden and the page should
 * be wrapped in <RoleGate roles={...}> for hard enforcement.
 */
export interface NavRoute {
  /** Stable id, also used as URL path under the dashboard. */
  href: string
  label: string
  /** Allowed roles. Empty array = visible to everyone authenticated. */
  roles: Role[]
  children?: NavRoute[]
  /** Optional badge shown next to label (e.g. 'Скоро' for roadmap items) */
  badge?: string
}

const ALL_AUTH: Role[] = [
  'super_admin',
  'analyst',
  'zavuch',
  'secretary',
  'teacher',
  'curator',
  'specialist',
  'student',
  'parent',
]

const ADMIN_TIER: Role[] = ['super_admin', 'analyst']
const ADMIN_AND_VICE: Role[] = ['super_admin', 'analyst', 'zavuch']
const STAFF_TIER: Role[] = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']
const STAFF_AND_SECRETARY: Role[] = [...STAFF_TIER, 'secretary']
const STAFF_PLUS_SPECIALIST: Role[] = [...STAFF_TIER, 'specialist']
// Управленческие/админ-разделы — без учителя/куратора (у педагога простое EduPage-меню)
const ADMIN_SECRETARY: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary']
// «Общественные» модули — видны всем, КРОМЕ учителя/куратора (чтобы не засорять их меню)
const NON_TEACHING_AUTH: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'specialist', 'student', 'parent']

/**
 * ── Active pages only ──
 * Stub/placeholder pages are hidden from navigation until implemented.
 * See SIDEBAR_NAV_FUTURE below for the full planned list.
 */
export const SIDEBAR_NAV: NavRoute[] = [
  { href: '/diary', label: 'Дневник', roles: ['student', 'parent'] },
  { href: '/today', label: 'Сегодня', roles: ['teacher', 'curator', 'super_admin', 'zavuch'] },
  // Админская «Главная» — всешкольная статистика; учителю не показываем (у него «Сегодня»)
  { href: '/dashboard', label: 'Главная', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary'] },
  { href: '/classes', label: 'Классы', roles: ADMIN_SECRETARY },
  { href: '/academic-periods', label: 'Учебные периоды', roles: ADMIN_AND_VICE },
  { href: '/substitutions', label: 'Замены', roles: STAFF_TIER },
  { href: '/study-plan', label: 'Учебный план', roles: ADMIN_AND_VICE },
  {
    href: '/schedule',
    label: 'Расписание',
    roles: ALL_AUTH,
    children: [
      { href: '/schedule/bells', label: 'Расписание звонков', roles: STAFF_AND_SECRETARY },
      { href: '/schedule/teacher', label: 'Расписание учителя', roles: STAFF_TIER },
    ],
  },
  {
    href: '/grading',
    label: 'Оценивание',
    roles: STAFF_TIER,
    children: [
      { href: '/grading/categories', label: 'Категории оценок', roles: ADMIN_AND_VICE },
      { href: '/grading/moderation', label: 'Модерация', roles: ADMIN_AND_VICE },
    ],
  },
  { href: '/students', label: 'Ученики', roles: STAFF_PLUS_SPECIALIST.concat('secretary') },
  {
    href: '/teachers',
    label: 'Педагоги',
    roles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
    children: [
      { href: '/teachers/workload', label: 'Нагрузка', roles: ADMIN_AND_VICE },
    ],
  },
  {
    href: '/reports',
    label: 'Отчёты',
    roles: STAFF_TIER,
    children: [
      { href: '/reports/grades', label: 'Успеваемость', roles: STAFF_TIER },
      { href: '/reports/attendance', label: 'Посещаемость', roles: STAFF_TIER },
    ],
  },
  { href: '/homework', label: 'Домашние задания', roles: ALL_AUTH },
  { href: '/tests', label: 'Тесты', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst', 'student'] },
  { href: '/curriculum-plan/my', label: 'Моё КТП', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
  { href: '/lesson-plans', label: 'Поурочные планы', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
  { href: '/presentations', label: 'ИИ-презентации', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
  { href: '/chats', label: 'Чаты', roles: ALL_AUTH },
  { href: '/news', label: 'Новости', roles: ALL_AUTH },
  { href: '/applications', label: 'Заявления', roles: ['parent', 'student', 'teacher', 'curator', 'zavuch', 'super_admin', 'secretary', 'analyst'] },
  { href: '/surveys', label: 'Опросы', roles: ALL_AUTH },
  { href: '/meals', label: 'Столовая', roles: ['student', 'parent', 'super_admin', 'analyst', 'zavuch', 'secretary'] },
  { href: '/consents', label: 'Согласия', roles: ['parent', 'super_admin', 'analyst', 'zavuch', 'secretary', 'curator'] },
  { href: '/lost-found', label: 'Бюро находок', roles: NON_TEACHING_AUTH },
  { href: '/urgent-issues', label: 'Срочные вопросы', roles: ['super_admin', 'analyst', 'zavuch', 'specialist'] },
  { href: '/incidents', label: 'Происшествия', roles: STAFF_AND_SECRETARY.concat('specialist') },
  { href: '/analytics', label: 'Аналитика', roles: ADMIN_AND_VICE },
  // Учебные модули
  { href: '/calendar', label: 'Календарь', roles: ADMIN_SECRETARY },
  { href: '/curriculum-plan', label: 'КТП', roles: ADMIN_AND_VICE },
  { href: '/achievements', label: 'Достижения', roles: ADMIN_SECRETARY },
  { href: '/portfolio', label: 'Портфолио', roles: ADMIN_SECRETARY },
  { href: '/library', label: 'Библиотека', roles: [...ADMIN_SECRETARY, 'teacher', 'curator'] },
  { href: '/olympiads', label: 'Олимпиады и проекты', roles: NON_TEACHING_AUTH },
  { href: '/events', label: 'Мероприятия', roles: NON_TEACHING_AUTH },
  { href: '/studios', label: 'Студии', roles: NON_TEACHING_AUTH },
  { href: '/trips', label: 'Выезды', roles: NON_TEACHING_AUTH },
  // Администрирование
  { href: '/staff', label: 'Персонал', roles: ADMIN_SECRETARY },
  { href: '/documents', label: 'Документы', roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] },
  { href: '/roles', label: 'Роли', roles: ['super_admin'] },
  // Workspace (специалисты)
  { href: '/workspace/speech', label: 'Логопед', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'] },
  { href: '/workspace/psychologist', label: 'Психолог', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'] },
  { href: '/workspace/medical', label: 'Медкабинет', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary'] },
  { href: '/workspace/parents', label: 'Родители', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'] },
  // Хозчасть / бизнес
  { href: '/workspace/accounting', label: 'Бухгалтерия', roles: ADMIN_AND_VICE },
  { href: '/workspace/kitchen', label: 'Кухня', roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] },
  { href: '/workspace/maintenance', label: 'АХЧ', roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] },
]

/**
 * ── Future pages (hidden until implemented) ──
 * Uncomment and move to SIDEBAR_NAV as each feature ships.
 */
// export const SIDEBAR_NAV_FUTURE: NavRoute[] = [
//   { href: '/roles', label: 'Роли', roles: ['super_admin'] },
//   { href: '/olympiads', label: 'Олимпиады и проекты', roles: ALL_AUTH },
//   { href: '/events', label: 'Мероприятия школы', roles: ALL_AUTH },
//   { href: '/studios', label: 'Студии', roles: ALL_AUTH },
//   { href: '/trips', label: 'Выезды', roles: ALL_AUTH },
//   { href: '/staff', label: 'Персонал', roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] },
//   { href: '/documents', label: 'Документы', roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] },
// ]

export interface TopTab {
  value: string
  label: string
  href: string
  roles: Role[]
}

export const TOP_TABS: TopTab[] = [
  { value: 'schedule', label: 'Текущее расписание', href: '/schedule', roles: ALL_AUTH },
  { value: 'classes', label: 'Классы по группам', href: '/classes', roles: STAFF_AND_SECRETARY },
  { value: 'teachers', label: 'Педагоги', href: '/teachers', roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] },
  { value: 'logoped', label: 'Логопед', href: '/workspace/speech', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'] },
  { value: 'psychologist', label: 'Психолог', href: '/workspace/psychologist', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'] },
  { value: 'medical', label: 'Мед', href: '/workspace/medical', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary'] },
  { value: 'parents', label: 'Родители', href: '/workspace/parents', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'] },
  // Stubs (hidden until implemented):
  // { value: 'accounting', label: 'Бухгалтерия', href: '/workspace/accounting', roles: ADMIN_TIER },
  // { value: 'maintenance', label: 'АХЧ', href: '/workspace/maintenance', roles: ADMIN_AND_VICE },
  // { value: 'kitchen', label: 'Кухня', href: '/workspace/kitchen', roles: ADMIN_TIER },
]

export function filterNavByRole<T extends { roles: Role[]; children?: T[] }>(
  items: T[],
  role: Role | null,
): T[] {
  if (!role) return []
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) =>
      item.children
        ? ({ ...item, children: filterNavByRole(item.children, role) } as T)
        : item,
    )
}
