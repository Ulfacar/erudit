'use client';

import { Badge } from '@mantine/core';
import { IconAward } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, subjectField, subjectLookup } from '@/shared/components/ui/resource-helpers';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;

const LEVELS = [
  { value: 'school', label: 'Школьный' },
  { value: 'district', label: 'Районный' },
  { value: 'city', label: 'Городской' },
  { value: 'republic', label: 'Республиканский' },
  { value: 'international', label: 'Международный' },
];

const STATUSES = [
  { value: 'announced', label: 'Анонсирована' },
  { value: 'registration', label: 'Регистрация' },
  { value: 'ongoing', label: 'Идёт' },
  { value: 'finished', label: 'Завершена' },
];

const FORMATS = [
  { value: 'individual', label: 'Индивидуальная' },
  { value: 'team', label: 'Командная' },
];

const PLACE_TYPES = [
  { value: 'офлайн', label: 'Офлайн' },
  { value: 'онлайн', label: 'Онлайн' },
];

const STATUS_COLOR: Record<string, string> = {
  announced: 'yellow',
  registration: 'green',
  ongoing: 'blue',
  finished: 'gray',
};

function optionLabel(options: { value: string; label: string }[], value: unknown) {
  return options.find((item) => item.value === value)?.label ?? String(value ?? '—');
}

function renderRegDeadline(value: unknown) {
  if (!value) return '—';

  const deadline = new Date(String(value));
  if (Number.isNaN(deadline.getTime())) return String(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft >= 0 && daysLeft <= 7) {
    return (
      <Badge variant="light" color={daysLeft <= 2 ? 'red' : 'orange'} radius="sm">
        через {daysLeft} дн.
      </Badge>
    );
  }

  return fmtDate(value);
}

export default function OlympiadCenterOlympiadsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <ResourcePage
        title="Каталог олимпиад"
        icon={<IconAward size={22} color="#e8590c" />}
        endpoint="/api/v1/olympiad-center/olympiads"
        createLabel="Добавить олимпиаду"
        canDelete
        searchable
        lookups={[subjectLookup]}
        columns={[
          { key: 'date', label: 'Дата', render: (row) => fmtDate(row.date), width: 110 },
          { key: 'name', label: 'Название' },
          { key: 'subjectId', label: 'Предмет', render: (row, maps) => (row.subjectId ? maps.subjects?.[String(row.subjectId)] ?? '—' : '—') },
          {
            key: 'level',
            label: 'Уровень',
            render: (row) => (
              <Badge variant="light" color="orange" radius="sm">
                {optionLabel(LEVELS, row.level)}
              </Badge>
            ),
          },
          {
            key: 'status',
            label: 'Статус',
            render: (row) => (
              <Badge variant="light" color={STATUS_COLOR[String(row.status)] ?? 'gray'} radius="sm">
                {optionLabel(STATUSES, row.status)}
              </Badge>
            ),
          },
          { key: 'regDeadline', label: 'Дедлайн регистрации', render: (row) => renderRegDeadline(row.regDeadline), width: 170 },
        ]}
        fields={[
          { name: 'name', label: 'Название', type: 'text', required: true },
          subjectField,
          { name: 'level', label: 'Уровень', type: 'select', options: LEVELS, defaultValue: 'school' },
          { name: 'status', label: 'Статус', type: 'select', options: STATUSES, defaultValue: 'announced' },
          { name: 'date', label: 'Дата проведения', type: 'date', required: true },
          { name: 'regDeadline', label: 'Дедлайн регистрации', type: 'date' },
          { name: 'resultsDate', label: 'Дата результатов', type: 'date' },
          { name: 'organizer', label: 'Организатор', type: 'text' },
          { name: 'registrationUrl', label: 'Ссылка на регистрацию', type: 'text' },
          { name: 'participationFormat', label: 'Формат участия', type: 'select', options: FORMATS },
          { name: 'placeType', label: 'Тип площадки', type: 'select', options: PLACE_TYPES },
          { name: 'place', label: 'Адрес/платформа', type: 'text' },
          { name: 'cost', label: 'Стоимость, 0=беспл.', type: 'number' },
          { name: 'stage', label: 'Этап', type: 'text' },
          { name: 'coachNotes', label: 'Заметки тренера', type: 'textarea' },
          {
            name: 'awardSchemeId',
            label: 'Схема наград',
            type: 'select',
            searchable: true,
            optionsEndpoint: '/api/v1/olympiad-center/award-schemes',
            optionsMap: (row) => ({ value: String(row.id), label: String(row.name) }),
          },
        ]}
      />
    </RoleGate>
  );
}
