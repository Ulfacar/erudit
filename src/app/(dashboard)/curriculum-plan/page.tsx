'use client';

import { useEffect, useState } from 'react';
import { Badge, Group, Loader, Paper, ScrollArea, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { IconBook } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

interface ClassRow { id: string; grade: number; letter: string }
interface SubjectCol { id: string; name: string; color?: string | null }
type Status = 'matched' | 'overload' | 'partial' | 'missing' | 'idle';
interface Cell { declared: number; actual: number; status: Status }
interface Matrix { classes: ClassRow[]; subjects: SubjectCol[]; matrix: Record<string, Record<string, Cell>>; totals: Record<string, { declared: number; actual: number }> }

const STATUS_COLOR: Record<Status, string> = {
  matched: '#2f9e44',
  overload: '#e8590c',
  partial: '#f59f00',
  missing: '#e03131',
  idle: 'transparent',
};
const STATUS_LABEL: Record<Status, string> = {
  matched: 'План и расписание совпадают',
  overload: 'Часов в расписании больше плана',
  partial: 'Расписание не покрывает план',
  missing: 'В расписании есть, в плане нет',
  idle: 'Нет данных',
};

function CurriculumContent() {
  const [data, setData] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/curriculum-plan');
        const json = await res.json();
        if (json.success) setData(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Group justify="center" p="xl"><Loader color="blue" /></Group>;
  if (!data) return <Text c={TEXT_SEC}>Не удалось загрузить учебный план</Text>;

  return (
    <Stack gap="md">
      <Group gap={8}>
        <IconBook size={22} color="#4263eb" />
        <Title order={3} c="var(--mantine-color-text)">Учебный план (КТП): план vs расписание</Title>
      </Group>
      <Group gap="sm">
        {(['matched', 'partial', 'overload', 'missing'] as Status[]).map((s) => (
          <Group key={s} gap={4}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLOR[s] }} />
            <Text size="xs" c={TEXT_SEC}>{STATUS_LABEL[s]}</Text>
          </Group>
        ))}
      </Group>

      <Paper style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }} radius="sm">
        <ScrollArea>
          <Table withColumnBorders style={{ minWidth: 900 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ position: 'sticky', left: 0, background: SURFACE, zIndex: 1, minWidth: 70 }}>Класс</Table.Th>
                {data.subjects.map((s) => (
                  <Table.Th key={s.id} style={{ fontSize: 11, textAlign: 'center', minWidth: 56 }}>
                    <Tooltip label={s.name}><span>{s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name}</span></Tooltip>
                  </Table.Th>
                ))}
                <Table.Th style={{ fontSize: 11, textAlign: 'center' }}>Σ</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.classes.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td style={{ position: 'sticky', left: 0, background: SURFACE, fontWeight: 600 }}>{c.grade}{c.letter}</Table.Td>
                  {data.subjects.map((s) => {
                    const cell = data.matrix[c.id]?.[s.id];
                    if (!cell || cell.status === 'idle') return <Table.Td key={s.id} style={{ textAlign: 'center', color: TEXT_SEC }}>·</Table.Td>;
                    return (
                      <Table.Td key={s.id} style={{ textAlign: 'center', padding: '4px 6px' }}>
                        <Tooltip label={`${STATUS_LABEL[cell.status]}: план ${cell.declared}ч / факт ${cell.actual}ч`}>
                          <Badge variant="light" radius="sm" size="sm"
                            styles={{ root: { background: `${STATUS_COLOR[cell.status]}22`, color: STATUS_COLOR[cell.status] } }}>
                            {cell.actual}/{cell.declared}
                          </Badge>
                        </Tooltip>
                      </Table.Td>
                    );
                  })}
                  <Table.Td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {data.totals[c.id]?.actual ?? 0}/{data.totals[c.id]?.declared ?? 0}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
      <Text size="xs" c={TEXT_SEC}>Ячейка: фактических часов в расписании / запланированных по нагрузке.</Text>
    </Stack>
  );
}

export default function CurriculumPlanPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']}>
      <CurriculumContent />
    </RoleGate>
  );
}
