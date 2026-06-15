import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import type { PaymentSchedule } from '@prisma/client';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

/** GET /api/v1/contracts?studentId= — договоры (история), новые сверху. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;
  const studentId = new URL(request.url).searchParams.get('studentId');
  try {
    const contracts = await prisma.contract.findMany({
      where: studentId ? { studentId } : {},
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(contracts);
  } catch (e) {
    console.error('GET contracts error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить договоры', 500);
  }
}

/** POST /api/v1/contracts — создать договор + сгенерировать счета по графику. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { studentId, number, year, baseAmount, discountPct, discountNote, prepaymentPct,
    scheduleType, scheduleMonths, paymentDay, representative, startDate, generateInvoices } = body as Record<string, unknown>;

  if (!studentId || !number || baseAmount === undefined) {
    return errorResponse('VALIDATION_ERROR', 'Нужны ученик, номер договора и стоимость');
  }
  const base = parseInt(String(baseAmount), 10) || 0;
  const disc = Math.min(100, Math.max(0, parseInt(String(discountPct ?? 0), 10) || 0));
  const amount = Math.round(base * (1 - disc / 100));
  const schedule = (['monthly', 'quarterly', 'yearly'].includes(String(scheduleType)) ? scheduleType : 'monthly') as PaymentSchedule;
  const months = parseInt(String(scheduleMonths ?? (schedule === 'monthly' ? 9 : schedule === 'quarterly' ? 3 : 1)), 10);
  const payDay = Math.min(28, Math.max(1, parseInt(String(paymentDay ?? 10), 10) || 10));

  try {
    const student = await prisma.student.findUnique({ where: { id: String(studentId) }, select: { branchId: true } });
    // предыдущий активный договор → в историю (completed) + связь
    const prev = await prisma.contract.findFirst({ where: { studentId: String(studentId), status: 'active' }, orderBy: { createdAt: 'desc' } });
    if (prev) await prisma.contract.update({ where: { id: prev.id }, data: { status: 'completed' } });

    const branch = student?.branchId ? await prisma.branch.findUnique({ where: { id: student.branchId }, select: { requisites: true } }) : null;

    const contract = await prisma.contract.create({
      data: {
        studentId: String(studentId), number: String(number), year: String(year ?? ''),
        baseAmount: base, discountPct: disc, discountNote: discountNote ? String(discountNote) : null,
        amount, prepaymentPct: parseInt(String(prepaymentPct ?? 0), 10) || 0,
        scheduleType: schedule, scheduleMonths: months, paymentDay: payDay,
        representative: (representative as object) ?? undefined,
        requisites: (branch?.requisites as object) ?? undefined,
        branchId: student?.branchId ?? null,
        prevContractId: prev?.id ?? null,
        startDate: startDate ? new Date(String(startDate)) : null,
        createdById: auth.session.user.id,
      },
    });

    // генерация счетов по графику: отдельная предоплата + равные доли по графику
    let invoices = 0;
    if (generateInvoices !== false && months > 0) {
      const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const stepMonths = schedule === 'quarterly' ? 3 : schedule === 'yearly' ? 12 : 1;
      const base0 = startDate ? new Date(String(startDate)) : new Date();
      const prepay = Math.round((amount * (parseInt(String(prepaymentPct ?? 0), 10) || 0)) / 100);

      // предоплата вносится в дату старта договора
      if (prepay > 0) {
        await prisma.feeInvoice.create({
          data: { studentId: String(studentId), contractId: contract.id, title: 'Предоплата', period: 'prepay', amount: prepay, status: 'pending', dueDate: new Date(base0) },
        });
        invoices++;
      }

      // остаток (после предоплаты) — равными долями по графику
      const rest = amount - prepay;
      const per = Math.round(rest / months);
      for (let i = 0; i < months; i++) {
        const due = new Date(base0);
        due.setMonth(due.getMonth() + i * stepMonths);
        due.setDate(payDay);
        await prisma.feeInvoice.create({
          data: { studentId: String(studentId), contractId: contract.id, title: MONTHS_RU[due.getMonth()], period: `${i + 1}/${months}`, amount: per, status: 'pending', dueDate: due },
        });
        invoices++;
      }
    }
    return successResponse({ contract, invoices }, 201);
  } catch (e) {
    console.error('POST contracts error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать договор', 500);
  }
}
