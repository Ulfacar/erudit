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
import { IconBrain, IconAlertTriangle } from '@tabler/icons-react';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class: { id: string; grade: number; letter: string };
  incidents?: IncidentItem[];
}

interface IncidentItem {
  id: string;
  studentId: string;
  reporterId: string;
  type: string;
  description: string;
  status: string;
  parentNotified: boolean;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  moderated: 'blue',
  resolved: 'green',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  moderated: 'Рассмотрен',
  resolved: 'Решен',
};

export default function PsychologistWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [allIncidents, setAllIncidents] = useState<(IncidentItem & { student?: StudentItem })[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const studentsRes = await fetch('/api/v1/students');
        const studentsData = await studentsRes.json();

        if (studentsData.success) {
          const allStudents: StudentItem[] = studentsData.data;

          // Fetch incidents for each student that has them
          const incidentPromises = allStudents.map(async (student) => {
            try {
              const res = await fetch(`/api/v1/students/${student.id}/incidents`);
              const data = await res.json();
              if (data.success && data.data.length > 0) {
                return {
                  student,
                  incidents: data.data as IncidentItem[],
                };
              }
            } catch {
              // skip
            }
            return null;
          });

          const results = await Promise.all(incidentPromises);
          const studentsWithIncidents: StudentItem[] = [];
          const incidents: (IncidentItem & { student?: StudentItem })[] = [];

          for (const result of results) {
            if (result) {
              studentsWithIncidents.push({
                ...result.student,
                incidents: result.incidents,
              });
              for (const inc of result.incidents) {
                incidents.push({ ...inc, student: result.student });
              }
            }
          }

          setStudents(studentsWithIncidents);
          setAllIncidents(
            incidents.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        }
      } catch {
        console.error('Failed to fetch psychologist data');
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
        <IconBrain size={28} stroke={1.5} />
        <Title order={2}>Кабинет психолога</Title>
      </Group>

      <Paper withBorder p="md" radius="sm">
        <Title order={4} mb="md">
          Ученики с инцидентами поведения
        </Title>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Кол-во инцидентов</Table.Th>
                <Table.Th>Последний статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center" py="md">
                      Нет учеников с инцидентами
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                students.map((s) => {
                  const lastIncident = s.incidents?.[0];
                  return (
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
                      <Table.Td>{s.incidents?.length || 0}</Table.Td>
                      <Table.Td>
                        {lastIncident && (
                          <Badge
                            variant="light"
                            color={STATUS_COLORS[lastIncident.status] || 'gray'}
                            size="sm"
                          >
                            {STATUS_LABELS[lastIncident.status] || lastIncident.status}
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Paper withBorder p="md" radius="sm">
        <Group gap="sm" mb="md">
          <IconAlertTriangle size={20} stroke={1.5} />
          <Title order={4}>Последние инциденты</Title>
        </Group>
        {allIncidents.length === 0 ? (
          <Text c="dimmed">Нет зарегистрированных инцидентов</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th>Ученик</Table.Th>
                  <Table.Th>Тип</Table.Th>
                  <Table.Th>Описание</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Родители уведомлены</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {allIncidents.slice(0, 20).map((inc) => (
                  <Table.Tr key={inc.id}>
                    <Table.Td>
                      {new Date(inc.createdAt).toLocaleDateString('ru-RU')}
                    </Table.Td>
                    <Table.Td>
                      {inc.student
                        ? `${inc.student.lastName} ${inc.student.firstName}`
                        : inc.studentId}
                    </Table.Td>
                    <Table.Td>{inc.type}</Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>
                        {inc.description}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={STATUS_COLORS[inc.status] || 'gray'}
                        size="sm"
                      >
                        {STATUS_LABELS[inc.status] || inc.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={inc.parentNotified ? 'green' : 'red'}
                        size="sm"
                      >
                        {inc.parentNotified ? 'Да' : 'Нет'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      <ResourcePage
        title="Рекомендации психолога"
        endpoint="/api/v1/specialist-recommendations"
        query={{ kind: 'psych' }}
        createLabel="Добавить рекомендацию"
        canDelete
        lookups={[studentLookup]}
        transformPayload={(f) => ({ ...f, kind: 'psych' })}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'text', label: 'Рекомендация' },
        ]}
        fields={[
          studentField,
          { name: 'text', label: 'Рекомендация', type: 'textarea', required: true },
          { name: 'date', label: 'Дата', type: 'date', required: true },
        ]}
      />

      <ResourcePage
        title="Консультации и занятия"
        endpoint="/api/v1/specialist-sessions"
        query={{ kind: 'psych' }}
        createLabel="Записать консультацию"
        canDelete
        lookups={[studentLookup]}
        transformPayload={(f) => ({ ...f, kind: 'psych' })}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'startTime', label: 'Время', render: (r) => (r.startTime ? String(r.startTime) : '—') },
          { key: 'note', label: 'Заметка' },
        ]}
        fields={[
          studentField,
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'startTime', label: 'Время', type: 'text', placeholder: '11:00' },
          { name: 'note', label: 'Заметка', type: 'textarea' },
        ]}
      />
    </Stack>
  );
}
