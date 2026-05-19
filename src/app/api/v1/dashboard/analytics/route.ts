import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'curator'],
    });
    if (auth.response) return auth.response;

    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });

    if (!activePeriod) {
      return successResponse({
        classByAverage: [],
        weeklyAttendance: 0,
        topLowStudents: [],
      });
    }

    // ── 1. Average grade per class ──
    const grades = await prisma.grade.findMany({
      where: { periodId: activePeriod.id },
      include: {
        student: {
          include: { class: true },
        },
        category: true,
      },
    });

    // Group by class, compute weighted average
    const classTotals: Record<
      string,
      { className: string; totalWeighted: number; totalWeight: number }
    > = {};

    for (const g of grades) {
      const cls = g.student.class;
      const key = cls.id;
      if (!classTotals[key]) {
        classTotals[key] = {
          className: `${cls.grade}${cls.letter}`,
          totalWeighted: 0,
          totalWeight: 0,
        };
      }
      classTotals[key].totalWeighted += g.value * g.category.weight;
      classTotals[key].totalWeight += g.category.weight;
    }

    const classByAverage = Object.values(classTotals)
      .map((c) => ({
        className: c.className,
        average:
          c.totalWeight > 0
            ? Math.round((c.totalWeighted / c.totalWeight) * 100) / 100
            : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className, 'ru'));

    // ── 2. Weekly attendance percentage ──
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const [totalAttendance, presentCount] = await Promise.all([
      prisma.attendance.count({
        where: { date: { gte: weekAgo, lte: now } },
      }),
      prisma.attendance.count({
        where: {
          date: { gte: weekAgo, lte: now },
          status: 'present',
        },
      }),
    ]);

    const weeklyAttendance =
      totalAttendance > 0
        ? Math.round((presentCount / totalAttendance) * 1000) / 10
        : 0;

    // ── 3. Top low-performing students ──
    // Group grades by student, compute overall weighted average
    const studentTotals: Record<
      string,
      {
        name: string;
        className: string;
        totalWeighted: number;
        totalWeight: number;
      }
    > = {};

    for (const g of grades) {
      const key = g.studentId;
      if (!studentTotals[key]) {
        const cls = g.student.class;
        studentTotals[key] = {
          name: `${g.student.lastName} ${g.student.firstName}`,
          className: `${cls.grade}${cls.letter}`,
          totalWeighted: 0,
          totalWeight: 0,
        };
      }
      studentTotals[key].totalWeighted += g.value * g.category.weight;
      studentTotals[key].totalWeight += g.category.weight;
    }

    const topLowStudents = Object.values(studentTotals)
      .map((s) => ({
        name: s.name,
        class: s.className,
        avg:
          s.totalWeight > 0
            ? Math.round((s.totalWeighted / s.totalWeight) * 100) / 100
            : 0,
      }))
      .filter((s) => s.avg > 0 && s.avg < 3.5)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 10);

    return successResponse({
      classByAverage,
      weeklyAttendance,
      topLowStudents,
    });
  } catch (error) {
    console.error('GET /api/v1/dashboard/analytics error:', error);
    return errorResponse(
      'ANALYTICS_ERROR',
      'Failed to load analytics data',
      500,
    );
  }
}
