'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconSpeakerphone } from '@tabler/icons-react';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';

interface MedicalData {
  logoped?: boolean;
  [key: string]: unknown;
}

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  medicalData: MedicalData | null;
  class: { id: string; grade: number; letter: string };
}

export default function SpeechWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentItem[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/v1/students');
        const data = await res.json();

        if (data.success) {
          const speechStudents = data.data.filter(
            (s: StudentItem) => s.medicalData && s.medicalData.logoped === true,
          );
          setStudents(speechStudents);
        }
      } catch {
        console.error('Failed to fetch speech therapy data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader color="blue" />
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconSpeakerphone size={28} stroke={1.5} />
        <Title order={2}>Кабинет логопеда</Title>
      </Group>

      <Paper withBorder p="md" radius="sm">
        <Title order={4} mb="md">
          Ученики на занятиях логопеда
        </Title>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text c="dimmed" ta="center" py="md">
                      Нет учеников на занятиях логопеда
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                students.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      {s.lastName} {s.firstName} {s.middleName || ''}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {s.class.grade}
                        {s.class.letter}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="teal" size="sm">
                        На учете
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <ResourcePage
        title="Расписание занятий"
        endpoint="/api/v1/specialist-sessions"
        query={{ kind: 'speech' }}
        createLabel="Записать занятие"
        canDelete
        lookups={[studentLookup]}
        transformPayload={(f) => ({ ...f, kind: 'speech' })}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'startTime', label: 'Время', render: (r) => (r.startTime ? `${r.startTime}${r.endTime ? '–' + r.endTime : ''}` : '—') },
          { key: 'groupName', label: 'Группа' },
          { key: 'note', label: 'Заметка' },
        ]}
        fields={[
          studentField,
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'startTime', label: 'Начало', type: 'text', placeholder: '10:00' },
          { name: 'endTime', label: 'Конец', type: 'text', placeholder: '10:30' },
          { name: 'groupName', label: 'Группа (если групповое)', type: 'text' },
          { name: 'note', label: 'Заметка', type: 'textarea' },
        ]}
      />

      <ResourcePage
        title="Прогресс учеников"
        endpoint="/api/v1/specialist-progress"
        query={{ kind: 'speech' }}
        createLabel="Отметить прогресс"
        canDelete
        lookups={[studentLookup]}
        transformPayload={(f) => ({ ...f, kind: 'speech' })}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'metric', label: 'Показатель' },
          { key: 'value', label: 'Прогресс', render: (r) => `${r.value ?? 0}%` },
          { key: 'note', label: 'Заметка' },
        ]}
        fields={[
          studentField,
          { name: 'metric', label: 'Показатель', type: 'text', required: true, placeholder: 'Звук «Р»' },
          { name: 'value', label: 'Прогресс, %', type: 'number', required: true },
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'note', label: 'Заметка', type: 'textarea' },
        ]}
      />
    </Stack>
  );
}
