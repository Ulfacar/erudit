import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhere, branchWhereVia } from '@/shared/lib/branch-scope';

export async function GET(request: NextRequest) {
  try {
    // Общешкольная сводка по успеваемости всех классов — управленческий отчёт.
    // teacher/curator убраны: рядовому педагогу он давал успеваемость всех классов
    // школы. Потребитель в UI — страница /grading (роли super_admin/analyst/zavuch).
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch'],
    });
    if (auth.response) return auth.response;

    // Сводка ограничена филиалом сотрудника (fail-closed, если филиала нет).
    const bscope = await getBranchScope(
      auth.session.user.id,
      auth.session.user.role,
      auth.session.user.branchId,
    );
    if (bscope.closed) {
      return errorResponse('FORBIDDEN', 'Филиал не определён', 403);
    }
    const classWhere = branchWhere(bscope);

    // Get all classes with curator and student count
    const classes = await prisma.class.findMany({
      where: classWhere,
      include: {
        level: true,
        curator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
    });

    // Get all active periods (trimesters/semesters)
    const periods = await prisma.academicPeriod.findMany({
      where: { type: 'trimester' },
      orderBy: { startDate: 'asc' },
    });

    // Get grade counts grouped by class (via student -> class)
    // We'll fetch all grades and aggregate in JS for simplicity
    const allGrades = await prisma.grade.findMany({
      where: { ...branchWhereVia(bscope, 'student') },
      select: {
        value: true,
        periodId: true,
        student: {
          select: { classId: true },
        },
      },
    });

    // Build grade summary per class per period
    const gradeSummaryMap = new Map<
      string,
      Map<string, { fives: number; fours: number; threes: number; twos: number; ones: number }>
    >();

    for (const g of allGrades) {
      const classId = g.student.classId;
      const periodId = g.periodId;

      if (!gradeSummaryMap.has(classId)) {
        gradeSummaryMap.set(classId, new Map());
      }
      const classMap = gradeSummaryMap.get(classId)!;
      if (!classMap.has(periodId)) {
        classMap.set(periodId, { fives: 0, fours: 0, threes: 0, twos: 0, ones: 0 });
      }
      const summary = classMap.get(periodId)!;

      if (g.value === 5) summary.fives++;
      else if (g.value === 4) summary.fours++;
      else if (g.value === 3) summary.threes++;
      else if (g.value === 2) summary.twos++;
      else if (g.value === 1) summary.ones++;
    }

    // Get today's attendance per class
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await prisma.attendance.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
        ...branchWhereVia(bscope, 'student'),
      },
      select: {
        studentId: true,
        status: true,
        student: {
          select: { classId: true },
        },
      },
    });

    // Build attendance map per class
    const attendanceMap = new Map<string, { present: number; absent: number }>();
    for (const a of todayAttendance) {
      const classId = a.student.classId;
      if (!attendanceMap.has(classId)) {
        attendanceMap.set(classId, { present: 0, absent: 0 });
      }
      const att = attendanceMap.get(classId)!;
      if (a.status === 'present') {
        att.present++;
      } else {
        att.absent++;
      }
    }

    // Build response
    const data = classes.map((c) => {
      const classGrades = gradeSummaryMap.get(c.id);
      const gradeSummary: Record<
        string,
        { fives: number; fours: number; threes: number; twos: number; ones: number }
      > = {};

      if (classGrades) {
        for (const [periodId, summary] of classGrades) {
          gradeSummary[periodId] = summary;
        }
      }

      const att = attendanceMap.get(c.id);

      return {
        id: c.id,
        grade: c.grade,
        letter: c.letter,
        levelId: c.levelId,
        level: c.level,
        studentCount: c._count.students,
        curatorId: c.curatorId,
        curator: c.curator,
        gradeSummary,
        attendance: {
          present: att?.present ?? c._count.students,
          absent: att?.absent ?? 0,
          total: c._count.students,
        },
      };
    });

    return successResponse({
      classes: data,
      periods: periods.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
    });
  } catch (error) {
    console.error('GET /api/v1/grading/overview error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить обзор оценок', 500);
  }
}
