import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Всешкольная статистика — только админ-тир/спец/секретарь. Учитель видит «Сегодня», не школьный дашборд.
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'specialist'],
    });
    if (auth.response) return auth.response;

    // ── Basic counts ──
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.class.count(),
    ]);

    // ── Distinct parallels (grades) ──
    const distinctGrades = await prisma.class.findMany({
      select: { grade: true },
      distinct: ['grade'],
    });
    const totalParallels = distinctGrades.length;

    // ── Today's absent students ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const absentToday = await prisma.attendance.count({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { in: ['absent', 'excused', 'trip', 'quarantine'] },
      },
    });
    const todayStudents = totalStudents - absentToday;

    // ── Percentage diffs: compare current month to last month ──
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [studentsThisMonth, studentsLastMonth, teachersThisMonth, teachersLastMonth] =
      await Promise.all([
        prisma.student.count({ where: { enrolledAt: { lt: firstOfThisMonth } } }),
        prisma.student.count({ where: { enrolledAt: { lt: firstOfLastMonth } } }),
        prisma.teacher.count(),
        prisma.teacher.count(), // no hireDate filter easily available, use 0 diff
      ]);

    const studentsDiff =
      studentsLastMonth > 0
        ? Math.round(((studentsThisMonth - studentsLastMonth) / studentsLastMonth) * 100)
        : 0;

    // Classes and parallels don't change month-to-month in practice, set to 0
    const teachersDiff = 0;
    const classesDiff = 0;
    const parallelsDiff = 0;

    // ── Low performance: students with weighted avg < 3.0 in any subject ──
    const activePeriod = await prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });

    let lowPerformance: {
      className: string;
      studentName: string;
      period: string;
      subject: string;
      average: number;
      level: string;
    }[] = [];

    if (activePeriod) {
      // Get all grades for the active period with their categories (weights)
      const grades = await prisma.grade.findMany({
        where: { periodId: activePeriod.id },
        include: {
          student: {
            include: {
              class: true,
            },
          },
          subject: true,
          category: true,
        },
      });

      // Group by student+subject, compute weighted average
      const grouped: Record<
        string,
        {
          student: (typeof grades)[0]['student'];
          subject: (typeof grades)[0]['subject'];
          totalWeightedValue: number;
          totalWeight: number;
        }
      > = {};

      for (const g of grades) {
        const key = `${g.studentId}:${g.subjectId}`;
        if (!grouped[key]) {
          grouped[key] = {
            student: g.student,
            subject: g.subject,
            totalWeightedValue: 0,
            totalWeight: 0,
          };
        }
        grouped[key].totalWeightedValue += g.value * g.category.weight;
        grouped[key].totalWeight += g.category.weight;
      }

      for (const entry of Object.values(grouped)) {
        if (entry.totalWeight === 0) continue;
        const avg = entry.totalWeightedValue / entry.totalWeight;
        if (avg < 3.0) {
          const cls = entry.student.class;
          lowPerformance.push({
            className: `${cls.grade}${cls.letter}`,
            studentName: `${entry.student.lastName} ${entry.student.firstName}`,
            period: activePeriod.name,
            subject: entry.subject.name,
            average: Math.round(avg * 100) / 100,
            level:
              avg < 2.0
                ? 'very_low'
                : avg < 2.5
                  ? 'low'
                  : 'medium',
          });
        }
      }

      // Sort by average ascending, take top 10
      lowPerformance.sort((a, b) => a.average - b.average);
      lowPerformance = lowPerformance.slice(0, 10);
    }

    // ── Medical issues: students with 3+ excused days in last 30 days ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const excusedAbsences = await prisma.attendance.findMany({
      where: {
        status: 'excused',
        date: { gte: thirtyDaysAgo },
      },
      include: {
        student: true,
      },
    });

    // Group by student, count days, keep latest known reason
    const absenceByStudent: Record<
      string,
      { student: (typeof excusedAbsences)[0]['student']; count: number; reason: string | null }
    > = {};
    for (const a of excusedAbsences) {
      if (!absenceByStudent[a.studentId]) {
        absenceByStudent[a.studentId] = { student: a.student, count: 0, reason: null };
      }
      absenceByStudent[a.studentId].count++;
      // последняя непустая причина из отметок посещаемости
      if (a.reason) absenceByStudent[a.studentId].reason = a.reason;
    }

    const medicalIssues = Object.values(absenceByStudent)
      .filter((entry) => entry.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => ({
        studentName: `${entry.student.lastName} ${entry.student.firstName}`,
        role: 'Ученик' as const,
        daysAbsent: entry.count,
        reason: entry.reason ?? 'Причина не указана',
      }));

    return successResponse({
      stats: {
        totalStudents,
        todayStudents,
        studentsDiff,
        totalTeachers,
        teachersDiff,
        totalClasses,
        classesDiff,
        totalParallels,
        parallelsDiff,
      },
      lowPerformance,
      medicalIssues,
      urgentIssues: [],
      incidents: [],
    });
  } catch (error) {
    console.error('GET /api/v1/dashboard error:', error);
    return errorResponse(
      'DASHBOARD_ERROR',
      'Failed to load dashboard data',
      500
    );
  }
}
