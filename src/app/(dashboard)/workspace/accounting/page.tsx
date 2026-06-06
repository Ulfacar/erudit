'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCash, IconReceipt, IconArrowDownRight, IconBellRinging, IconCreditCardPay } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';
import { computePenalty } from '@/shared/lib/finance/penalty';
import { INV_STATUS, INV_COLOR, invoiceStatusLabel } from '@/shared/lib/finance/invoice-status';

/** Пеня по строке счёта (payments приходят из API). */
function rowPenalty(r: Record<string, unknown>): { penalty: number; overdueDays: number } {
  const { penalty, overdueDays } = computePenalty({
    amount: Number(r.amount ?? 0),
    status: String(r.status ?? ''),
    dueDate: (r.dueDate as string) ?? null,
    payments: (r.payments as Array<{ amount: number }>) ?? [],
  });
  return { penalty, overdueDays };
}

const EXP_CATS = [
  { value: 'salary', label: 'Зарплата' },
  { value: 'utilities', label: 'Коммуналка' },
  { value: 'supplies', label: 'Закуп' },
  { value: 'repair', label: 'Ремонт' },
  { value: 'other', label: 'Прочее' },
];

const PAY_METHODS = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
  { value: 'bank', label: 'Банковский перевод' },
];

interface InvoiceOption {
  id: string; studentId: string; title: string; period: string | null;
  amount: number; status: string; dueDate: string | null;
  payments: Array<{ amount: number }>;
}

/** Модал «Принять оплату»: выбор открытого счёта → сумма → платёж. */
function AcceptPaymentModal({ opened, onClose, onSuccess }: { opened: boolean; onClose: () => void; onSuccess: () => void }) {
  const [invoices, setInvoices] = useState<InvoiceOption[] | null>(null);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>('');
  const [method, setMethod] = useState<string | null>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Загрузка открытых счетов при открытии модала
  useEffect(() => { if (opened) load(); }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps
  function load() {
    setInvoices(null);
    Promise.all([
      fetch('/api/v1/fee-invoices').then((r) => r.json()).catch(() => null),
      fetch('/api/v1/students').then((r) => r.json()).catch(() => null),
    ]).then(([inv, st]) => {
      const open = (inv?.success ? inv.data : []).filter((i: InvoiceOption) => i.status === 'pending' || i.status === 'partial');
      setInvoices(open);
      const map: Record<string, string> = {};
      for (const s of st?.success ? st.data : []) map[s.id] = `${s.lastName} ${s.firstName}`;
      setStudents(map);
    });
  }

  const selected = (invoices ?? []).find((i) => i.id === invoiceId) ?? null;
  const selectedRemaining = selected
    ? selected.amount - (selected.payments ?? []).reduce((s, p) => s + p.amount, 0)
    : 0;

  async function submit() {
    if (!invoiceId || !amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amount: Number(amount), method, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка');
      notifications.show({ color: 'green', title: 'Платёж принят', message: `${fmtMoney(Number(amount))} — статус счёта: ${invoiceStatusLabel(json.data.status)}` });
      setInvoiceId(null); setAmount(''); setNote('');
      onSuccess();
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Ошибка', message: e instanceof Error ? e.message : 'Не удалось зарегистрировать платёж' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Принять оплату" radius="lg">
      <Stack gap="sm">
        <Select
          label="Счёт"
          placeholder={invoices === null ? 'Загрузка…' : 'Выберите счёт'}
          searchable
          required
          data={(invoices ?? []).map((i) => ({
            value: i.id,
            label: `${students[i.studentId] ?? '—'} · ${i.title} · ${fmtMoney(i.amount)} (${invoiceStatusLabel(i.status)})`,
          }))}
          value={invoiceId}
          onChange={setInvoiceId}
        />
        {selected && (
          <Text size="xs" c="dimmed">
            Остаток по счёту: <Text span fw={600} c={selectedRemaining > 0 ? 'orange' : 'green'}>{fmtMoney(selectedRemaining)}</Text>
          </Text>
        )}
        <NumberInput label="Сумма (сом)" required min={1} value={amount} onChange={setAmount} thousandSeparator=" " />
        <Select label="Способ оплаты" data={PAY_METHODS} value={method} onChange={setMethod} />
        <TextInput label="Примечание" placeholder="№ квитанции и т.п." value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button color="green" loading={saving} disabled={!invoiceId || !amount} onClick={submit} leftSection={<IconCreditCardPay size={16} />}>
            Принять
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function AccountingPage() {
  const [payOpen, setPayOpen] = useState(false);
  const [invKey, setInvKey] = useState(0); // remount ResourcePage после платежа
  const [sendingReminders, setSendingReminders] = useState(false);

  async function sendReminders() {
    setSendingReminders(true);
    try {
      const res = await fetch('/api/v1/fee-invoices/send-reminders', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка');
      notifications.show({
        color: json.data.count > 0 ? 'blue' : 'gray',
        title: 'Напоминания о задолженности',
        message: json.data.count > 0 ? `Отправлено напоминаний: ${json.data.count}` : 'Просроченных счетов нет',
      });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Ошибка', message: e instanceof Error ? e.message : 'Не удалось отправить напоминания' });
    } finally {
      setSendingReminders(false);
    }
  }

  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'accountant']}>
      <Tabs defaultValue="invoices">
        <Tabs.List mb="md">
          <Tabs.Tab value="invoices" leftSection={<IconReceipt size={16} />}>Счета (оплата обучения)</Tabs.Tab>
          <Tabs.Tab value="expenses" leftSection={<IconArrowDownRight size={16} />}>Расходы</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoices">
          <Group justify="flex-end" mb="sm">
            <Button variant="light" color="orange" leftSection={<IconBellRinging size={16} />} loading={sendingReminders} onClick={sendReminders}>
              Отправить напоминания
            </Button>
            <Button color="green" leftSection={<IconCreditCardPay size={16} />} onClick={() => setPayOpen(true)}>
              Принять оплату
            </Button>
          </Group>
          <AcceptPaymentModal opened={payOpen} onClose={() => setPayOpen(false)} onSuccess={() => setInvKey((k) => k + 1)} />
          <ResourcePage
            key={invKey}
            title="Счета на оплату"
            icon={<IconCash size={22} color="#2f9e44" />}
            endpoint="/api/v1/fee-invoices"
            createLabel="Выставить счёт"
            canDelete
            lookups={[studentLookup]}
            columns={[
              { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
              { key: 'title', label: 'Назначение' },
              { key: 'period', label: 'Период' },
              { key: 'amount', label: 'Сумма', render: (r) => fmtMoney(r.amount) },
              { key: 'status', label: 'Статус', render: (r) => <Badge variant="light" color={INV_COLOR[String(r.status)] ?? 'gray'} radius="sm">{INV_STATUS.find((s) => s.value === r.status)?.label ?? String(r.status)}</Badge> },
              { key: 'dueDate', label: 'Срок', render: (r) => (r.dueDate ? fmtDate(r.dueDate) : '—') },
              {
                key: 'penalty',
                label: 'Пеня',
                render: (r) => {
                  const { penalty, overdueDays } = rowPenalty(r as Record<string, unknown>);
                  return penalty > 0 ? (
                    <Text size="sm" c="red" fw={600}>
                      +{fmtMoney(penalty)} <Text span size="xs" c="dimmed">({overdueDays} дн)</Text>
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">—</Text>
                  );
                },
              },
            ]}
            fields={[
              studentField,
              { name: 'title', label: 'Назначение', type: 'text', required: true, placeholder: 'Обучение, сентябрь' },
              { name: 'period', label: 'Период', type: 'text', placeholder: 'Сентябрь 2025' },
              { name: 'amount', label: 'Сумма (сом)', type: 'number', required: true },
              { name: 'status', label: 'Статус', type: 'select', options: INV_STATUS, defaultValue: 'pending' },
              { name: 'dueDate', label: 'Срок оплаты', type: 'date' },
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="expenses">
          <ResourcePage
            title="Расходы школы"
            icon={<IconArrowDownRight size={22} color="#e03131" />}
            endpoint="/api/v1/expenses"
            createLabel="Добавить расход"
            canDelete
            columns={[
              { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
              { key: 'category', label: 'Категория', render: (r) => EXP_CATS.find((c) => c.value === r.category)?.label ?? String(r.category) },
              { key: 'title', label: 'Назначение' },
              { key: 'amount', label: 'Сумма', render: (r) => fmtMoney(r.amount) },
            ]}
            fields={[
              { name: 'category', label: 'Категория', type: 'select', options: EXP_CATS, defaultValue: 'supplies', required: true },
              { name: 'title', label: 'Назначение', type: 'text', required: true },
              { name: 'amount', label: 'Сумма (сом)', type: 'number', required: true },
              { name: 'date', label: 'Дата', type: 'date', required: true },
            ]}
          />
        </Tabs.Panel>
      </Tabs>
    </RoleGate>
  );
}
