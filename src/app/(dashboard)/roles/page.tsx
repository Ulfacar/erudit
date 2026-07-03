'use client';

import { useEffect, useState } from 'react';
import {
  Badge, Button, Group, Loader, Modal, Paper, PasswordInput, SimpleGrid, Select, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { IconShieldLock, IconPlus, IconUsers } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

interface RoleInfo { role: string; label: string; description: string; userCount: number }

function RolesContent() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/roles');
      const json = await res.json();
      if (json.success) setRoles(json.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createUser() {
    if (!login || !password || !role) { setError('Заполните все поля'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/v1/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, role }),
      });
      const json = await res.json();
      if (json.success) { setOpen(false); setLogin(''); setPassword(''); setRole(null); load(); }
      else setError(json.error?.message || 'Ошибка');
    } catch { setError('Ошибка сети'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <Group justify="center" p="xl"><Loader color="blue" /></Group>;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap={8}>
          <IconShieldLock size={22} color="#7048e8" />
          <Title order={3} c="var(--mantine-color-text)">Роли и доступы</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} color="bilimosBlue" onClick={() => setOpen(true)}>Добавить пользователя</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {roles.map((r) => (
          <Paper key={r.role} style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }} radius="md" p="md">
            <Group justify="space-between" mb={6}>
              <Text fw={600} c="var(--mantine-color-text)">{r.label}</Text>
              <Badge variant="light" color="blue" leftSection={<IconUsers size={12} />}>{r.userCount}</Badge>
            </Group>
            <Text size="sm" c={TEXT_SEC}>{r.description}</Text>
            <Text size="xs" c={TEXT_SEC} mt={8} ff="monospace">{r.role}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Modal opened={open} onClose={() => setOpen(false)} title="Новый пользователь" centered>
        <Stack gap="sm">
          <TextInput label="Логин" required value={login} onChange={(e) => setLogin(e.currentTarget.value)} />
          <PasswordInput label="Пароль" required value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
          <Select label="Роль" required data={roles.map((r) => ({ value: r.role, label: r.label }))} value={role} onChange={setRole} searchable />
          {error && <Text c="red" size="sm">{error}</Text>}
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={createUser} loading={submitting} color="bilimosBlue">Создать</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function RolesPage() {
  return (
    <RoleGate roles={['super_admin']}>
      <RolesContent />
    </RoleGate>
  );
}
