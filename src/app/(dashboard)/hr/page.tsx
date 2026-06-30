'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Group, Loader, Modal, Paper, Select, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { IconBriefcase, IconUsers, IconCash, IconBeach, IconPlus, IconFileText } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney } from '@/shared/components/ui/resource-helpers';

const HR_ROLES = ['super_admin', 'analyst', 'zavuch', 'hr', 'chief_accountant'] as const;

function HR() {
  const [tab, setTab] = useState<string | null>('candidates');
  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconBriefcase size={26} color="#2f9e44" /><Title order={2}>Кадры (HR)</Title></Group>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="candidates" leftSection={<IconUsers size={16} />}>Резерв кандидатов</Tabs.Tab>
          <Tabs.Tab value="vacancies" leftSection={<IconBriefcase size={16} />}>Вакансии</Tabs.Tab>
          <Tabs.Tab value="salary" leftSection={<IconCash size={16} />}>Зарплаты</Tabs.Tab>
          <Tabs.Tab value="leave" leftSection={<IconBeach size={16} />}>Отпуска</Tabs.Tab>
          <Tabs.Tab value="contracts" leftSection={<IconFileText size={16} />}>Договоры</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="candidates" pt="md"><Candidates /></Tabs.Panel>

        <Tabs.Panel value="vacancies" pt="md">
          <ResourcePage title="Вакансии" endpoint="/api/v1/hr/vacancies" createLabel="Добавить вакансию" canDelete
            columns={[
              { key: 'title', label: 'Должность' },
              { key: 'department', label: 'Отдел' },
              { key: 'count', label: 'Мест' },
              { key: 'status', label: 'Статус', render: (r) => <Badge color={r.status === 'open' ? 'green' : 'gray'}>{r.status === 'open' ? 'Открыта' : 'Закрыта'}</Badge> },
            ]}
            fields={[
              { name: 'title', label: 'Должность', type: 'text', required: true },
              { name: 'department', label: 'Отдел', type: 'text' },
              { name: 'count', label: 'Мест', type: 'number', defaultValue: 1 },
              { name: 'status', label: 'Статус', type: 'select', options: [{ value: 'open', label: 'Открыта' }, { value: 'closed', label: 'Закрыта' }], defaultValue: 'open' },
            ]} />
        </Tabs.Panel>

        <Tabs.Panel value="salary" pt="md">
          <ResourcePage title="Журнал зарплат" endpoint="/api/v1/hr/salary" createLabel="Начислить" canDelete
            columns={[
              { key: 'staffId', label: 'Сотрудник' },
              { key: 'period', label: 'Период' },
              { key: 'amount', label: 'Оклад', render: (r) => fmtMoney(r.amount) },
              { key: 'bonus', label: 'Премия', render: (r) => fmtMoney(r.bonus) },
              { key: 'paid', label: 'Выплачено', render: (r) => <Badge color={r.paid ? 'green' : 'orange'}>{r.paid ? 'Да' : 'Нет'}</Badge> },
            ]}
            fields={[
              { name: 'staffId', label: 'Сотрудник (ФИО/ID)', type: 'text', required: true },
              { name: 'period', label: 'Период (месяц)', type: 'text', required: true },
              { name: 'amount', label: 'Оклад', type: 'number', required: true },
              { name: 'bonus', label: 'Премия', type: 'number', defaultValue: 0 },
              { name: 'paid', label: 'Выплачено', type: 'switch' },
            ]} />
        </Tabs.Panel>

        <Tabs.Panel value="leave" pt="md">
          <ResourcePage title="Отпуска / больничные" endpoint="/api/v1/hr/leave" createLabel="Оформить" canDelete
            columns={[
              { key: 'staffId', label: 'Сотрудник' },
              { key: 'type', label: 'Тип', render: (r) => ({ vacation: 'Отпуск', sick: 'Больничный', unpaid: 'Без содержания' } as Record<string, string>)[String(r.type)] ?? String(r.type) },
              { key: 'startDate', label: 'С', render: (r) => fmtDate(r.startDate) },
              { key: 'endDate', label: 'По', render: (r) => fmtDate(r.endDate) },
            ]}
            fields={[
              { name: 'staffId', label: 'Сотрудник (ФИО/ID)', type: 'text', required: true },
              { name: 'type', label: 'Тип', type: 'select', options: [{ value: 'vacation', label: 'Отпуск' }, { value: 'sick', label: 'Больничный' }, { value: 'unpaid', label: 'Без содержания' }], defaultValue: 'vacation' },
              { name: 'startDate', label: 'С', type: 'date', required: true },
              { name: 'endDate', label: 'По', type: 'date', required: true },
              { name: 'note', label: 'Примечание', type: 'textarea' },
            ]} />
        </Tabs.Panel>

        <Tabs.Panel value="contracts" pt="md">
          <ResourcePage title="Трудовые договоры" endpoint="/api/v1/hr/staff-contracts" createLabel="Заключить договор" canDelete
            columns={[
              { key: 'staffId', label: 'Сотрудник' },
              { key: 'number', label: '№ договора' },
              { key: 'position', label: 'Должность' },
              { key: 'salary', label: 'Оклад', render: (r) => fmtMoney(r.salary) },
              { key: 'startDate', label: 'С', render: (r) => fmtDate(r.startDate) },
              { key: 'status', label: 'Статус', render: (r) => <Badge color={r.status === 'active' ? 'green' : 'gray'}>{r.status === 'active' ? 'Действует' : 'Завершён'}</Badge> },
            ]}
            fields={[
              { name: 'staffId', label: 'Сотрудник (ФИО/ID)', type: 'text', required: true },
              { name: 'number', label: '№ договора', type: 'text', required: true },
              { name: 'position', label: 'Должность', type: 'text', required: true },
              { name: 'salary', label: 'Оклад', type: 'number', required: true },
              { name: 'startDate', label: 'Дата начала', type: 'date' },
              { name: 'endDate', label: 'Дата окончания', type: 'date' },
              { name: 'status', label: 'Статус', type: 'select', options: [{ value: 'active', label: 'Действует' }, { value: 'completed', label: 'Завершён' }], defaultValue: 'active' },
            ]} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

const CAND_STATUS: Record<string, { label: string; color: string }> = {
  reserve: { label: 'Резерв', color: 'blue' }, interview: { label: 'Собеседование', color: 'orange' },
  offer: { label: 'Оффер', color: 'grape' }, hired: { label: 'Принят', color: 'green' }, rejected: { label: 'Отказ', color: 'red' },
};
const NEXT: Record<string, string> = { reserve: 'interview', interview: 'offer', offer: 'hired' };

interface Candidate {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  position: string;
  status: string;
  note: string | null;
  resumeKey: string | null;
}

function Candidates() {
  const [list, setList] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ fullName: '', phone: '', position: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/hr/candidates').then((r) => r.json()).catch(() => ({ data: [] }));
    setList(j.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!f.fullName.trim() || !f.position.trim()) return;
    setSaving(true);
    await fetch('/api/v1/hr/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setSaving(false); setOpen(false); setF({ fullName: '', phone: '', position: '', note: '' }); load();
  }
  async function move(id: string, status: string) {
    await fetch(`/api/v1/hr/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text c="dimmed" size="sm">Главная задача HR — копить резерв резюме на будущее: 10 откликнулись → храним → зовём на собеседование.</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>В резерв</Button>
      </Group>
      <Paper withBorder p="md" radius="md">
        {loading ? <Group justify="center" p="xl"><Loader /></Group>
          : list.length === 0 ? <Text c="dimmed" ta="center" py="xl">Резерв пуст.</Text>
          : (
            <Table highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Кандидат</Table.Th><Table.Th>Должность</Table.Th><Table.Th>Контакты</Table.Th><Table.Th>Резюме</Table.Th><Table.Th>Статус</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {list.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={600} size="sm">{c.fullName}</Text>
                        {c.note && <Text c="dimmed" size="xs">{c.note}</Text>}
                      </Stack>
                    </Table.Td>
                    <Table.Td>{c.position}</Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">{c.phone ?? '—'}</Text>
                        {c.email && <Text c="dimmed" size="xs">{c.email}</Text>}
                      </Stack>
                    </Table.Td>
                    <Table.Td>{c.resumeKey ? <Badge variant="light" color="teal">MinIO</Badge> : '—'}</Table.Td>
                    <Table.Td><Badge color={CAND_STATUS[c.status]?.color}>{CAND_STATUS[c.status]?.label ?? c.status}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        {NEXT[c.status] && <Button size="compact-xs" variant="light" onClick={() => move(c.id, NEXT[c.status])}>→ {CAND_STATUS[NEXT[c.status]].label}</Button>}
                        {c.status !== 'hired' && c.status !== 'rejected' && <Button size="compact-xs" variant="subtle" color="red" onClick={() => move(c.id, 'rejected')}>Отказ</Button>}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
      </Paper>
      <Modal opened={open} onClose={() => setOpen(false)} title="Кандидат в резерв" centered>
        <Stack gap="sm">
          <TextInput label="ФИО" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.currentTarget.value })} />
          <TextInput label="Желаемая должность" required value={f.position} onChange={(e) => setF({ ...f, position: e.currentTarget.value })} />
          <TextInput label="Телефон" value={f.phone} onChange={(e) => setF({ ...f, phone: e.currentTarget.value })} />
          <TextInput label="Заметка" value={f.note} onChange={(e) => setF({ ...f, note: e.currentTarget.value })} />
          <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button><Button onClick={add} loading={saving}>В резерв</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function HRPage() {
  return (
    <RoleGate roles={[...HR_ROLES]}>
      <HR />
    </RoleGate>
  );
}
