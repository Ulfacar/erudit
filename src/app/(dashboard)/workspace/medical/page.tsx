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
import { IconMedicalCross, IconShieldCheck } from '@tabler/icons-react';

interface MedicalData {
  allergies?: string;
  chronicDiseases?: string;
  foodReactions?: string;
  logoped?: boolean;
}

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  medicalData: MedicalData | null;
  class: { id: string; grade: number; letter: string };
}

interface AttendanceItem {
  id: string;
  studentId: string;
  date: string;
  status: string;
  student?: StudentItem;
}

export default function MedicalWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [excusedToday, setExcusedToday] = useState<AttendanceItem[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [studentsRes, attendanceRes] = await Promise.all([
          fetch('/api/v1/students'),
          fetch(`/api/v1/attendance?date=${new Date().toISOString().split('T')[0]}&status=excused`),
        ]);

        const studentsData = await studentsRes.json();
        const attendanceData = await attendanceRes.json();

        if (studentsData.success) {
          const withMedical = studentsData.data.filter(
            (s: StudentItem) => s.medicalData && Object.keys(s.medicalData).length > 0,
          );
          setStudents(withMedical);
        }

        if (attendanceData.success) {
          setExcusedToday(attendanceData.data || []);
        }
      } catch {
        console.error('Failed to fetch medical data');
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
      <Group justify="space-between">
        <Group gap="sm">
          <IconMedicalCross size={28} stroke={1.5} />
          <Title order={2}>Медицинский кабинет</Title>
        </Group>
        <Badge
          leftSection={<IconShieldCheck size={14} />}
          variant="light"
          color="orange"
          size="lg"
        >
          Доступ только для медработника и завучей
        </Badge>
      </Group>

      <Paper withBorder p="md" radius="sm">
        <Title order={4} mb="md">
          Ученики с медицинскими данными
        </Title>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Аллергии</Table.Th>
                <Table.Th>Хронические заболевания</Table.Th>
                <Table.Th>Пищевые реакции</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" py="md">
                      Нет учеников с медицинскими данными
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
                    <Table.Td>{s.medicalData?.allergies || '—'}</Table.Td>
                    <Table.Td>{s.medicalData?.chronicDiseases || '—'}</Table.Td>
                    <Table.Td>{s.medicalData?.foodReactions || '—'}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Paper withBorder p="md" radius="sm">
        <Title order={4} mb="md">
          Сегодня обратились (освобождены)
        </Title>
        {excusedToday.length === 0 ? (
          <Text c="dimmed">Нет обращений за сегодня</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ученик</Table.Th>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {excusedToday.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>{a.studentId}</Table.Td>
                  <Table.Td>{new Date(a.date).toLocaleDateString('ru-RU')}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="yellow" size="sm">
                      Освобожден
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
