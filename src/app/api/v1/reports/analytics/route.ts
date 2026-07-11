import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { calculateWeightedAverage } from '@/modules/grading/services/weighted-average';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';

/**
 * GET /api/v1/reports/analytics
 *
 * Returns aggregated analytics data:
 * - averageByClass: average grade per class
 * - averageByTrimester: average per academic period (trimester)
 * - gradeDistribution: count of 5/4/3/2/1 grades
 * - teacherRatings: average student grade per teacher
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const bw = branchWhere(scope);

    // ── 1. Average by class ──
    const allGradesWithClass = await prisma.grade.findMany({
      where: { status: { not: 'draft' }, ...(Object.keys(bw).length ? { student: bw } : {}) },
      include: {
        student: {
          include: { class: true },
        },
        category: { select: { weight: true } },
      },
    });

    // Group by class
    const gradesByClass = new Map<
      string,
      { className: string; grades: { value: number; weight: number }[] }
    >();

    for (const g of allGradesWithClass) {
      const cls = g.student.class;
      const key = cls.id;
      const className = `${cls.grade}${cls.letter}`;

      if (!gradesByClass.has(key)) {
        gradesByClass.set(key, { className, grades: [] });
      }
      gradesByClass.get(key)!.grades.push({
        value: g.value,
        weight: g.category.weight,
      });
    }

    const averageByClass = Array.from(gradesByClass.values())
      .map((entry) => ({
        className: entry.className,
        average: calculateWeightedAverage(entry.grades),
        gradeCount: entry.grades.length,
      }))
      .sort((a, b) => a.className.localeCompare(b.className, 'ru'));

    // ── 2. Average by trimester ──
    const periods = await prisma.academicPeriod.findMany({
      where: { type: 'trimester' },
      orderBy: { startDate: 'asc' },
    });

    const gradesByPeriod = new Map<
      string,
      { value: number; weight: number }[]
    >();

    for (const g of allGradesWithClass) {
      if (!gradesByPeriod.has(g.periodId)) {
        gradesByPeriod.set(g.periodId, []);
      }
      gradesByPeriod.get(g.periodId)!.push({
        value: g.value,
        weight: g.category.weight,
      });
    }

    const averageByTrimester = periods.map((p) => {
      const periodGrades = gradesByPeriod.get(p.id) ?? [];
      return {
        periodId: p.id,
        periodName: p.name,
        average: calculateWeightedAverage(periodGrades),
        gradeCount: periodGrades.length,
      };
    });

    // ── 3. Grade distribution ──
    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const g of allGradesWithClass) {
      if (g.value >= 1 && g.value <= 5) {
        distribution[g.value]++;
      }
    }

    const gradeDistribution = [
      { grade: 5, count: distribution[5], label: 'Отлично' },
      { grade: 4, count: distribution[4], label: 'Хорошо' },
      { grade: 3, count: distribution[3], label: 'Удовлетворительно' },
      { grade: 2, count: distribution[2], label: 'Неудовлетворительно' },
      { grade: 1, count: distribution[1], label: 'Не аттестован' },
    ];

    // ── 4. Teacher ratings ──
    const gradesByTeacher = new Map<
      string,
      {
        teacherId: string;
        teacherName: string;
        grades: { value: number; weight: number }[];
      }
    >();

    const allGradesWithTeacher = await prisma.grade.findMany({
      where: { status: { not: 'draft' }, ...(Object.keys(bw).length ? { student: bw } : {}) },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, middleName: true },
        },
        category: { select: { weight: true } },
      },
    });

    for (const g of allGradesWithTeacher) {
      const t = g.teacher;
      if (!gradesByTeacher.has(t.id)) {
        const name = [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ');
        gradesByTeacher.set(t.id, {
          teacherId: t.id,
          teacherName: name,
          grades: [],
        });
      }
      gradesByTeacher.get(t.id)!.grades.push({
        value: g.value,
        weight: g.category.weight,
      });
    }

    const teacherRatings = Array.from(gradesByTeacher.values())
      .map((entry) => ({
        teacherId: entry.teacherId,
        teacherName: entry.teacherName,
        average: calculateWeightedAverage(entry.grades),
        gradeCount: entry.grades.length,
      }))
      .sort((a, b) => b.average - a.average);

    return successResponse({
      averageByClass,
      averageByTrimester,
      gradeDistribution,
      teacherRatings,
    });
  } catch (error) {
    console.error('GET /api/v1/reports/analytics error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить аналитику', 500);
  }
}
