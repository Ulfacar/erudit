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
// Этап 6 (по встрече с Эмиром): у ассистента/секретаря лишние модули убраны — оставляем
// только приёмку, классы, учеников, договоры, документы, мероприятия и происшествия.
const ALL_AUTH_NO_SEC: Role[] = ALL_AUTH.filter((r) => r !== 'secretary')
const NON_TEACHING_NO_SEC: Role[] = NON_TEACHING_AUTH.filter((r) => r !== 'secretary')
// Узкие роли сотрудников: у каждого свой кабинет + общие коммуникации
const NEW_STAFF: Role[] = ['accountant', 'psychologist', 'doctor', 'hr', 'librarian', 'cook', 'zavhoz', 'senior_psychologist', 'safeguarding_lead', 'call_center']
// Психологическая служба (eSPSMS): кто ведёт кейсы
const PSY_STAFF: Role[] = ['psychologist', 'senior_psychologist', 'specialist', 'super_admin']

/**
 * ── Active pages only ──
 * Stub/placeholder pages are hidden from navigation until implemented.
 * See SIDEBAR_NAV_FUTURE below for the full planned list.
 */
export const SIDEBAR_NAV: NavRoute[] = [
  { href: '/diary', label: 'Дневник', roles: ['student', 'parent'] },
  { href: '/today', label: 'Сегодня', roles: ['teacher', 'curator', 'super_admin', 'zavuch'] },
  { href: '/agent', label: 'Панель агента', roles: [...ALL_AUTH, ...NEW_STAFF] },
  {
    href: '/journal',
    label: 'Журнал',
    roles: STAFF_TIER,
    children: [
      { href: '/journal/attendance', label: 'Посещаемость', roles: STAFF_TIER },
    ],
  },
  // Админская «Главная» — всешкольная статистика; учителю не показываем (у него «Сегодня»)
  { href: '/dashboard', label: 'Главная', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary'] },
  // Ядро экосистемы: граф связей + CRM-воронка приёмной + база знаний
  { href: '/core', label: 'Граф ядра', roles: [...ADMIN_SECRETARY, 'senior_psychologist', 'safeguarding_lead', 'psychologist', 'call_center', 'hr', 'accountant'] },
  { href: '/admission', label: 'Приёмная (CRM)', roles: ADMIN_SECRETARY },
  { href: '/reserve', label: 'Очередь в классы', roles: ADMIN_SECRETARY },
  { href: '/operations/transition', label: 'Перевод года', roles: ADMIN_AND_VICE },
  { href: '/withdrawals', label: 'Отчисления', roles: ADMIN_SECRETARY },
  { href: '/director-appointments', label: 'Запись к директору', roles: ADMIN_SECRETARY },
  { href: '/group-transfers', label: 'Переводы между группами', roles: ['super_admin', 'zavuch', 'teacher', 'curator'] },
  { href: '/import-export', label: 'Импорт / Экспорт', roles: ADMIN_SECRETARY },
  { href: '/knowledge', label: 'База знаний', roles: ADMIN_SECRETARY },
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
    // Учителю/куратору не показываем — у них простые «Сегодня» и «Журнал».
    // Это аналитический/контрольный экран для администрации.
    roles: ADMIN_AND_VICE,
    children: [
      { href: '/grading/categories', label: 'Категории оценок', roles: ADMIN_AND_VICE },
      { href: '/grading/moderation', label: 'Модерация', roles: ADMIN_AND_VICE },
    ],
  },
  { href: '/students', label: 'Ученики', roles: STAFF_PLUS_SPECIALIST.concat('secretary', 'psychologist', 'doctor', 'safeguarding_lead') },
  {
    href: '/teachers',
    label: 'Педагоги',
    roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr'],
    children: [
      { href: '/teachers/workload', label: 'Нагрузка', roles: [...ADMIN_AND_VICE, 'hr'] },
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
  { href: '/homework', label: 'Домашние задания', roles: ALL_AUTH_NO_SEC },
  { href: '/tests', label: 'Тесты', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst', 'student'] },
  { href: '/curriculum-plan/my', label: 'Моё КТП', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
  { href: '/lesson-plans', label: 'Поурочные планы', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
  { href: '/presentations', label: 'ИИ-презентации', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
  { href: '/chats', label: 'Чаты', roles: [...ALL_AUTH_NO_SEC, ...NEW_STAFF] },
  { href: '/news', label: 'Новости', roles: [...ALL_AUTH, ...NEW_STAFF] },
  { href: '/applications', label: 'Заявления', roles: ['parent', 'student', 'teacher', 'curator', 'zavuch', 'super_admin', 'secretary', 'analyst'] },
  { href: '/surveys', label: 'Опросы', roles: ALL_AUTH },
  { href: '/meals', label: 'Столовая', roles: ['student', 'parent', 'super_admin', 'analyst', 'zavuch', 'secretary', 'cook'] },
  { href: '/consents', label: 'Согласия', roles: ['parent', 'super_admin', 'analyst', 'zavuch', 'secretary', 'curator'] },
  { href: '/lost-found', label: 'Бюро находок', roles: NON_TEACHING_NO_SEC },
  { href: '/urgent-issues', label: 'Срочные вопросы', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'psychologist'] },
  { href: '/incidents', label: 'Происшествия', roles: STAFF_AND_SECRETARY.concat('specialist', 'psychologist', 'safeguarding_lead') },
  { href: '/analytics', label: 'Аналитика', roles: ADMIN_AND_VICE },
  // Учебные модули
  { href: '/calendar', label: 'Календарь', roles: ADMIN_SECRETARY },
  { href: '/curriculum-plan', label: 'КТП', roles: ADMIN_AND_VICE },
  { href: '/achievements', label: 'Достижения', roles: ADMIN_AND_VICE },
  { href: '/portfolio', label: 'Портфолио', roles: ADMIN_AND_VICE },
  { href: '/library', label: 'Библиотека', roles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian'] },
  { href: '/library/issue', label: 'Выдача учебников', roles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian'] },
  { href: '/olympiads', label: 'Олимпиады и проекты', roles: NON_TEACHING_NO_SEC },
  { href: '/events', label: 'Мероприятия', roles: [...NON_TEACHING_AUTH, 'safeguarding_lead'] },
  { href: '/studios', label: 'Студии', roles: NON_TEACHING_NO_SEC },
  { href: '/trips', label: 'Выезды', roles: NON_TEACHING_NO_SEC },
  // Администрирование
  { href: '/staff', label: 'Персонал', roles: [...ADMIN_SECRETARY, 'hr'] },
  { href: '/hr', label: 'Кадры (HR)', roles: ['super_admin', 'analyst', 'zavuch', 'hr'] },
  { href: '/documents', label: 'Документы', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr'] },
  { href: '/roles', label: 'Роли', roles: ['super_admin'] },
  { href: '/branches', label: 'Филиалы', roles: ['super_admin', 'analyst'] },
  // Психологическая служба (eSPSMS) — кейс-менеджмент психолога
  { href: '/psychologist', label: 'Кабинет психолога', roles: PSY_STAFF },
  { href: '/psychologist/methods', label: 'Конструктор методик', roles: ['senior_psychologist', 'super_admin'] },
  { href: '/psychologist/overview', label: 'Психология: сводка', roles: ['super_admin', 'analyst', 'zavuch', 'senior_psychologist', 'safeguarding_lead'] },
  { href: '/safeguarding', label: 'Координатор безопасности', roles: ['safeguarding_lead', 'zavuch', 'super_admin'] },
  // Workspace (специалисты)
  { href: '/workspace/speech', label: 'Логопед', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'] },
  { href: '/workspace/psychologist', label: 'Психолог', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist'] },
  { href: '/workspace/medical', label: 'Медкабинет', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary', 'doctor'] },
  { href: '/workspace/parents', label: 'Родители', roles: ['super_admin', 'analyst', 'zavuch', 'curator'] },
  // Хозчасть / бизнес
  { href: '/finance', label: 'Финансы', roles: ['super_admin', 'analyst', 'accountant'] },
  { href: '/call-center', label: 'Колл-центр', roles: ['call_center', 'super_admin', 'analyst', 'zavuch', 'accountant'] },
  { href: '/finance/journal', label: 'Журнал оплат', roles: ['super_admin', 'analyst', 'zavuch', 'accountant'] },
  { href: '/workspace/accounting', label: 'Бухгалтерия', roles: [...ADMIN_AND_VICE, 'accountant'] },
  { href: '/workspace/kitchen', label: 'Кухня', roles: ['super_admin', 'analyst', 'zavuch', 'cook'] },
  { href: '/workspace/maintenance', label: 'АХЧ', roles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'] },
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
//   { href: '/documents', label: 'Документы', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr'] },
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
