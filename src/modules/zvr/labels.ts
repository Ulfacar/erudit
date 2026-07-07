export const ZVR_INCIDENT_ROLE_LABELS = {
  initiator: 'Инициатор',
  victim: 'Пострадавший',
  accomplice: 'Соучастник',
  witness: 'Свидетель',
} as const;

export const ZVR_MEDIATION_PARTY_LABELS = {
  student: 'Ученик',
  parent: 'Родитель',
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

export const ZVR_SUPERVISION_STATUS_LABELS = {
  improved: 'Поведение улучшилось',
  no_change: 'Без изменений',
  needs_council: 'Требуется повторный консилиум',
} as const;

export const EVENT_SOCIAL_GOAL_LABELS = {
  integration: 'Интеграция',
  adaptation: 'Адаптация',
  teambuilding: 'Командообразование',
  friendship: 'Дружба',
  tradition: 'Традиции',
  discipline_council: 'Совет дисциплины',
  civic: 'Гражданская позиция',
} as const;

export const EVENT_SOCIAL_GOAL_COLORS = {
  integration: 'green',
  adaptation: 'teal',
  teambuilding: 'blue',
  friendship: 'cyan',
  tradition: 'grape',
  discipline_council: 'red',
  civic: 'indigo',
} as const;
