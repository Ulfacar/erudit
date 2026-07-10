'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, Avatar, Badge, Button, Divider, Group, Loader, Modal, Paper, ScrollArea, Select, Stack, Switch, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPlus, IconSearch, IconShieldPlus, IconTrash, IconUsersGroup } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { flattenNavLeaves, SIDEBAR_NAV } from '@/shared/lib/nav-config';

const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

interface StaffUser {
  id: string; login: string; email: string | null; role: string; roleLabel: string;
  isActive: boolean; firstName: string | null; lastName: string | null; position: string | null; photo: string | null;
}

interface ModuleGrant {
  id: string;
  userId: string;
  module: string;
  canRead: boolean;
  canWrite: boolean;
  canApprove: boolean;
  createdAt: string;
}

const MODULE_OPTIONS = flattenNavLeaves(SIDEBAR_NAV).map((item) => ({
  value: item.href,
  label: item.label,
}));

const MODULE_LABELS = new Map(MODULE_OPTIONS.map((item) => [item.value, item.label]));

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

function GrantBadge({ enabled, label, color }: { enabled: boolean; label: string; color: string }) {
  if (!enabled) return null;
  return <Badge size="xs" radius="sm" color={color} variant="light">{label}</Badge>;
}

function ModuleGrantsModal({ user, onClose }: { user: StaffUser | null; onClose: () => void }) {
  const [grants, setGrants] = useState<ModuleGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [module, setModule] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [canApprove, setCanApprove] = useState(false);

  const availableModules = useMemo(() => {
    const used = new Set(grants.map((grant) => grant.module));
    return MODULE_OPTIONS.filter((option) => !used.has(option.value));
  }, [grants]);

  useEffect(() => {
    if (!module && availableModules.length > 0) setModule(availableModules[0].value);
    if (module && !availableModules.some((option) => option.value === module)) {
      setModule(availableModules[0]?.value ?? null);
    }
  }, [availableModules, module]);

  async function loadGrants(userId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/module-grants?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (res.ok && json.success) setGrants(json.data);
      else notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message || 'Не удалось сохранить доступ' });
    } catch {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Не удалось сохранить доступ' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setGrants([]);
      setModule(null);
      return;
    }
    void loadGrants(user.id);
  }, [user]);

  async function addGrant() {
    if (!user || !module) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/module-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, module, canRead, canWrite, canApprove }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCanRead(true);
        setCanWrite(false);
        setCanApprove(false);
        await loadGrants(user.id);
        notifications.show({ color: 'green', title: 'Готово', message: 'Доступ добавлен' });
      } else {
        notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message || 'Не удалось сохранить доступ' });
      }
    } catch {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Не удалось сохранить доступ' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteGrant(id: string) {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/module-grants?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) await loadGrants(user.id);
      else notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message || 'Не удалось сохранить доступ' });
    } catch {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Не удалось сохранить доступ' });
    } finally {
      setSaving(false);
    }
  }

  const displayName = user
    ? (user.lastName || user.firstName ? `${user.lastName ?? ''} ${user.firstName ?? ''}` : user.login)
    : '';

  return (
    <Modal opened={Boolean(user)} onClose={onClose} title={`Доп-обязанности${displayName ? ` — ${displayName}` : ''}`} size="lg" centered>
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" radius="sm">
          Доп-обязанности пока фиксируются, но не меняют доступ.
        </Alert>

        <Stack gap="xs">
          <Text size="sm" fw={600}>Текущие гранты</Text>
          {loading ? (
            <Group justify="center" py="md"><Loader size="sm" /></Group>
          ) : grants.length === 0 ? (
            <Text c={TEXT_SEC} size="sm">Грантов пока нет</Text>
          ) : (
            <Stack gap={8}>
              {grants.map((grant) => (
                <Group key={grant.id} justify="space-between" wrap="nowrap">
                  <Stack gap={4} style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>{MODULE_LABELS.get(grant.module) ?? grant.module}</Text>
                    <Group gap={6}>
                      <GrantBadge enabled={grant.canRead} label="Чтение" color="blue" />
                      <GrantBadge enabled={grant.canWrite} label="Запись" color="green" />
                      <GrantBadge enabled={grant.canApprove} label="Одобрение" color="violet" />
                    </Group>
                  </Stack>
                  <Tooltip label="Удалить грант">
                    <ActionIcon variant="subtle" color="red" onClick={() => void deleteGrant(grant.id)} loading={saving} aria-label="Удалить грант">
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={600}>Добавить модуль</Text>
          <Select
            data={availableModules}
            value={module}
            onChange={setModule}
            placeholder="Выберите модуль"
            searchable
            nothingFoundMessage="Все модули уже добавлены"
          />
          <Group gap="lg">
            <Switch label="Чтение" checked={canRead} onChange={(e) => setCanRead(e.currentTarget.checked)} />
            <Switch label="Запись" checked={canWrite} onChange={(e) => setCanWrite(e.currentTarget.checked)} />
            <Switch label="Одобрение" checked={canApprove} onChange={(e) => setCanApprove(e.currentTarget.checked)} />
          </Group>
          <Group justify="flex-end">
            <Button leftSection={<IconPlus size={16} />} onClick={() => void addGrant()} loading={saving} disabled={!module}>
              Добавить
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Modal>
  );
}

function StaffContent() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [grantUser, setGrantUser] = useState<StaffUser | null>(null);
  const { has } = useRole();
  const canManageGrants = has('super_admin');

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
                  {canManageGrants && <Table.Th style={{ color: TEXT_SEC, fontSize: 12 }}>Доступы</Table.Th>}
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
                    {canManageGrants && (
                      <Table.Td>
                        <Tooltip label="Доп-обязанности">
                          <ActionIcon variant="light" color="blue" onClick={() => setGrantUser(u)} aria-label="Доп-обязанности">
                            <IconShieldPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      <ModuleGrantsModal user={grantUser} onClose={() => setGrantUser(null)} />
    </Stack>
  );
}

export default function StaffPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary', 'hr']}>
      <StaffContent />
    </RoleGate>
  );
}
