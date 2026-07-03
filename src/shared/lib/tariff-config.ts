export const USD_RATE = 89;

export const CORE = {
  name: 'Ядро платформы',
  setup: 89000,
  license: 89000,
} as const;

export const STANDARD_MODULES = [
  'Домашние задания',
  'Тесты и контрольные',
  'Учебный план ученика',
  'КТП / учебная программа',
  'Планы уроков',
  'База знаний',
  'Портфолио',
  'Олимпиады',
  'Презентации / материалы урока',
  'Физнормативы',
  'Кружки и студии',
  'Экскурсии и поездки',
  'Питание',
  'Библиотека (учёт)',
  'Бюро находок',
  'Медиа-галерея',
  'Мероприятия / календарь',
  'Документы',
  'Согласия',
  'Опросы',
  'Заявления',
  'Отчёты',
  'Запись к директору',
  'HR-онбординг + анкеты',
  'Учёт часов учителя',
  'Отпуска и отгулы',
  'Замены уроков',
  'Закупки / хоз-заявки',
  'Достижения',
  'Выбытие / отчисления',
  'Групповые переводы',
  'Резерв / бронирование',
] as const;

export const HEAVY_MODULES = [
  'AI-агент (ассистенты по ролям)',
  'Аналитика / BI',
  'Колл-центр / CRM обращений',
  'Приёмка и поступление',
  'Психолог (кейсы, DAP)',
  'Безопасность (инциденты + срочные)',
  'Мультифилиальность (филиалы + учредитель)',
] as const;

export const STANDARD_SETUP = 6000;
export const STANDARD_LICENSE = 8000;
export const HEAVY_SETUP = 12000;
export const HEAVY_LICENSE = 16000;

export function computeTotals(standard: string[], heavy: string[]) {
  return {
    setupTotal: CORE.setup + STANDARD_SETUP * standard.length + HEAVY_SETUP * heavy.length,
    licenseTotal: CORE.license + STANDARD_LICENSE * standard.length + HEAVY_LICENSE * heavy.length,
  };
}
