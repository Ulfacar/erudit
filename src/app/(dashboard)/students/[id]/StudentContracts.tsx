'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ActionIcon, Badge, Button, Checkbox, Grid, Group, Loader, Menu, Modal,
  NumberInput, Paper, Progress, Select, Stack, Table, Tabs, Text, TextInput, Title,
} from '@mantine/core';
import {
  IconArrowForward, IconCalendarEvent, IconCash, IconDots, IconPlus, IconPrinter, IconRefresh, IconWallet,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';
import { printContract } from '@/shared/lib/contract/print-contract';
import { computePenalty } from '@/shared/lib/finance/penalty';

interface Contract {
  id: string; number: string; year: string; baseAmount: number; discountPct: number; discountNote: string | null;
  amount: number; prepaymentPct: number; scheduleType: string; scheduleMonths: number; paymentDay: number;
  status: string; startDate: string | null; representative: Record<string, string> | null; requisites: Record<string, string> | null; createdAt: string;
}
interface Invoice {
  id: string; title: string; period: string | null; amount: number; status: string; dueDate: string | null;
  payments: { amount: number; verified: boolean }[];
}

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'gray' }, active: { label: 'Active', color: 'green' },
  completed: { label: 'Завершён', color: 'blue' }, cancelled: { label: 'Расторгнут', color: 'red' },
};
const INV_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидается', color: 'gray' }, partial: { label: 'Частично', color: 'yellow' },
  paid: { label: 'Оплачено', color: 'green' }, cancelled: { label: 'Отменён', color: 'red' },
  overdue: { label: 'Просрочено', color: 'red' },
};
const isOverdue = (inv: Invoice) =>
  inv.status !== 'paid' && inv.status !== 'cancelled' && !!inv.dueDate &&
  new Date(inv.dueDate) < new Date() && inv.amount - paidOf(inv) > 0;
const dispStatus = (inv: Invoice) => (isOverdue(inv) ? 'overdue' : inv.status);
const SCHEDULE_LABEL: Record<string, string> = { monthly: 'Ежемесячно', quarterly: 'По триместрам', yearly: 'За год' };

const som = (n: number) => `${n.toLocaleString('ru-RU')} сом`;
const paidOf = (inv: Invoice) => inv.payments.reduce((s, p) => s + (p.verified ? p.amount : 0), 0);

export function StudentContracts({ studentId, studentName, className }: { studentId: string; studentName: string; className?: string }) {
  const { has } = useRole();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInv, setLoadingInv] = useState(false);
  const [open, setOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [payoffOpen, setPayoffOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [carryTarget, setCarryTarget] = useState<{ invoice: Invoice; mode: 'next' | 'spread' } | null>(null);

  const canCreate = has('super_admin', 'analyst', 'zavuch', 'secretary');
  const canPay = has('super_admin', 'analyst', 'zavuch', 'accountant', 'call_center', 'secretary');
  const canCarry = has('super_admin', 'analyst', 'zavuch', 'accountant', 'secretary');
  const canPayoff = has('super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager');

  const loadContracts = useCallback(async () => {
    const j = await fetch(`/api/v1/contracts?studentId=${studentId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    const list: Contract[] = j.data ?? [];
    setContracts(list);
    setActiveId((prev) => prev && list.some((c) => c.id === prev) ? prev : (list.find((c) => c.status === 'active')?.id ?? list[0]?.id ?? null));
    setLoading(false);
  }, [studentId]);
  useEffect(() => { loadContracts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const loadInvoices = useCallback(async (contractId: string) => {
    const j = await fetch(`/api/v1/fee-invoices?contractId=${contractId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setInvoices(j.data ?? []);
    setLoadingInv(false);
  }, []);
  useEffect(() => { if (activeId) loadInvoices(activeId); }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const active = contracts.find((c) => c.id === activeId) ?? null;

  // Баланс по выбранному договору
  const total = active?.amount ?? 0;
  const paid = invoices.reduce((s, inv) => s + paidOf(inv), 0);
  const remaining = Math.max(0, total - paid);
  const advance = Math.max(0, paid - total);
  const progress = total > 0 ? Math.round((paid / total) * 100) : 0;
  const nextDue = invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={4}>Договор и платежи</Title>
          <Text size="sm" c="dimmed">{studentName}{className ? ` · ${className}` : ''}</Text>
        </div>
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>Новый договор</Button>}
      </Group>

      {loading ? <Group justify="center" p="xl"><Loader /></Group>
        : contracts.length === 0 ? <Text c="dimmed">Договоров пока нет.</Text>
        : (
          <>
            {contracts.length > 1 && (
              <Tabs value={activeId} onChange={setActiveId}>
                <Tabs.List>
                  {contracts.map((c) => (
                    <Tabs.Tab key={c.id} value={c.id}>{c.year} · №{c.number}</Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
            )}

            {active && (
              <Grid gutter="md">
                {/* Карточка договора */}
                <Grid.Col span={{ base: 12, md: 8 }}>
                  <Paper withBorder radius="md" p="lg" h="100%">
                    <Group justify="space-between" mb="md">
                      <Group gap="xs">
                        <Title order={3}>Договор #{active.number}</Title>
                        <Badge color={STATUS[active.status]?.color}>{STATUS[active.status]?.label ?? active.status}</Badge>
                      </Group>
                      <Group gap="xs">
                        {canCreate && (
                          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => setRenewOpen(true)}>Продлить договор</Button>
                        )}
                        <Button size="xs" variant="default" leftSection={<IconPrinter size={14} />}
                          onClick={() => printContract(active, studentName, className, {
                            installments: invoices.map((inv) => ({
                              date: inv.dueDate,
                              amount: inv.amount,
                              note: /предопл|взнос|долг/i.test(inv.title) ? inv.title : '',
                            })),
                          })}>Скачать PDF</Button>
                      </Group>
                    </Group>
                    {active.startDate && <Text size="sm" c="dimmed" mb="md">Начало: {fmtDate(active.startDate)}</Text>}
                    <Grid>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed" tt="uppercase">Базовая цена</Text>
                        <Text fw={600}>{som(active.baseAmount)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed" tt="uppercase">Скидка</Text>
                        <Text fw={600} c="teal">{active.discountPct}%</Text>
                        {active.discountNote && <Text size="xs" c="dimmed">{active.discountNote}</Text>}
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed" tt="uppercase">Итого к оплате</Text>
                        <Text fw={700} c="blue">{som(active.amount)}</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <Text size="xs" c="dimmed" tt="uppercase">Режим оплаты</Text>
                        <Text fw={600}>{SCHEDULE_LABEL[active.scheduleType] ?? active.scheduleType}</Text>
                      </Grid.Col>
                    </Grid>
                  </Paper>
                </Grid.Col>

                {/* Карточка баланса */}
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper withBorder radius="md" p="lg" h="100%">
                    <Group gap={6} mb="sm"><IconWallet size={18} color="#1971c2" /><Text fw={600} tt="uppercase" size="sm">Баланс</Text></Group>
                    <Text size="xs" c="dimmed">Оплачено</Text>
                    <Text fw={700} size="xl">{som(paid)} <Text span size="sm" c="dimmed">из {som(total)}</Text></Text>
                    <Text size="sm" mt={4}>Остаток: <Text span fw={600}>{som(remaining)}</Text></Text>
                    {nextDue && (
                      <Paper withBorder radius="sm" p="xs" mt="sm">
                        <Group justify="space-between"><Group gap={6}><IconCalendarEvent size={15} /><Text size="sm">Платёж</Text></Group><Text size="sm" fw={500}>{fmtDate(nextDue.dueDate!)}</Text></Group>
                      </Paper>
                    )}
                    <Paper bg="rgba(64,192,87,0.08)" radius="sm" p="xs" mt="xs">
                      <Group justify="space-between"><Text size="sm" c="teal">Аванс ученика</Text><Text size="sm" fw={600} c="teal">{som(advance)}</Text></Group>
                    </Paper>
                    <Group justify="space-between" mt="sm" mb={4}><Text size="xs" c="dimmed" tt="uppercase">Прогресс</Text><Text size="xs" fw={600}>{progress}%</Text></Group>
                    <Progress value={progress} color="blue" radius="xl" />
                    {canPayoff && remaining > 0 && (
                      <Button mt="sm" fullWidth variant="light" color="green" leftSection={<IconCash size={16} />} onClick={() => setPayoffOpen(true)}>
                        Погасить остаток
                      </Button>
                    )}
                  </Paper>
                </Grid.Col>

                {/* График платежей */}
                <Grid.Col span={12}>
                  <Paper withBorder radius="md" p="md">
                    <Title order={5} mb="sm">График платежей</Title>
                    {loadingInv ? <Group justify="center" p="md"><Loader size="sm" /></Group>
                      : invoices.length === 0 ? <Text c="dimmed" size="sm">Счёта по этому договору не сгенерированы.</Text>
                      : (
                        <Table.ScrollContainer minWidth={680}>
                          <Table verticalSpacing="sm">
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th w={36}>#</Table.Th>
                                <Table.Th>Назначение</Table.Th><Table.Th>Срок оплаты</Table.Th>
                                <Table.Th ta="right">Сумма</Table.Th><Table.Th ta="right">Оплачено</Table.Th>
                                <Table.Th ta="right">Остаток</Table.Th><Table.Th>Статус</Table.Th><Table.Th w={48}></Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {invoices.map((inv, i) => {
                                const p = paidOf(inv);
                                const rem = Math.max(0, inv.amount - p);
                                return (
                                  <Table.Tr key={inv.id}>
                                    <Table.Td><Text c="dimmed" size="sm">{i + 1}</Text></Table.Td>
                                    <Table.Td>{inv.title}</Table.Td>
                                    <Table.Td>{inv.dueDate ? fmtDate(inv.dueDate) : '—'}</Table.Td>
                                    <Table.Td ta="right"><Text fw={600}>{som(inv.amount)}</Text></Table.Td>
                                    <Table.Td ta="right"><Text c={p > 0 ? 'teal' : 'dimmed'}>{som(p)}</Text></Table.Td>
                                    <Table.Td ta="right"><Text c={rem > 0 ? 'blue' : 'dimmed'} fw={500}>{som(rem)}</Text></Table.Td>
                                    <Table.Td><Badge variant="light" color={INV_STATUS[dispStatus(inv)]?.color}>{INV_STATUS[dispStatus(inv)]?.label ?? inv.status}</Badge></Table.Td>
                                    <Table.Td>
                                      {rem > 0 && inv.status !== 'cancelled' && (canPay || canCarry) && (
                                        <Menu position="bottom-end" withinPortal>
                                          <Menu.Target><ActionIcon variant="subtle" color="gray"><IconDots size={16} /></ActionIcon></Menu.Target>
                                          <Menu.Dropdown>
                                            {canPay && <Menu.Item leftSection={<IconCash size={14} />} onClick={() => setPayTarget(inv)}>Принять оплату</Menu.Item>}
                                            {canCarry && (
                                              <>
                                                <Menu.Divider />
                                                <Menu.Label>Перенести остаток</Menu.Label>
                                                <Menu.Item leftSection={<IconArrowForward size={14} />} onClick={() => setCarryTarget({ invoice: inv, mode: 'next' })}>На следующий месяц</Menu.Item>
                                                <Menu.Item leftSection={<IconArrowForward size={14} />} onClick={() => setCarryTarget({ invoice: inv, mode: 'spread' })}>Распределить по графику</Menu.Item>
                                              </>
                                            )}
                                          </Menu.Dropdown>
                                        </Menu>
                                      )}
                                    </Table.Td>
                                  </Table.Tr>
                                );
                              })}
                            </Table.Tbody>
                          </Table>
                        </Table.ScrollContainer>
                      )}
                  </Paper>
                </Grid.Col>
              </Grid>
            )}
          </>
        )}

      {open && <ContractModal studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); loadContracts(); }} />}
      {renewOpen && <ContractModal studentId={studentId} renew carriedDebt={remaining} onClose={() => setRenewOpen(false)} onDone={() => { setRenewOpen(false); loadContracts(); }} />}
      {payTarget && (
        <PaymentModal
          invoice={payTarget}
          onClose={() => setPayTarget(null)}
          onDone={() => { setPayTarget(null); if (activeId) loadInvoices(activeId); }}
        />
      )}
      {payoffOpen && active && (
        <PayoffModal
          contract={active}
          invoices={invoices}
          onClose={() => setPayoffOpen(false)}
          onDone={() => { setPayoffOpen(false); if (activeId) loadInvoices(activeId); }}
        />
      )}
      {carryTarget && (
        <CarryModal
          invoice={carryTarget.invoice}
          mode={carryTarget.mode}
          onClose={() => setCarryTarget(null)}
          onDone={() => { setCarryTarget(null); if (activeId) loadInvoices(activeId); }}
        />
      )}
    </Stack>
  );
}

function CarryModal({ invoice, mode, onClose, onDone }: { invoice: Invoice; mode: 'next' | 'spread'; onClose: () => void; onDone: () => void }) {
  const shortfall = Math.max(0, invoice.amount - paidOf(invoice));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const res = await fetch('/api/v1/fee-invoices/carry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice.id, mode, reason: reason || null }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { notifications.show({ color: 'red', title: 'Ошибка', message: j.error?.message ?? 'Не удалось перенести' }); return; }
    notifications.show({ color: 'green', title: 'Остаток перенесён', message: `${shortfall.toLocaleString('ru-RU')} сом — ${mode === 'next' ? 'на следующий месяц' : 'распределён по графику'}` });
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title={`Перенос остатка — ${invoice.title}`} centered>
      <Stack gap="sm">
        <Text size="sm">Недоплата: <Text span fw={600}>{som(shortfall)}</Text></Text>
        <Text size="sm" c="dimmed">{mode === 'next' ? 'Будет добавлено к следующему платежу графика.' : 'Будет равномерно распределено по всем последующим платежам.'}</Text>
        <TextInput label="Причина недоплаты (необязательно)" placeholder="Напр.: задержка зарплаты у родителя" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Перенести</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PaymentModal({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const rem = Math.max(0, invoice.amount - paidOf(invoice));
  const [amount, setAmount] = useState<number>(rem);
  const [method, setMethod] = useState<string>('нал');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const overpay = Math.max(0, amount - rem);

  async function submit() {
    if (!amount || amount <= 0) return;
    setSaving(true);
    const res = await fetch('/api/v1/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice.id, amount, method, note: note || null }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { notifications.show({ color: 'red', title: 'Ошибка', message: j.error?.message ?? 'Не удалось' }); return; }
    notifications.show({ color: 'green', title: 'Оплата принята', message: `${amount.toLocaleString('ru-RU')} сом по «${invoice.title}»` });
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title={`Оплата — ${invoice.title}`} centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">Остаток по счёту: {som(rem)}</Text>
        <NumberInput label="Сумма" value={amount} onChange={(v) => setAmount(Number(v) || 0)} thousandSeparator=" " min={0} />
        {overpay > 0 && <Text size="xs" c="blue">Излишек {som(overpay)} уйдёт в счёт следующих месяцев</Text>}
        <Select label="Способ" value={method} onChange={(v) => setMethod(v ?? 'нал')}
          data={[{ value: 'нал', label: 'Наличные' }, { value: 'карта', label: 'Карта' }, { value: 'мбанк', label: 'МБанк' }, { value: 'банк', label: 'Банк' }]} />
        <TextInput label="Комментарий (необязательно)" placeholder="Напр.: оплатил часть, остаток обещал позже" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Принять</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PayoffModal({ contract, invoices, onClose, onDone }: { contract: Contract; invoices: Invoice[]; onClose: () => void; onDone: () => void }) {
  const openInvoices = invoices
    .map((inv) => {
      const remaining = Math.max(0, inv.amount - paidOf(inv));
      const penalty = computePenalty(inv).penalty;
      return { ...inv, remaining, penalty };
    })
    .filter((inv) => inv.remaining > 0 && inv.status !== 'cancelled');
  const total = openInvoices.reduce((sum, inv) => sum + inv.remaining, 0);
  const advisoryPenalty = openInvoices.reduce((sum, inv) => sum + inv.penalty, 0);
  const [method, setMethod] = useState<string>('нал');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (total <= 0) return;
    setSaving(true);
    const res = await fetch('/api/v1/contracts/payoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: contract.id, method, note: note || null, invoiceIds: openInvoices.map((inv) => inv.id) }),
    });
    const j = await res.json();
    setSaving(false);
    if (!j.success) {
      notifications.show({ color: 'red', title: 'Ошибка', message: j.error?.message ?? 'Не удалось выполнить досрочное погашение' });
      return;
    }
    notifications.show({ color: 'green', title: 'Досрочное погашение выполнено', message: `${som(j.data.total)} · счетов: ${j.data.invoicesPaid}` });
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title={`Досрочное погашение договора №${contract.number}`} centered size="lg">
      <Stack gap="sm">
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Счёт</Table.Th>
                <Table.Th ta="right">Остаток</Table.Th>
                <Table.Th ta="right">Пеня не включена</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {openInvoices.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{inv.title}</Text>
                    {inv.dueDate && <Text size="xs" c="dimmed">{fmtDate(inv.dueDate)}</Text>}
                  </Table.Td>
                  <Table.Td ta="right">{som(inv.remaining)}</Table.Td>
                  <Table.Td ta="right"><Text c={inv.penalty > 0 ? 'red' : 'dimmed'}>{som(inv.penalty)}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group justify="space-between">
          <Text fw={700}>Итого к погашению: {som(total)}</Text>
          <Text size="sm" c="dimmed">Справочная пеня: {som(advisoryPenalty)}, пеня не включена</Text>
        </Group>
        <Select label="Способ" value={method} onChange={(v) => setMethod(v ?? 'нал')}
          data={[{ value: 'нал', label: 'Наличные' }, { value: 'карта', label: 'Карта' }, { value: 'мбанк', label: 'МБанк' }, { value: 'банк', label: 'Банк' }]} />
        <TextInput label="Комментарий (необязательно)" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving} disabled={total <= 0}>Погасить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ContractModal({ studentId, renew, carriedDebt = 0, onClose, onDone }: { studentId: string; renew?: boolean; carriedDebt?: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    number: '', year: '2026–2027', baseAmount: 650000, discountPct: 0, discountNote: '', prepaymentPct: 20,
    scheduleType: 'monthly', scheduleMonths: 9, paymentDay: 10, repFio: '', repInn: '', repPhone: '',
    repPassport: '', repIssuedBy: '', repAddress: '', startDate: '', gen: true,
  });
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.number.trim()) { setErr('Укажите номер договора'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/contracts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId, number: f.number, year: f.year, baseAmount: f.baseAmount, discountPct: f.discountPct,
        discountNote: f.discountNote, prepaymentPct: f.prepaymentPct, scheduleType: f.scheduleType,
        scheduleMonths: f.scheduleMonths, paymentDay: f.paymentDay, startDate: f.startDate || null,
        representative: { fio: f.repFio, inn: f.repInn, phone: f.repPhone, passport: f.repPassport, issuedBy: f.repIssuedBy, address: f.repAddress }, generateInvoices: f.gen,
        renew: renew ?? false,
      }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title={renew ? 'Продление договора' : 'Новый договор'} centered size="lg">
      <Stack gap="sm">
        {renew && carriedDebt > 0 && (
          <Text size="sm" c="orange">Непогашенный долг {som(carriedDebt)} перенесётся в первый платёж нового договора. Текущий договор будет закрыт.</Text>
        )}
        <Group grow>
          <TextInput label="Номер договора" required value={f.number} onChange={(e) => set('number', e.currentTarget.value)} />
          <TextInput label="Учебный год" value={f.year} onChange={(e) => set('year', e.currentTarget.value)} />
        </Group>
        <Group grow>
          <NumberInput label="Стоимость (сом)" value={f.baseAmount} onChange={(v) => set('baseAmount', Number(v) || 0)} thousandSeparator=" " />
          <NumberInput label="Скидка %" value={f.discountPct} onChange={(v) => set('discountPct', Number(v) || 0)} min={0} max={100} />
          <NumberInput label="Предоплата %" value={f.prepaymentPct} onChange={(v) => set('prepaymentPct', Number(v) || 0)} min={0} max={100} />
        </Group>
        <TextInput label="За что скидка (примечание)" value={f.discountNote} onChange={(e) => set('discountNote', e.currentTarget.value)} />
        <Group grow>
          <Select label="График" value={f.scheduleType} onChange={(v) => set('scheduleType', v ?? 'monthly')}
            data={[{ value: 'monthly', label: 'Помесячно' }, { value: 'quarterly', label: 'По триместрам' }, { value: 'yearly', label: 'За год' }]} />
          <NumberInput label="Платежей" value={f.scheduleMonths} onChange={(v) => set('scheduleMonths', Number(v) || 1)} min={1} max={12} />
          <NumberInput label="День оплаты" value={f.paymentDay} onChange={(v) => set('paymentDay', Number(v) || 10)} min={1} max={28} />
        </Group>
        <TextInput label="Дата начала" type="date" value={f.startDate} onChange={(e) => set('startDate', e.currentTarget.value)} />
        <Text size="sm" fw={500}>Представитель</Text>
        <Group grow>
          <TextInput label="ФИО" value={f.repFio} onChange={(e) => set('repFio', e.currentTarget.value)} />
          <TextInput label="ИНН" value={f.repInn} onChange={(e) => set('repInn', e.currentTarget.value)} />
          <TextInput label="Телефон" value={f.repPhone} onChange={(e) => set('repPhone', e.currentTarget.value)} />
        </Group>
        <Group grow>
          <TextInput label="Паспорт (ID)" value={f.repPassport} onChange={(e) => set('repPassport', e.currentTarget.value)} />
          <TextInput label="Кем/когда выдан" value={f.repIssuedBy} onChange={(e) => set('repIssuedBy', e.currentTarget.value)} />
          <TextInput label="Адрес" value={f.repAddress} onChange={(e) => set('repAddress', e.currentTarget.value)} />
        </Group>
        <Checkbox label="Сгенерировать счета по графику" checked={f.gen} onChange={(e) => set('gen', e.currentTarget.checked)} />
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Создать договор</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
