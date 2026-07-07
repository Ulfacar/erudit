export const ZVR_INCIDENT_ROLE_LABELS = {
  initiator: 'Инициатор',
  victim: 'Пострадавший',
  accomplice: 'Соучастник',
  witness: 'Свидетель',
} as const;

export const ZVR_BEHAVIOR_LEVEL_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
} as const;

export const ZVR_INCIDENT_STATUS_LABELS = {
  pending: 'Новые',
  moderated: 'Идёт работа',
  resolved: 'Архив',
} as const;
