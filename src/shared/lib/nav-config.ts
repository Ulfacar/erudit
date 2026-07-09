import type { Role } from '@prisma/client'
import { roleMatches } from '@/shared/lib/role-access'

/**
 * Source of truth for sidebar / hub visibility AND for per-route gating.
 * If a user's role is not in `roles`, the link is hidden and the page should
 * be wrapped in <RoleGate roles={...}> for hard enforcement.
 *
 * Структура — двухуровневая: топ-уровень = личные ленты + сворачиваемые РАЗДЕЛЫ (group).
 * Раздел (`group: true`) — родитель без своей страницы, только разворачивается.
 */
export interface NavRoute {
  /** Stable id, also used as URL path under the dashboard (для group — синтетический ключ). */
  href: string
  label: string
  /** Allowed roles. Empty array = visible to everyone authenticated. */
  roles: Role[]
  children?: NavRoute[]
  /** Optional badge shown next to label (e.g. 'Скоро' for roadmap items) */
  badge?: string
  /** true → раздел-обёртка (бургер): не навигирует, только сворачивается. */
  group?: boolean
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
const FOUNDER_TIER: Role[] = ['super_admin', 'founder']
const ADMIN_AND_VICE: Role[] = ['super_admin', 'analyst', 'zavuch']
const STAFF_TIER: Role[] = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']
const STAFF_AND_SECRETARY: Role[] = [...STAFF_TIER, 'secretary']
const STAFF_PLUS_SPECIALIST: Role[] = [...STAFF_TIER, 'specialist']
const ADMIN_SECRETARY: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary']
// «Общественные» модули — видны всем, КРОМЕ учителя/куратора (чтобы не засорять их меню)
const NON_TEACHING_AUTH: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'specialist', 'student', 'parent']
const ALL_AUTH_NO_SEC: Role[] = ALL_AUTH.filter((r) => r !== 'secretary')
const NON_TEACHING_NO_SEC: Role[] = NON_TEACHING_AUTH.filter((r) => r !== 'secretary')
// Узкие роли сотрудников: у каждого свой кабинет + общие коммуникации
const NEW_STAFF: Role[] = ['accountant', 'chief_accountant', 'finance_manager', 'psychologist', 'doctor', 'hr', 'librarian', 'cook', 'zavhoz', 'senior_psychologist', 'safeguarding_lead', 'call_center', 'media']
// Психологическая служба (eSPSMS): кто ведёт кейсы
const PSY_STAFF: Role[] = ['psychologist', 'senior_psychologist', 'specialist', 'super_admin']
const CC_TIER: Role[] = ['college_counselor', 'super_admin']
const ZVR_TIER: Role[] = ['safeguarding_lead', 'zavuch', 'super_admin']

/** Раздел-обёртка: роли = объединение ролей детей (иначе раздел скрылся бы целиком). */
function grp(href: string, label: string, children: NavRoute[]): NavRoute {
  const roles = [...new Set(children.flatMap((c) => c.roles))] as Role[]
  return { href, label, roles, group: true, children }
}

/**
 * ── Меню: личные ленты + сворачиваемые разделы ──
 * По встрече с Эмиром (Этап 9, анти-оверфункционал): плоский длинный сайдбар →
 * компактные раскрывающиеся разделы; каждая роль видит только релевантное.
 */
export const SIDEBAR_NAV: NavRoute[] = [
  // ── Личные ленты / вход ──
  { href: '/diary', label: 'Дневник', roles: ['student', 'parent'] },
  { href: '/screening', label: 'Скрининг', roles: ['student'] },
  { href: '/today', label: 'Сегодня', roles: ['teacher', 'curator', 'super_admin', 'zavuch'] },
  { href: '/home', label: 'Главная', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'specialist', 'teacher', 'curator'] },
  { href: '/agent', label: 'Панель агента', roles: [...ALL_AUTH, ...NEW_STAFF] },
  { href: '/founder', label: 'Учредитель', roles: FOUNDER_TIER },
  { href: '/calculator', label: 'Калькулятор', roles: ['super_admin', 'founder', 'analyst'] },
  { href: '/tariff-leads', label: 'Заявки на тариф', roles: ['super_admin', 'founder', 'analyst'] },
  { href: '/dashboard', label: 'Аналитика школы', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary'] },
  { href: '/core', label: 'Граф ядра', roles: ['super_admin'] },

  // ── Приёмная ──
  grp('/g/intake', 'Приёмная', [
    { href: '/admission', label: 'Приёмная (CRM)', roles: ADMIN_SECRETARY },
    { href: '/reserve', label: 'Очередь в классы', roles: ADMIN_SECRETARY },
    { href: '/operations/transition', label: 'Перевод года', roles: ADMIN_SECRETARY },
    { href: '/withdrawals', label: 'Отчисления', roles: ADMIN_SECRETARY },
    { href: '/director-appointments', label: 'Запись к директору', roles: ADMIN_SECRETARY },
  ]),

  // ── Ученики и классы ──
  grp('/g/students', 'Ученики и классы', [
    { href: '/students', label: 'Ученики', roles: STAFF_PLUS_SPECIALIST.concat('secretary', 'psychologist', 'doctor', 'safeguarding_lead') },
    { href: '/classes', label: 'Классы', roles: ADMIN_SECRETARY },
    { href: '/teachers', label: 'Педагоги', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr'] },
    { href: '/teachers/workload', label: 'Нагрузка педагогов', roles: [...ADMIN_AND_VICE, 'hr'] },
    { href: '/group-transfers', label: 'Переводы между группами', roles: ['super_admin', 'zavuch', 'teacher', 'curator'] },
    { href: '/workspace/parents', label: 'Родители', roles: ['super_admin', 'analyst', 'zavuch', 'curator'] },
    { href: '/achievements', label: 'Достижения', roles: [...ADMIN_AND_VICE, 'secretary', 'teacher', 'curator', 'event_manager', 'safeguarding_lead'] },
    { href: '/phys-norms', label: 'Нормативы (физ-ра)', roles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] },
    { href: '/portfolio', label: 'Портфолио', roles: ADMIN_AND_VICE },
    { href: '/incidents', label: 'Происшествия', roles: STAFF_AND_SECRETARY.concat('specialist', 'psychologist', 'safeguarding_lead') },
    { href: '/urgent-issues', label: 'Срочные вопросы', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'psychologist'] },
  ]),

  // ── Учебный процесс ──
  grp('/g/academics', 'Учебный процесс', [
    { href: '/schedule', label: 'Расписание', roles: ALL_AUTH },
    { href: '/schedule/bells', label: 'Расписание звонков', roles: STAFF_AND_SECRETARY },
    { href: '/schedule/teacher', label: 'Расписание учителя', roles: STAFF_TIER },
    { href: '/journal', label: 'Журнал', roles: STAFF_TIER },
    { href: '/journal/attendance', label: 'Посещаемость', roles: STAFF_TIER },
    { href: '/substitutions', label: 'Замены', roles: STAFF_TIER },
    { href: '/time-off', label: 'Отгулы', roles: STAFF_TIER },
    { href: '/teacher-hours', label: 'Часы присутствия', roles: STAFF_TIER },
    { href: '/grading', label: 'Оценивание', roles: ADMIN_AND_VICE },
    { href: '/grading/categories', label: 'Категории оценок', roles: ADMIN_AND_VICE },
    { href: '/grading/moderation', label: 'Модерация оценок', roles: ADMIN_AND_VICE },
    { href: '/study-plan', label: 'Учебный план', roles: ADMIN_AND_VICE },
    { href: '/academic-periods', label: 'Учебные периоды', roles: ADMIN_AND_VICE },
    { href: '/curriculum-plan', label: 'КТП', roles: ADMIN_AND_VICE },
    { href: '/curriculum-plan/my', label: 'Моё КТП', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
    { href: '/my-questionnaire', label: 'Моя анкета', roles: ['teacher', 'curator'] },
    { href: '/lesson-plans', label: 'Поурочные планы', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
    { href: '/presentations', label: 'ИИ-презентации', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] },
    { href: '/tests', label: 'Тесты', roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst', 'student'] },
    { href: '/homework', label: 'Домашние задания', roles: ALL_AUTH_NO_SEC },
    { href: '/reports', label: 'Отчёты: успеваемость', roles: STAFF_TIER },
    { href: '/reports/attendance', label: 'Отчёты: посещаемость', roles: STAFF_TIER },
  ]),

  // ── Финансы ──
  grp('/g/finance', 'Финансы', [
    { href: '/finance', label: 'Финансы', roles: ['super_admin', 'analyst', 'accountant', 'chief_accountant', 'finance_manager'] },
    { href: '/finance/journal', label: 'Журнал оплат', roles: ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] },
    { href: '/workspace/accounting', label: 'Бухгалтерия', roles: [...ADMIN_AND_VICE, 'accountant', 'chief_accountant', 'finance_manager'] },
    { href: '/call-center', label: 'Колл-центр', roles: ['call_center', 'super_admin', 'analyst', 'zavuch', 'accountant'] },
  ]),

  // ── Психология и здоровье ──
  grp('/g/psy', 'Психология и здоровье', [
    { href: '/psychologist', label: 'Кабинет психолога', roles: PSY_STAFF },
    { href: '/psychologist/screening', label: 'Скрининг', roles: ['psychologist', 'senior_psychologist', 'psy_coordinator', 'super_admin'] },
    { href: '/psychologist/intake', label: 'Приём', roles: ['psychologist', 'senior_psychologist', 'specialist', 'super_admin'] },
    { href: '/psychologist/calendar', label: 'Календарь психолога', roles: PSY_STAFF },
    { href: '/psychologist/methods', label: 'Конструктор методик', roles: ['senior_psychologist', 'super_admin'] },
    { href: '/psychologist/overview', label: 'Психология: сводка', roles: ['psychologist', 'senior_psychologist', 'psy_coordinator', 'specialist', 'super_admin', 'analyst', 'zavuch', 'safeguarding_lead'] },
    { href: '/safeguarding', label: 'Воспитательная работа', roles: ['safeguarding_lead', 'zavuch', 'super_admin'] },
    { href: '/workspace/psychologist', label: 'Психолог (приёмы)', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist'] },
    { href: '/workspace/speech', label: 'Логопед', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'] },
    { href: '/workspace/medical', label: 'Медкабинет', roles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary', 'doctor'] },
  ]),

  grp('/g/zvr', 'Кабинет ЗВР', [
    { href: '/zvr', label: 'Дашборд', roles: ZVR_TIER },
    { href: '/zvr/incidents', label: 'Инциденты и Сессии', roles: ZVR_TIER },
    { href: '/zvr/family', label: 'Работа с семьёй', roles: ZVR_TIER },
    { href: '/zvr/culture', label: 'Культура и Сплочение', roles: ZVR_TIER },
  ]),

  // ── Кадры ──
  grp('/g/hr', 'Кадры', [
    { href: '/hr', label: 'Кадры (HR)', roles: ['super_admin', 'analyst', 'zavuch', 'hr', 'chief_accountant'] },
    { href: '/staff', label: 'Персонал', roles: [...ADMIN_SECRETARY, 'hr'] },
    { href: '/documents', label: 'Документы', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr'] },
  ]),

  // ── Жизнь школы (внеучебка + хозчасть + питание) ──
  grp('/g/life', 'Жизнь школы', [
    { href: '/events', label: 'Мероприятия', roles: [...NON_TEACHING_AUTH, 'safeguarding_lead', 'event_manager'] },
    { href: '/calendar', label: 'Календарь', roles: ADMIN_SECRETARY },
    { href: '/olympiads', label: 'Олимпиады и проекты', roles: NON_TEACHING_NO_SEC },
    { href: '/studios', label: 'Студии', roles: NON_TEACHING_NO_SEC },
    { href: '/trips', label: 'Выезды', roles: NON_TEACHING_NO_SEC },
    { href: '/library', label: 'Библиотека', roles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian'] },
    { href: '/library/issue', label: 'Выдача учебников', roles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian'] },
    { href: '/meals', label: 'Столовая', roles: ['student', 'parent', 'super_admin', 'analyst', 'zavuch', 'cook'] },
    { href: '/workspace/kitchen', label: 'Кухня', roles: ['super_admin', 'analyst', 'zavuch', 'cook'] },
    { href: '/workspace/maintenance', label: 'АХЧ', roles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'] },
    { href: '/media', label: 'Медиа-центр', roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'event_manager', 'media'] },
    { href: '/purchase-requests', label: 'Заявки на закупку', roles: ['super_admin', 'analyst', 'finance_manager', 'accountant', 'chief_accountant', 'zavhoz'] },
    { href: '/lost-found', label: 'Бюро находок', roles: [...NON_TEACHING_NO_SEC, 'zavhoz'] },
  ]),

  grp('/g/olympiad', 'Олимпиадный центр', [
    { href: '/olympiad-center/olympiads', label: 'Каталог олимпиад', roles: ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] },
    { href: '/olympiad-center/intensives', label: 'Интенсивы', roles: ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] },
  ]),

  grp('/g/college-consulting', 'Поступление за рубеж', [
    { href: '/cc', label: 'Колледж-консалтинг', roles: CC_TIER },
    { href: '/cc/reports', label: 'CC: отчёт', roles: ['founder', 'super_admin', 'college_counselor'] },
  ]),

  // ── Коммуникации ──
  grp('/g/comms', 'Коммуникации', [
    { href: '/chats', label: 'Чаты', roles: [...ALL_AUTH_NO_SEC, ...NEW_STAFF] },
    { href: '/news', label: 'Новости', roles: [...ALL_AUTH, ...NEW_STAFF] },
    { href: '/applications', label: 'Заявления', roles: ['parent', 'student', 'teacher', 'curator', 'zavuch', 'super_admin', 'secretary', 'analyst'] },
    { href: '/surveys', label: 'Опросы', roles: ALL_AUTH },
    { href: '/consents', label: 'Согласия', roles: ['parent', 'super_admin', 'analyst', 'zavuch', 'secretary', 'curator'] },
  ]),

  // ── Администрирование ──
  grp('/g/admin', 'Администрирование', [
    { href: '/analytics', label: 'Аналитика', roles: ADMIN_AND_VICE },
    { href: '/knowledge', label: 'База знаний', roles: ADMIN_SECRETARY },
    { href: '/import-export', label: 'Импорт / Экспорт', roles: ADMIN_SECRETARY },
    { href: '/roles', label: 'Роли', roles: ['super_admin'] },
    { href: '/branches', label: 'Филиалы', roles: ['super_admin', 'analyst'] },
  ]),
]

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
]

/**
 * Фильтр по роли. Рекурсивно фильтрует детей; `group`-раздел без видимых детей —
 * отбрасывается (нет пустых разделов в меню).
 */
export function filterNavByRole<T extends NavRoute>(items: T[], role: Role | null): T[] {
  if (!role) return []
  const out: T[] = []
  for (const item of items) {
    if (!roleMatches(item.roles, role)) continue
    if (item.children) {
      const children = filterNavByRole(item.children as T[], role)
      if (item.group && children.length === 0) continue
      out.push({ ...item, children } as T)
    } else {
      out.push(item)
    }
  }
  return out
}

/** Плоский список листьев меню роли (для «Главной»-хаба — гранулярные плитки). */
export function flattenNavLeaves(items: NavRoute[]): NavRoute[] {
  const out: NavRoute[] = []
  for (const item of items) {
    if (item.children && item.children.length > 0) out.push(...flattenNavLeaves(item.children))
    else if (!item.group) out.push(item)
  }
  return out
}
