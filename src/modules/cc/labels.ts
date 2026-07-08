import type {
  CcAdmissionStatus,
  CcApplicationType,
  CcConflictStatus,
  CcDocStatus,
  CcDocType,
  CcExamType,
} from '@prisma/client';

export const CC_DOC_TYPE_LABELS: Record<CcDocType, string> = {
  recommendation: 'Рекомендация',
  personal_statement: 'Личное эссе',
  essay: 'Эссе',
  cv: 'CV',
  brag_sheet: 'Brag sheet',
  portfolio: 'Портфолио',
  transcript: 'Транскрипт',
  passport: 'Паспорт',
  other: 'Прочее',
};

export const CC_DOC_STATUS_LABELS: Record<CcDocStatus, string> = {
  not_started: 'Не начато',
  draft: 'Черновик',
  in_review: 'На проверке',
  ready: 'Готово',
  received: 'Получено',
};

export const CC_ADMISSION_STATUS_LABELS: Record<CcAdmissionStatus, string> = {
  scouting: 'Скаутинг',
  document_prep: 'Сбор документов',
  submitted: 'Подано',
  decision_pending: 'Ожидание решения',
  offer_received: 'Оффер получен',
  rejected: 'Отказ',
  accepted_final: 'Принят финально',
};

export const CC_EXAM_TYPE_LABELS: Record<CcExamType, string> = {
  sat: 'SAT',
  ielts: 'IELTS',
  toefl: 'TOEFL',
  ort: 'ОРТ',
  csca: 'CSCA',
  opt: 'OPT',
  hsk: 'HSK',
  other: 'Другой',
};

export const CC_APPLICATION_TYPE_LABELS: Record<CcApplicationType, string> = {
  early_action: 'Early Action',
  early_decision: 'Early Decision',
  regular_decision: 'Regular Decision',
};

export const CC_CONFLICT_STATUS_LABELS: Record<CcConflictStatus, string> = {
  green: 'Зелёная зона',
  yellow: 'Внимание',
  red: 'Зона риска',
};

export const CC_DEADLINE_TYPE_LABELS: Record<string, string> = {
  application: 'Заявка',
  exam: 'Экзамен',
};
