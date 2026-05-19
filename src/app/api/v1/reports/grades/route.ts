import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { calculateWeightedAverage } from '@/modules/grading/services/weighted-average';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/reports/grades
 *
 * Returns a grade matrix for a class/subject/period.
 * Each student row contains grades grouped by category + weighted average.
 *
 * Query params: classId, subjectId, periodId (all required)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'curator', 'teacher'],
    });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const periodId = searchParams.get('periodId');

    if (!classId || !subjectId || !periodId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Параметры classId, subjectId и periodId обязательны',
      );
    }

    // Get students in the class
    const students = await prisma.student.findMany({
      where: { classId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
      },
      orderBy: { lastName: 'asc' },
    });

    // Get all non-draft grades for this class/subject/period
    const grades = await prisma.grade.findMany({
      where: {
        subjectId,
        periodId,
        status: { not: 'draft' },
        student: { classId },
      },
      include: {
        category: {
          select: { id: true, name: true, weight: true },
        },
      },
    });

    // Collect unique categories that have grades
    const categoryMap = new Map<string, { id: string; name: string; weight: number }>();
    for (const g of grades) {
      if (!categoryMap.has(g.category.id)) {
        categoryMap.set(g.category.id, g.category);
      }
    }
    const categories = Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'ru'),
    );

    // Group grades by student -> category
    const gradesByStudent = new Map<
      string,
      Map<string, number[]>
    >();
    const allGradesByStudent = new Map<
      string,
      { value: number; weight: number }[]
    >();

    for (const g of grades) {
      // By category
      if (!gradesByStudent.has(g.studentId)) {
        gradesByStudent.set(g.studentId, new Map());
      }
      const studentCats = gradesByStudent.get(g.studentId)!;
      if (!studentCats.has(g.category.id)) {
        studentCats.set(g.category.id, []);
      }
      studentCats.get(g.category.id)!.push(g.value);

      // For weighted average
      if (!allGradesByStudent.has(g.studentId)) {
        allGradesByStudent.set(g.studentId, []);
      }
      allGradesByStudent.get(g.studentId)!.push({
        value: g.value,
        weight: g.category.weight,
      });
    }

    // Build matrix rows
    const rows = students.map((student) => {
      const fullName = [student.lastName, student.firstName, student.middleName]
        .filter(Boolean)
        .join(' ');

      const studentCats = gradesByStudent.get(student.id);
      const categoryGrades: Record<string, { grades: number[]; average: number }> = {};

      for (const cat of categories) {
        const vals = studentCats?.get(cat.id) ?? [];
        const avg = vals.length > 0
          ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
          : 0;
        categoryGrades[cat.id] = { grades: vals, average: avg };
      }

      const studentGrades = allGradesByStudent.get(student.id) ?? [];
      const weightedAverage = calculateWeightedAverage(studentGrades);

      return {
        studentId: student.id,
        studentName: fullName,
        categoryGrades,
        weightedAverage,
        gradeCount: studentGrades.length,
      };
    });

    // Class summary
    const allAverages = rows.filter((r) => r.weightedAverage > 0).map((r) => r.weightedAverage);
    const classAverage = allAverages.length > 0
      ? Math.round((allAverages.reduce((s, v) => s + v, 0) / allAverages.length) * 100) / 100
      : 0;

    return successResponse({
      categories,
      rows,
      classAverage,
    });
  } catch (error) {
    console.error('GET /api/v1/reports/grades error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сформировать отчёт по оценкам', 500);
  }
}
