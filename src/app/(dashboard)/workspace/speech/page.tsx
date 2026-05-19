'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconSpeakerphone, IconCalendar, IconNotes } from '@tabler/icons-react';

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

      <Group grow align="stretch">
        <Card withBorder radius="sm" p="md">
          <Group gap="sm" mb="md">
            <IconCalendar size={20} stroke={1.5} />
            <Title order={4}>Расписание занятий</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Расписание индивидуальных и групповых занятий будет доступно в следующем обновлении.
          </Text>
        </Card>

        <Card withBorder radius="sm" p="md">
          <Group gap="sm" mb="md">
            <IconNotes size={20} stroke={1.5} />
            <Title order={4}>Заметки и прогресс</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Отслеживание прогресса учеников будет доступно в следующем обновлении.
          </Text>
        </Card>
      </Group>
    </Stack>
  );
}
