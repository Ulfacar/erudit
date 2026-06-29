import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/dashboard/domains — «Ваш экран» директора (слайд 5 презентации):
 * домены экосистемы одной выдачей. Финансы — null для secretary
 * (в соответствии с RBAC бухгалтерии ADMIN_AND_VICE).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const canSeeFinance = role !== 'secretary';

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const [
      invoiceAgg, paymentAgg, debtors,
      sessions30, psychStudents, recommendations,
      teacherCount, workloadAgg, staffCount,
      admissionByStage,
      rejected,
      gradeAgg, attendance30,
      agentActive, agentLatest,
    ] = await Promise.all([
      canSeeFinance
        ? prisma.feeInvoice.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { amount: true } })
        : Promise.resolve(null),
      canSeeFinance ? prisma.payment.aggregate({ where: { verified: true }, _sum: { amount: true } }) : Promise.resolve(null),
      canSeeFinance
        ? prisma.feeInvoice.findMany({ where: { status: { in: ['pending', 'partial'] } }, select: { studentId: true } })
        : Promise.resolve(null),
      prisma.specialistSession.count({ where: { date: { gte: since30 } } }),
      prisma.specialistSession.groupBy({ by: ['studentId'], where: { date: { gte: since30 } } }),
      prisma.specialistRecommendation.count({ where: { date: { gte: since30 } } }),
      prisma.teacher.count(),
      prisma.teacherSubject.aggregate({ _sum: { hoursPerWeek: true } }),
      prisma.staffMember.count({ where: { isActive: true } }),
      prisma.admissionLead.groupBy({ by: ['stage'], _count: true }),
      prisma.admissionLead.findMany({
        where: { stage: 'rejected' },
        select: { childName: true, rejectReason: true },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      }),
      prisma.grade.aggregate({ where: { scale: 'FIVE' }, _avg: { value: true } }),
      prisma.attendance.groupBy({ by: ['status'], where: { date: { gte: since30 } }, _count: true }),
      prisma.agentItem.count({ where: { status: { in: ['new', 'in_progress'] } } }),
      prisma.agentItem.findMany({
        where: { status: { in: ['new', 'in_progress'] } },
        select: { title: true, severity: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    // финансы
    let finance: { invoiced: number; paid: number; debt: number; debtStudents: number } | null = null;
    if (canSeeFinance && invoiceAgg && paymentAgg && debtors) {
      const invoiced = invoiceAgg._sum.amount ?? 0;
      const paid = paymentAgg._sum.amount ?? 0;
      finance = {
        invoiced,
        paid,
        debt: Math.max(invoiced - paid, 0),
        debtStudents: new Set(debtors.map((d) => d.studentId)).size,
      };
    }

    // приёмная
    const admissionCounts = Object.fromEntries(admissionByStage.map((s) => [s.stage, s._count]));
    const admissionTotal = admissionByStage.reduce((s, x) => s + x._count, 0);
    const enrolled = (admissionCounts.enrolled as number | undefined) ?? 0;

    // качество: средний балл + посещаемость %
    const attTotal = attendance30.reduce((s, a) => s + a._count, 0);
    const attPresent = attendance30.find((a) => a.status === 'present')?._count ?? 0;

    return successResponse({
      finance,
      psych: {
        sessions30,
        studentsInWork: psychStudents.length,
        recommendations30: recommendations,
      },
      hr: {
        teachers: teacherCount,
        weeklyHours: workloadAgg._sum.hoursPerWeek ?? 0,
        staff: staffCount,
      },
      admission: {
        total: admissionTotal,
        inPipeline: admissionTotal - enrolled - ((admissionCounts.rejected as number | undefined) ?? 0),
        enrolled,
        conversion: admissionTotal ? Math.round((enrolled / admissionTotal) * 100) : 0,
      },
      retention: {
        rejectedTotal: (admissionCounts.rejected as number | undefined) ?? 0,
        reasons: rejected.map((r) => ({ name: r.childName, reason: r.rejectReason ?? '—' })),
      },
      quality: {
        avgGrade: gradeAgg._avg.value ? Math.round(gradeAgg._avg.value * 100) / 100 : null,
        attendanceRate: attTotal ? Math.round((attPresent / attTotal) * 100) : null,
      },
      ai: {
        active: agentActive,
        latest: agentLatest.map((i) => ({ title: i.title, severity: i.severity })),
      },
    });
  } catch (error) {
    console.error('GET /api/v1/dashboard/domains error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить домены', 500);
  }
}
