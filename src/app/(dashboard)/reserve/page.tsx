'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Group, Loader, Modal, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPlus, IconUsersGroup, IconX } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Cls {
  id: string;
  grade: number;
  letter: string;
  capacity?: number | null;
  studentCount?: number;
}

interface Entry {
  id: string;
  childName: string;
  parentName: string | null;
  parentPhone: string | null;
  dateOfBirth: string | null;
  desiredYear: string | null;
  position: number;
  status: string;
  leadId: string | null;
  note: string | null;
}

function Reserve() {
  const [classes, setClasses] = useState<Cls[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCls, setOpenCls] = useState<Cls | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/classes').then((r) => r.json()).catch(() => ({ data: [] }));
    setClasses((j.data ?? []).sort((a: Cls, b: Cls) => a.grade - b.grade || a.letter.localeCompare(b.letter)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs">
        <IconUsersGroup size={26} color="#1971c2" />
        <Title order={2}>Очередь / резерв в классы</Title>
      </Group>
      <Text c="dimmed" size="sm">
        Лист ожидания по классам. Запись из очереди можно передать в приемную как CRM-лид.
      </Text>
      {loading ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : (
        <Stack gap="sm">
          {classes.map((c) => (
            <Card key={c.id} withBorder radius="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text fw={600}>{c.grade}{c.letter}</Text>
                  <Badge variant="light">учеников: {c.studentCount ?? 0}{c.capacity ? ` / ${c.capacity}` : ''}</Badge>
                </Group>
                <Button size="xs" variant="light" onClick={() => setOpenCls(c)}>Очередь</Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {openCls && <QueueModal cls={openCls} onClose={() => setOpenCls(null)} />}
    </Stack>
  );
}

function QueueModal({ cls, onClose }: { cls: Cls; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parent, setParent] = useState('');
  const [dob, setDob] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/v1/class-reserve?classId=${cls.id}&status=all`).then((r) => r.json()).catch(() => ({ data: [] }));
    setEntries(j.data ?? []);
    setLoading(false);
  }, [cls.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!name.trim()) return;
    const res = await fetch('/api/v1/class-reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: cls.id, childName: name, parentName: parent, parentPhone: phone, dateOfBirth: dob || null, desiredYear: year }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      notifications.show({ color: 'green', title: 'Добавлено', message: 'Ребенок добавлен в очередь' });
      setName('');
      setPhone('');
      setParent('');
      setDob('');
      setYear('');
      load();
    } else {
      notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message ?? 'Не удалось добавить запись' });
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch('/api/v1/class-reserve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      notifications.show({ color: status === 'cancelled' ? 'orange' : 'green', title: 'Статус обновлен', message: 'Запись очереди обновлена' });
      load();
    } else {
      notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message ?? 'Не удалось обновить запись' });
    }
  }

  async function enroll(id: string) {
    const res = await fetch(`/api/v1/class-reserve/${id}/enroll`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      notifications.show({ color: 'green', title: 'Заявка создана', message: `Lead: ${json.data.leadId}` });
    } else {
      notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message ?? 'Не удалось создать заявку' });
    }
    load();
  }

  return (
    <Modal opened onClose={onClose} title={`Очередь в ${cls.grade}${cls.letter}`} centered size="xl">
      <Stack gap="md">
        <Stack gap="xs">
          <Group align="flex-end" gap="xs">
            <TextInput style={{ flex: 1 }} label="ФИО ребенка" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <TextInput label="Дата рождения" type="date" value={dob} onChange={(e) => setDob(e.currentTarget.value)} />
            <TextInput label="Год поступления" placeholder="2027-2028" w={130} value={year} onChange={(e) => setYear(e.currentTarget.value)} />
          </Group>
          <Group align="flex-end" gap="xs">
            <TextInput style={{ flex: 1 }} label="ФИО родителя" value={parent} onChange={(e) => setParent(e.currentTarget.value)} />
            <TextInput label="Телефон" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            <Button leftSection={<IconPlus size={16} />} onClick={add}>В очередь</Button>
          </Group>
        </Stack>

        {loading ? (
          <Group justify="center"><Loader size="sm" /></Group>
        ) : entries.length === 0 ? (
          <Text c="dimmed">Очередь пуста.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>ФИО ребенка</Table.Th>
                <Table.Th>Дата рожд.</Table.Th>
                <Table.Th>Год</Table.Th>
                <Table.Th>Родитель</Table.Th>
                <Table.Th>Телефон</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{e.position}</Table.Td>
                  <Table.Td fw={500}>{e.childName}</Table.Td>
                  <Table.Td>{e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString('ru-RU') : '—'}</Table.Td>
                  <Table.Td>{e.desiredYear ?? '—'}</Table.Td>
                  <Table.Td>{e.parentName ?? '—'}</Table.Td>
                  <Table.Td>{e.parentPhone ?? '—'}</Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Badge size="xs" color={e.status === 'enrolled' ? 'green' : e.status === 'cancelled' ? 'red' : 'gray'} variant="light">{e.status}</Badge>
                      {e.leadId && <Text size="xs" c="dimmed">Lead: {e.leadId}</Text>}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {e.status === 'waiting' && (
                        <>
                          <Button size="compact-xs" variant="light" color="green" leftSection={<IconCheck size={12} />} onClick={() => enroll(e.id)}>В приемную</Button>
                          <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconX size={12} />} onClick={() => setStatus(e.id, 'cancelled')}>Снять</Button>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  );
}

export default function ReservePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Reserve />
    </RoleGate>
  );
}
