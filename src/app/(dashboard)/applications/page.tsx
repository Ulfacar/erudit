'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Group, Loader, Paper, ScrollArea, Select, Stack, Table, Text,
  Textarea, TextInput, Title,
} from '@mantine/core';
import { IconFileText, IconCheck, IconX } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';

const SURFACE = '#ffffff';
const BORDER = '#e6e9ee';
const SEC = 'var(--mantine-color-dimmed)';

const TYPES = [
  { value: 'absence', label: 'Записка об отсутствии' },
  { value: 'leave', label: 'Отпроситься' },
  { value: 'other', label: 'Другое' },
];
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'На рассмотрении', color: 'orange' },
  approved: { label: 'Согласовано', color: 'green' },
  rejected: { label: 'Отклонено', color: 'red' },
};

interface App {
  id: string; type: string; studentId: string; studentName: string; className: string;
  reason: string; fromDate: string; toDate: string | null; status: string; reviewNote: string | null;
}

function fmt(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Applications() {
  const { me } = useMe();
  const role = me?.role;
  const isSubmitter = role === 'parent' || role === 'student';
  const [rows, setRows] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // form (submitter)
  const [type, setType] = useState('absence');
  const [childId, setChildId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/applications');
      const json = await res.json();
      if (json.success) setRows(json.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!reason || !fromDate) { setError('Укажите причину и дату'); return; }
    if (role === 'parent' && !childId) { setError('Выберите ребёнка'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/v1/applications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, studentId: childId, reason, fromDate, toDate: toDate || null }),
      });
      const json = await res.json();
      if (json.success) { setReason(''); setFromDate(''); setToDate(''); load(); }
      else setError(json.error?.message || 'Ошибка');
    } catch { setError('Ошибка сети'); }
    finally { setSubmitting(false); }
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/v1/applications/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <Stack gap="md">
      <Group gap={8}>
        <IconFileText size={22} color="#1971c2" />
        <Title order={3} c="var(--mantine-color-text)">Заявления</Title>
      </Group>

      {isSubmitter && (
        <Paper p="md" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <Text fw={600} mb="sm" c="var(--mantine-color-text)">Подать заявление</Text>
          <Stack gap="sm">
            <Group grow>
              <Select label="Тип" data={TYPES} value={type} onChange={(v) => setType(v ?? 'absence')} />
              {role === 'parent' && (
                <Select label="Ребёнок" placeholder="Выберите"
                  data={(me?.children ?? []).map((c) => ({ value: c.studentId, label: `${c.lastName} ${c.firstName}` }))}
                  value={childId} onChange={setChildId} searchable />
              )}
            </Group>
            <Group grow>
              <TextInput label="С даты" type="date" value={fromDate} onChange={(e) => setFromDate(e.currentTarget.value)} />
              <TextInput label="По дату (опц.)" type="date" value={toDate} onChange={(e) => setToDate(e.currentTarget.value)} />
            </Group>
            <Textarea label="Причина" value={reason} onChange={(e) => setReason(e.currentTarget.value)} autosize minRows={2} />
            {error && <Text c="red" size="sm">{error}</Text>}
            <Group justify="flex-end">
              <Button onClick={submit} loading={submitting} color="eruditBlue">Отправить</Button>
            </Group>
          </Stack>
        </Paper>
      )}

      <Paper radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        {loading ? (
          <Group justify="center" p="xl"><Loader color="blue" /></Group>
        ) : rows.length === 0 ? (
          <Text c={SEC} ta="center" p="xl">{isSubmitter ? 'Вы ещё не подавали заявлений' : 'Входящих заявлений нет'}</Text>
        ) : (
          <ScrollArea>
            <Table highlightOnHover style={{ minWidth: 700 }}>
              <Table.Thead>
                <Table.Tr>
                  {!isSubmitter && <Table.Th style={{ color: SEC, fontSize: 12 }}>Ученик</Table.Th>}
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Тип</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Период</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Причина</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Статус</Table.Th>
                  {!isSubmitter && <Table.Th style={{ color: SEC, fontSize: 12, width: 120 }} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((a) => (
                  <Table.Tr key={a.id}>
                    {!isSubmitter && <Table.Td><Text size="sm">{a.studentName} <Text span c={SEC}>{a.className}</Text></Text></Table.Td>}
                    <Table.Td><Text size="sm">{TYPES.find((t) => t.value === a.type)?.label ?? a.type}</Text></Table.Td>
                    <Table.Td><Text size="sm">{fmt(a.fromDate)}{a.toDate ? ` – ${fmt(a.toDate)}` : ''}</Text></Table.Td>
                    <Table.Td><Text size="sm" lineClamp={2}>{a.reason}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color={STATUS[a.status]?.color ?? 'gray'} radius="sm">{STATUS[a.status]?.label ?? a.status}</Badge></Table.Td>
                    {!isSubmitter && (
                      <Table.Td>
                        {a.status === 'pending' && (
                          <Group gap={4} wrap="nowrap">
                            <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={14} />} onClick={() => review(a.id, 'approved')}>Да</Button>
                            <Button size="xs" variant="light" color="red" leftSection={<IconX size={14} />} onClick={() => review(a.id, 'rejected')}>Нет</Button>
                          </Group>
                        )}
                      </Table.Td>
                    )}
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

export default function ApplicationsPage() {
  return (
    <RoleGate>
      <Applications />
    </RoleGate>
  );
}
