import { prisma } from '@/shared/lib/prisma';
import type { PaymentSchedule } from '@prisma/client';

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export interface CreateContractInput {
  studentId: string;
  number: string;
  year?: string;
  baseAmount: number;
  discountPct?: number;
  discountNote?: string | null;
  prepaymentPct?: number;
  scheduleType?: PaymentSchedule | string;
  scheduleMonths?: number;
  paymentDay?: number;
  representative?: object | null;
  startDate?: Date | null;
  /** false → не генерировать счета (по умолчанию генерируем). */
  generateInvoices?: boolean;
  /** true → закрыть прежний активный договор и перенести непогашенный долг в новый. */
  renew?: boolean;
  createdById: string;
}

/**
 * Создать договор + сгенерировать счета по графику. Если renew=true — закрыть
 * предыдущий активный договор ученика (status=completed) и перенести непогашенный
 * долг в первый платёж нового. Единый источник логики для:
 *  - POST /api/v1/contracts (ручное создание/продление),
 *  - POST /api/v1/operations/promote (выборочный перевод года).
 */
export async function createContractWithInvoices(input: CreateContractInput) {
  const base = parseInt(String(input.baseAmount), 10) || 0;
  const disc = Math.min(100, Math.max(0, parseInt(String(input.discountPct ?? 0), 10) || 0));
  const amount = Math.round(base * (1 - disc / 100));
  const schedule = (['monthly', 'quarterly', 'yearly'].includes(String(input.scheduleType))
    ? input.scheduleType
    : 'monthly') as PaymentSchedule;
  const months = parseInt(String(input.scheduleMonths ?? (schedule === 'monthly' ? 9 : schedule === 'quarterly' ? 3 : 1)), 10);
  const payDay = Math.min(28, Math.max(1, parseInt(String(input.paymentDay ?? 10), 10) || 10));
  const prepaymentPct = parseInt(String(input.prepaymentPct ?? 0), 10) || 0;

  const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { branchId: true } });
  // предыдущий активный договор → в историю (completed) + связь
  const prev = await prisma.contract.findFirst({ where: { studentId: input.studentId, status: 'active' }, orderBy: { createdAt: 'desc' } });

  // при продлении переносим непогашенный долг прежнего договора в первый платёж нового
  let carried = 0;
  if (input.renew === true && prev) {
    const prevInvs = await prisma.feeInvoice.findMany({ where: { contractId: prev.id, status: { not: 'cancelled' } }, include: { payments: { select: { amount: true } } } });
    for (const inv of prevInvs) {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      carried += Math.max(0, inv.amount - paid);
    }
  }
  if (prev) await prisma.contract.update({ where: { id: prev.id }, data: { status: 'completed' } });

  const branch = student?.branchId ? await prisma.branch.findUnique({ where: { id: student.branchId }, select: { requisites: true } }) : null;

  const contract = await prisma.contract.create({
    data: {
      studentId: input.studentId, number: input.number, year: String(input.year ?? ''),
      baseAmount: base, discountPct: disc, discountNote: input.discountNote ? String(input.discountNote) : null,
      amount, prepaymentPct, scheduleType: schedule, scheduleMonths: months, paymentDay: payDay,
      representative: (input.representative as object) ?? undefined,
      requisites: (branch?.requisites as object) ?? undefined,
      branchId: student?.branchId ?? null,
      prevContractId: prev?.id ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      createdById: input.createdById,
    },
  });

  // генерация счетов по графику: отдельная предоплата + равные доли по графику
  let invoices = 0;
  if (input.generateInvoices !== false && months > 0) {
    const stepMonths = schedule === 'quarterly' ? 3 : schedule === 'yearly' ? 12 : 1;
    const base0 = input.startDate ? new Date(input.startDate) : new Date();
    const prepay = Math.round((amount * prepaymentPct) / 100);

    // предоплата вносится в дату старта договора (+перенесённый долг, если продление)
    if (prepay > 0) {
      await prisma.feeInvoice.create({
        data: { studentId: input.studentId, contractId: contract.id, title: carried > 0 ? 'Предоплата + перенос долга' : 'Предоплата', period: 'prepay', amount: prepay + carried, status: 'pending', dueDate: new Date(base0) },
      });
      carried = 0;
      invoices++;
    }

    // остаток (после предоплаты) — равными долями по графику
    const rest = amount - prepay;
    const per = Math.round(rest / months);
    for (let i = 0; i < months; i++) {
      const due = new Date(base0);
      due.setMonth(due.getMonth() + i * stepMonths);
      due.setDate(payDay);
      // если предоплаты не было — перенесённый долг идёт в первый платёж
      const extra = i === 0 ? carried : 0;
      await prisma.feeInvoice.create({
        data: { studentId: input.studentId, contractId: contract.id, title: extra > 0 ? `${MONTHS_RU[due.getMonth()]} + перенос долга` : MONTHS_RU[due.getMonth()], period: `${i + 1}/${months}`, amount: per + extra, status: 'pending', dueDate: due },
      });
      invoices++;
    }
  }

  return { contract, invoices };
}

/**
 * Продлить активный договор ученика на новый год, копируя финансовые условия
 * прежнего (с опциональной новой стоимостью). Вернёт null, если активного нет.
 */
export async function renewFromActiveContract(
  studentId: string,
  opts: { year: string; newBaseAmount?: number | null; createdById: string },
) {
  const prev = await prisma.contract.findFirst({ where: { studentId, status: 'active' }, orderBy: { createdAt: 'desc' } });
  if (!prev) return null;
  return createContractWithInvoices({
    studentId,
    number: `${prev.number}-${opts.year || 'next'}`,
    year: opts.year || prev.year,
    baseAmount: opts.newBaseAmount != null ? opts.newBaseAmount : prev.baseAmount,
    discountPct: prev.discountPct,
    discountNote: prev.discountNote,
    prepaymentPct: prev.prepaymentPct,
    scheduleType: prev.scheduleType,
    scheduleMonths: prev.scheduleMonths,
    paymentDay: prev.paymentDay,
    representative: (prev.representative as object) ?? null,
    renew: true,
    createdById: opts.createdById,
  });
}
