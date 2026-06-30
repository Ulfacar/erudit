import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computePenalty } from '@/shared/lib/finance/penalty';
import { verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';
import { computeFounderInsights } from '@/shared/lib/ai/insights';

function classLabel(cls: { grade: number; letter: string } | null | undefined): string {
  return cls ? `${cls.grade}${cls.letter}` : 'Без класса';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'founder'] });
    if (auth.response) return auth.response;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      invoices,
      students,
      classCapacity,
      teachers,
      classes,
      todayAttendance,
      events,
      purchaseRequests,
      timeOffRequests,
      expenses,
      assetGroups,
      psySessions,
      psyCases,
      psyStudentCases,
    ] = await Promise.all([
      prisma.feeInvoice.findMany({
        where: { status: { not: 'cancelled' } },
        include: { payments: { select: { amount: true, paidAt: true, verified: true } } },
      }),
      prisma.student.findMany({
        select: { id: true, class: { select: { grade: true, letter: true } } },
      }),
      prisma.class.findMany({
        select: { capacity: true, _count: { select: { students: true } } },
      }),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { date: { gte: todayStart, lt: todayEnd } },
        _count: true,
      }),
      prisma.schoolEvent.count({ where: { date: { gte: todayStart } } }),
      prisma.purchaseRequest.count({ where: { status: 'pending' } }),
      prisma.timeOffRequest.count({ where: { status: 'pending' } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.asset.groupBy({
        by: ['category'],
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      prisma.psySession.count(),
      prisma.psyCase.count(),
      prisma.psyCase.findMany({
        where: { studentId: { not: null } },
        select: { studentId: true },
      }),
    ]);

    const studentById = new Map(students.map((student) => [student.id, student]));
    const months: { key: string; month: string; paid: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        month: date.toLocaleDateString('ru-RU', { month: 'short' }),
        paid: 0,
      });
    }
    const monthByKey = new Map(months.map((month) => [month.key, month]));

    let totalAmount = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalPenalty = 0;
    const debtByClass = new Map<string, { remaining: number; penalty: number; students: Set<string> }>();

    for (const invoice of invoices) {
      const paid = verifiedPaidTotal(invoice.payments);
      const { remaining, penalty } = computePenalty(invoice);
      totalAmount += invoice.amount;
      totalPaid += paid;
      totalRemaining += remaining;
      totalPenalty += penalty;

      if (remaining > 0) {
        const label = classLabel(studentById.get(invoice.studentId)?.class);
        const row = debtByClass.get(label) ?? { remaining: 0, penalty: 0, students: new Set<string>() };
        row.remaining += remaining;
        row.penalty += penalty;
        row.students.add(invoice.studentId);
        debtByClass.set(label, row);
      }

      for (const payment of invoice.payments) {
        if (!payment.verified) continue;
        const paidAt = new Date(payment.paidAt);
        const key = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;
        const month = monthByKey.get(key);
        if (month) month.paid += payment.amount;
      }
    }

    const capacityTotal = classCapacity.reduce((sum, item) => sum + (item.capacity ?? 0), 0);
    const occupiedTotal = classCapacity.reduce((sum, item) => sum + item._count.students, 0);
    const attendanceTotal = todayAttendance.reduce((sum, item) => sum + item._count, 0);
    const attendancePresent = todayAttendance
      .filter((item) => item.status === 'present' || item.status === 'late')
      .reduce((sum, item) => sum + item._count, 0);

    const casesByClass = new Map<string, number>();
    for (const psyCase of psyStudentCases) {
      if (!psyCase.studentId) continue;
      const label = classLabel(studentById.get(psyCase.studentId)?.class);
      casesByClass.set(label, (casesByClass.get(label) ?? 0) + 1);
    }

    const overview = {
      finance: {
        totalAmount,
        totalPaid,
        totalRemaining,
        totalPenalty,
        totalExpenses: expenses._sum.amount ?? 0,
        collectRate: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 1000) / 10 : 0,
        debtorsCount: new Set(
          Array.from(debtByClass.values()).flatMap((value) => Array.from(value.students)),
        ).size,
        monthly: months.map(({ month, paid }) => ({ month, paid })),
        debtByClass: Array.from(debtByClass.entries())
          .map(([label, value]) => ({
            classLabel: label,
            remaining: value.remaining,
            penalty: value.penalty,
            students: value.students.size,
          }))
          .sort((a, b) => b.remaining - a.remaining)
          .slice(0, 10),
      },
      inventory: assetGroups
        .map((group) => ({
          category: group.category ?? 'Без категории',
          count: group._count._all,
          quantity: group._sum.quantity ?? 0,
        }))
        .sort((a, b) => b.quantity - a.quantity),
      school: {
        students: students.length,
        teachers,
        classes,
        occupancyRate: capacityTotal > 0 ? Math.round((occupiedTotal / capacityTotal) * 1000) / 10 : null,
        attendanceTodayRate: attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 1000) / 10 : null,
        events,
        purchaseRequests,
        timeOffRequests,
      },
      psych: {
        sessions: psySessions,
        cases: psyCases,
        topClasses: Array.from(casesByClass.entries())
          .map(([label, count]) => ({ classLabel: label, cases: count }))
          .sort((a, b) => b.cases - a.cases)
          .slice(0, 5),
      },
    };

    return successResponse({
      ...overview,
      insights: computeFounderInsights(overview),
    });
  } catch (error) {
    console.error('GET /api/v1/founder/overview error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сводку учредителя', 500);
  }
}
