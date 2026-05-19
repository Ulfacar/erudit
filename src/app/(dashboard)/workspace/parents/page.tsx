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
  TextInput,
  Title,
} from '@mantine/core';
import { IconUsers, IconSearch } from '@tabler/icons-react';

interface ParentItem {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  children: {
    studentId: string;
    relation: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      class: { grade: number; letter: string };
    };
  }[];
}

const RELATION_LABELS: Record<string, string> = {
  mother: 'Мать',
  father: 'Отец',
  guardian: 'Опекун',
  grandmother: 'Бабушка',
  grandfather: 'Дедушка',
};

export default function ParentsWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/v1/parents');
        const data = await res.json();

        if (data.success) {
          setParents(data.data);
        }
      } catch {
        console.error('Failed to fetch parents data');
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

  const filtered = parents.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const parentName = `${p.lastName} ${p.firstName}`.toLowerCase();
    const childNames = p.children
      .map((c) => `${c.student.lastName} ${c.student.firstName}`)
      .join(' ')
      .toLowerCase();
    return parentName.includes(q) || childNames.includes(q);
  });

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconUsers size={28} stroke={1.5} />
        <Title order={2}>Родители</Title>
      </Group>

      <TextInput
        placeholder="Поиск по ФИО родителя или ребенка"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        w={400}
      />

      <Paper withBorder p="md" radius="sm">
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО родителя</Table.Th>
                <Table.Th>Телефон</Table.Th>
                <Table.Th>Ребенок</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Связь</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" py="md">
                      Нет данных о родителях
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.flatMap((p) =>
                  p.children.length === 0
                    ? [
                        <Table.Tr key={p.id}>
                          <Table.Td>
                            {p.lastName} {p.firstName}
                          </Table.Td>
                          <Table.Td>{p.phone || '—'}</Table.Td>
                          <Table.Td>—</Table.Td>
                          <Table.Td>—</Table.Td>
                          <Table.Td>—</Table.Td>
                        </Table.Tr>,
                      ]
                    : p.children.map((child, idx) => (
                        <Table.Tr key={`${p.id}-${child.studentId}`}>
                          {idx === 0 ? (
                            <>
                              <Table.Td rowSpan={p.children.length}>
                                {p.lastName} {p.firstName}
                              </Table.Td>
                              <Table.Td rowSpan={p.children.length}>
                                {p.phone || '—'}
                              </Table.Td>
                            </>
                          ) : null}
                          <Table.Td>
                            {child.student.lastName} {child.student.firstName}
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">
                              {child.student.class.grade}
                              {child.student.class.letter}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {RELATION_LABELS[child.relation] || child.relation}
                          </Table.Td>
                        </Table.Tr>
                      )),
                )
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
