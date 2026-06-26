'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Drawer, Group, Loader, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowBigUpLines, IconAlertTriangle, IconCheck, IconUsers } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Move { from: string; to: string; students: number; targetExists: boolean }
interface Analysis { moves: Move[]; graduates: number; promoted: number }

// ── Массовый перевод (как было) ──
function BulkTransition() {
  const [year, setYear] = useState('2027–2028');
  const [renew, setRenew] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<{ graduated: number; promoted: number; renewed: number; createdClasses: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function run(mode: 'analyze' | 'apply') {
    setBusy(true);
    const res = await fetch('/api/v1/operations/transition', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, year, renewContracts: renew }),
    });
    const j = await res.json();
    setBusy(false);
    if (!j.success) return;
    if (mode === 'analyze') { setAnalysis(j.data); setResult(null); }
    else { setResult(j.data); setAnalysis(null); setConfirm(false); }
  }

  return (
    <Stack gap="lg">
      <Text c="dimmed" size="sm">Массовый перевод: ученики поднимаются по лестнице (6В→7В…), последний класс → выпуск, договоры продлеваются. Сначала «Анализировать», потом «Применить».</Text>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="md">
          <TextInput label="Новый учебный год" value={year} onChange={(e) => setYear(e.currentTarget.value)} w={200} />
          <Checkbox label="Продлить договоры" checked={renew} onChange={(e) => setRenew(e.currentTarget.checked)} />
          <Button variant="light" loading={busy} onClick={() => run('analyze')}>Анализировать</Button>
        </Group>
      </Paper>

      {analysis && (
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={5}>Предпросмотр</Title>
            <Group gap="xs">
              <Badge color="blue" variant="light">К переводу: {analysis.promoted}</Badge>
              <Badge color="teal" variant="light">Выпуск: {analysis.graduates}</Badge>
            </Group>
          </Group>
          <Table>
            <Table.Thead><Table.Tr><Table.Th>Из класса</Table.Th><Table.Th>В класс</Table.Th><Table.Th>Учеников</Table.Th><Table.Th>Целевой класс</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {analysis.moves.map((m, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{m.from}</Table.Td>
                  <Table.Td><b>{m.to}</b></Table.Td>
                  <Table.Td>{m.students}</Table.Td>
                  <Table.Td>{m.to === 'Выпуск' ? '—' : m.targetExists ? <Badge color="green" variant="light">есть</Badge> : <Badge color="orange" variant="light">создастся</Badge>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {!confirm ? (
            <Button color="orange" mt="md" leftSection={<IconAlertTriangle size={16} />} onClick={() => setConfirm(true)}>Применить перевод года…</Button>
          ) : (
            <Alert color="red" mt="md" title="Подтверждение" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" mb="xs">Операция массово изменит классы учеников. Откатить нельзя автоматически.</Text>
              <Group>
                <Button color="red" loading={busy} onClick={() => run('apply')}>Да, выполнить</Button>
                <Button variant="subtle" color="gray" onClick={() => setConfirm(false)}>Отмена</Button>
              </Group>
            </Alert>
          )}
        </Paper>
      )}

      {result && (
        <Alert color="green" title="Перевод года выполнен" icon={<IconCheck size={16} />}>
          Переведено: <b>{result.promoted}</b> · выпущено: <b>{result.graduated}</b> · продлено договоров: <b>{result.renewed}</b> · создано классов: <b>{result.createdClasses}</b>
        </Alert>
      )}
    </Stack>
  );
}

// ── Выборочный перевод по классам ──
interface Cls { id: string; grade: number; letter: string; capacity: number | null; studentCount: number; branchId: string | null }
interface Stud { id: string; firstName: string; lastName: string; middleName: string | null }

function SelectiveTransition() {
  const [classes, setClasses] = useState<Cls[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('2027–2028');
  const [openCls, setOpenCls] = useState<Cls | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/classes').then((r) => r.json()).catch(() => ({ data: [] }));
    const list: Cls[] = (j.data ?? []).map((c: Cls) => ({ id: c.id, grade: c.grade, letter: c.letter, capacity: c.capacity ?? null, studentCount: c.studentCount ?? 0, branchId: c.branchId ?? null }));
    setClasses(list.sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Stack gap="lg">
      <Text c="dimmed" size="sm">Выберите класс → отметьте учеников → задайте целевой класс на след. год и продлите договоры. Невыбранные останутся в классе (отчислить можно в разделе «Отчисления»).</Text>
      <TextInput label="Новый учебный год" value={year} onChange={(e) => setYear(e.currentTarget.value)} w={200} />
      {loading ? <Group justify="center" p="xl"><Loader /></Group> : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
          {classes.map((c) => {
            const hasRoom = c.capacity != null && c.studentCount < c.capacity;
            return (
              <Card key={c.id} withBorder radius="md" padding="md" style={{ cursor: 'pointer' }} onClick={() => setOpenCls(c)}>
                <Group justify="space-between" mb={4}>
                  <Text fw={700} size="lg">{c.grade}{c.letter}</Text>
                  <Badge color="blue" variant="light" leftSection={<IconUsers size={11} />}>{c.studentCount}{c.capacity != null ? ` / ${c.capacity}` : ''}</Badge>
                </Group>
                {hasRoom && <Badge color="green" variant="light" size="sm">есть места</Badge>}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
      {openCls && (
        <PromoteDrawer
          cls={openCls}
          classes={classes}
          year={year}
          onClose={() => setOpenCls(null)}
          onDone={() => { setOpenCls(null); load(); }}
        />
      )}
    </Stack>
  );
}

const NEW_TARGET = '__new__';

function PromoteDrawer({ cls, classes, year, onClose, onDone }: { cls: Cls; classes: Cls[]; year: string; onClose: () => void; onDone: () => void }) {
  const [students, setStudents] = useState<Stud[] | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [renew, setRenew] = useState(true);
  const [newAmount, setNewAmount] = useState<number | string>('');
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // целевой класс по умолчанию: след. ступень, та же буква/филиал → существующий или «создать»
  const defaultExisting = useMemo(
    () => classes.find((t) => t.grade === cls.grade + 1 && t.letter === cls.letter && t.branchId === cls.branchId),
    [classes, cls],
  );

  useEffect(() => {
    setStudents(null);
    fetch(`/api/v1/students?classId=${cls.id}`).then((r) => r.json()).then((j) => {
      const list: Stud[] = j.data ?? [];
      setStudents(list);
      setChecked(list.map((s) => s.id));
    }).catch(() => setStudents([]));
    setTarget(defaultExisting ? defaultExisting.id : NEW_TARGET);
  }, [cls.id, defaultExisting]);

  const targetData = useMemo(() => {
    const opts = classes
      .filter((c) => c.id !== cls.id)
      .map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }));
    return [{ value: NEW_TARGET, label: `Создать ${cls.grade + 1}${cls.letter}` }, ...opts];
  }, [classes, cls]);

  async function submit() {
    if (checked.length === 0) { notifications.show({ color: 'orange', message: 'Не выбраны ученики' }); return; }
    setBusy(true);
    const payload: Record<string, unknown> = {
      studentIds: checked, renewContracts: renew, year,
      newBaseAmount: newAmount === '' ? null : Number(newAmount),
    };
    if (target === NEW_TARGET) payload.createTarget = { grade: cls.grade + 1, letter: cls.letter, branchId: cls.branchId };
    else payload.targetClassId = target;

    const res = await fetch('/api/v1/operations/promote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json();
    setBusy(false);
    if (!j.success) { notifications.show({ color: 'red', title: 'Ошибка', message: j.error?.message ?? 'Не удалось перевести' }); return; }
    notifications.show({ color: 'green', title: 'Готово', message: `Переведено: ${j.data.moved}${renew ? ` · продлено договоров: ${j.data.renewed}` : ''}` });
    onDone();
  }

  const allChecked = !!students && checked.length === students.length && students.length > 0;

  return (
    <Drawer opened onClose={onClose} position="right" size="lg" title={`Перевод класса ${cls.grade}${cls.letter}`} padding="lg">
      {students === null ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : (
        <Stack gap="md">
          <Select label="Целевой класс (след. год)" data={targetData} value={target} onChange={(v) => setTarget(v ?? NEW_TARGET)} />
          <Checkbox label="Продлить договоры выбранным" checked={renew} onChange={(e) => setRenew(e.currentTarget.checked)} />
          {renew && (
            <NumberInput label="Новая стоимость (сом)" placeholder="как в прежнем договоре" value={newAmount} onChange={setNewAmount} min={0} thousandSeparator=" " />
          )}

          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">Ученики ({checked.length} из {students.length})</Text>
            <Button size="compact-xs" variant="subtle" onClick={() => setChecked(allChecked ? [] : students.map((s) => s.id))}>
              {allChecked ? 'Снять все' : 'Выбрать все'}
            </Button>
          </Group>
          {students.length === 0 ? (
            <Text c="dimmed" size="sm">В классе нет активных учеников.</Text>
          ) : (
            <Checkbox.Group value={checked} onChange={setChecked}>
              <Stack gap={6}>
                {students.map((s) => (
                  <Checkbox key={s.id} value={s.id} label={`${s.lastName} ${s.firstName}${s.middleName ? ' ' + s.middleName : ''}`} />
                ))}
              </Stack>
            </Checkbox.Group>
          )}

          <Button loading={busy} disabled={checked.length === 0} leftSection={<IconArrowBigUpLines size={16} />} onClick={submit}>
            Перевести + продлить ({checked.length})
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}

function TransitionPageInner() {
  const [tab, setTab] = useState('selective');
  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconArrowBigUpLines size={26} color="#1971c2" /><Title order={2}>Перевод учебного года</Title></Group>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        data={[{ value: 'selective', label: 'По классам' }, { value: 'bulk', label: 'Массово' }]}
      />
      {tab === 'selective' ? <SelectiveTransition /> : <BulkTransition />}
    </Stack>
  );
}

export default function TransitionPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <TransitionPageInner />
    </RoleGate>
  );
}
