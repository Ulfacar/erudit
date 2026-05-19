export interface GradeCategory {
  id: number;
  name: string;
  weight: number;
  isAssessment?: boolean;
  requiresModeration?: boolean;
}

/**
 * 26 категорий оценивания — 1-в-1 из ТЗ (раздел "Оценивание").
 * Это reference-список для UI / валидаций / документации. В БД фактические
 * категории берутся из таблицы `GradeCategory` (см. seed.ts), и именно они
 * используются для выставления оценок.
 *
 * requiresModeration=true → при выставлении оценка идёт на модерацию
 * (КР, Зачёт, Триместровая, Итоговая, Экзамен — по ТЗ).
 * isAssessment=true → "является проверочной работой" (для отчёта №4).
 */
export const GRADE_CATEGORIES: GradeCategory[] = [
  { id: 1,  name: 'Правила (терминология)',              weight: 2 },
  { id: 2,  name: 'Пятиминутка',                         weight: 2 },
  { id: 3,  name: 'Разноуровневые задания',              weight: 3 },
  { id: 4,  name: 'Домашнее задание',                    weight: 1 },
  { id: 5,  name: 'Устный ответ/работа у доски',         weight: 3 },
  { id: 6,  name: 'Письменные работы',                   weight: 3, isAssessment: true },
  { id: 7,  name: 'Диктант',                             weight: 5, isAssessment: true },
  { id: 8,  name: 'Словарный диктант',                   weight: 5, isAssessment: true },
  { id: 9,  name: 'Тест',                                weight: 4, isAssessment: true },
  { id: 10, name: 'Аудирование',                         weight: 3 },
  { id: 11, name: 'Грамматика',                          weight: 3 },
  { id: 12, name: 'Чтение и понимание',                  weight: 3 },
  { id: 13, name: 'Контрольное списывание',              weight: 3, isAssessment: true },
  { id: 14, name: 'Эссе',                                weight: 4, isAssessment: true },
  { id: 15, name: 'Лабораторная работа',                 weight: 4, isAssessment: true },
  { id: 16, name: 'Проект',                              weight: 3 },
  { id: 17, name: 'Презентация',                         weight: 3 },
  { id: 18, name: 'Творческие работы',                   weight: 2 },
  { id: 19, name: 'Самооценивание',                      weight: 1 },
  { id: 20, name: 'Работа в группах (коммуникация)',     weight: 2 },
  { id: 21, name: 'Олимпиадные задания',                 weight: 5 },
  { id: 22, name: 'Контрольная работа',                  weight: 5, isAssessment: true, requiresModeration: true },
  { id: 23, name: 'Зачёт',                               weight: 5, isAssessment: true, requiresModeration: true },
  { id: 24, name: 'Триместровая работа',                 weight: 5, isAssessment: true, requiresModeration: true },
  { id: 25, name: 'Итоговая работа',                     weight: 5, isAssessment: true, requiresModeration: true },
  { id: 26, name: 'Экзамен',                             weight: 5, isAssessment: true, requiresModeration: true },
];

export interface GradeScaleRow {
  fivePoint: number;
  twelvePoint: [number, number];
  percent: [number, number];
  gpa: [number, number];
  label: string;
}

/**
 * Grade scale conversion table mapping between 5-point, 12-point, percentage, and GPA systems.
 */
export const GRADE_SCALE: GradeScaleRow[] = [
  {
    fivePoint: 5,
    twelvePoint: [10, 12],
    percent: [90, 100],
    gpa: [3.7, 4.0],
    label: 'Отлично',
  },
  {
    fivePoint: 4,
    twelvePoint: [7, 9],
    percent: [70, 89],
    gpa: [2.7, 3.69],
    label: 'Хорошо',
  },
  {
    fivePoint: 3,
    twelvePoint: [4, 6],
    percent: [50, 69],
    gpa: [1.7, 2.69],
    label: 'Удовлетворительно',
  },
  {
    fivePoint: 2,
    twelvePoint: [1, 3],
    percent: [20, 49],
    gpa: [1.0, 1.69],
    label: 'Неудовлетворительно',
  },
  {
    fivePoint: 1,
    twelvePoint: [0, 0],
    percent: [0, 19],
    gpa: [0, 0.99],
    label: 'Не аттестован',
  },
];
