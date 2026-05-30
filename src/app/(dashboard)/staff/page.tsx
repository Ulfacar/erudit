'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Group, Loader, Paper, ScrollArea, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconUsersGroup, IconSearch } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

interface StaffUser {
  id: string; login: string; email: string | null; role: string; roleLabel: string;
  isActive: boolean; firstName: string | null; lastName: string | null; position: string | null; photo: string | null;
}

const ROLE_OPTIONS = [
  { value: '', label: 'Все роли' },
  { value: 'super_admin', label: 'Супер-админ' },
  { value: 'analyst', label: 'Аналитик' },
  { value: 'zavuch', label: 'Завуч' },
  { value: 'secretary', label: 'Секретарь' },
  { value: 'teacher', label: 'Педагог' },
  { value: 'curator', label: 'Куратор' },
  { value: 'specialist', label: 'Специалист' },
];

function StaffContent() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/staff');
        const json = await res.json();
        if (json.success) setUsers(json.data);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = `${u.lastName ?? ''} ${u.firstName ?? ''} ${u.login}`.toLowerCase();
        if (!name.includes(s)) return false;
      }
      // показываем только сотрудников (не учеников/родителей)
      return !['student', 'parent'].includes(u.role);
    });
  }, [users, roleFilter, search]);

  return (
    <Stack gap="md">
      <Group gap={8}>
        <IconUsersGroup size={22} color="#1971c2" />
        <Title order={3} c="var(--mantine-color-text)">Персонал школы</Title>
        <Badge variant="light" color="gray" radius="sm">{filtered.length}</Badge>
      </Group>

      <Group>
        <TextInput placeholder="Поиск по имени или логину" leftSection={<IconSearch size={16} />}
          value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={280} />
        <Select data={ROLE_OPTIONS} value={roleFilter} onChange={(v) => setRoleFilter(v ?? '')} w={200} />
      </Group>

      <Paper style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }} radius="sm">
        {loading ? (
          <Group justify="center" p="xl"><Loader color="blue" /></Group>
        ) : filtered.length === 0 ? (
          <Text c={TEXT_SEC} ta="center" p="xl">Никого не найдено</Text>
        ) : (
          <ScrollArea>
            <Table highlightOnHover style={{ minWidth: 600 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: TEXT_SEC, fontSize: 12 }}>Сотрудник</Table.Th>
                  <Table.Th style={{ color: TEXT_SEC, fontSize: 12 }}>Должность</Table.Th>
                  <Table.Th style={{ color: TEXT_SEC, fontSize: 12 }}>Роль</Table.Th>
                  <Table.Th style={{ color: TEXT_SEC, fontSize: 12 }}>Логин</Table.Th>
                  <Table.Th style={{ color: TEXT_SEC, fontSize: 12 }}>Статус</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Group gap={8}>
                        <Avatar src={u.photo} size={28} radius="xl" color="blue">
                          {(u.lastName ?? u.login).charAt(0)}
                        </Avatar>
                        <Text size="sm">{u.lastName || u.firstName ? `${u.lastName ?? ''} ${u.firstName ?? ''}` : u.login}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm" c={TEXT_SEC}>{u.position ?? '—'}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color="indigo" radius="sm">{u.roleLabel}</Badge></Table.Td>
                    <Table.Td><Text size="sm" ff="monospace" c={TEXT_SEC}>{u.login}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="dot" color={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'активен' : 'отключён'}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>
    </Stack>
  );
}

export default function StaffPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <StaffContent />
    </RoleGate>
  );
}
