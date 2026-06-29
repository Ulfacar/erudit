import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computePenalty } from '@/shared/lib/finance/penalty';

/**
 * GET /api/v1/finance/debtors — должники с телефоном родителя (для колл-центра).
 * Сгруппировано по ученику; включает последнее обещание оплаты (StudentNote promise).
 */
const ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager', 'call_center'] as const;

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  try {
    const invoices = await prisma.feeInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { not: null, lt: new Date() } },
      include: { payments: { select: { amount: true } } },
    });
    type Row = { studentId: string; remaining: number; penalty: number; overdueDays: number };
    const byStudent = new Map<string, Row>();
    for (const inv of invoices) {
      const { remaining, penalty, overdueDays } = computePenalty(inv);
      if (remaining <= 0) continue;
      const cur = byStudent.get(inv.studentId) ?? { studentId: inv.studentId, remaining: 0, penalty: 0, overdueDays: 0 };
      cur.remaining += remaining; cur.penalty += penalty; cur.overdueDays = Math.max(cur.overdueDays, overdueDays);
      byStudent.set(inv.studentId, cur);
    }
    const ids = [...byStudent.keys()];
    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } }, parentLinks: { select: { parent: { select: { phone: true } } } } },
    });
    // последний контакт колл-центра: статус задачи ('collection') или старое обещание ('promise')
    const notes = await prisma.studentNote.findMany({ where: { studentId: { in: ids }, type: { in: ['collection', 'promise'] } }, orderBy: { createdAt: 'desc' } });

    const rows = [...byStudent.values()].map((r) => {
      const s = students.find((x) => x.id === r.studentId);
      const phone = s?.parentLinks.map((pl) => pl.parent.phone).find(Boolean) ?? null;
      const last = notes.find((p) => p.studentId === r.studentId);
      const status = last
        ? ((last.meta as { status?: string } | null)?.status ?? (last.type === 'promise' ? 'promise_to_pay' : 'contacted'))
        : null;
      return {
        studentId: r.studentId,
        name: s ? `${s.lastName} ${s.firstName}` : '—',
        className: s?.class ? `${s.class.grade}${s.class.letter}` : '',
        phone,
        remaining: r.remaining, penalty: r.penalty, overdueDays: r.overdueDays,
        lastTask: last ? { status, text: last.text, at: last.createdAt } : null,
      };
    }).sort((a, b) => b.remaining - a.remaining);

    return successResponse(rows);
  } catch (e) {
    console.error('GET finance/debtors error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить должников', 500);
  }
}
