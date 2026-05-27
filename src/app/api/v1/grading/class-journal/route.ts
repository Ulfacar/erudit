import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/grading/class-journal?classId=X&periodId=Y
 *
 * Returns students with their grades grouped by subject,
 * attendance summary (absences, lates), and weighted averages per subject.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const periodId = searchParams.get('periodId');

    if (!classId) {
      return errorResponse('VALIDATION_ERROR', 'Параметр classId обязателен');
    }

    // RBAC: staff may view any class; a student may only view their own class,
    // a parent only their children's classes. Without this, anyone could read any
    // class roster + grades by passing an arbitrary classId.
    const STAFF: string[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist'];
    if (!STAFF.includes(role)) {
      let owns = false;
      if (role === 'student') {
        const self = await prisma.student.findFirst({ where: { userId }, select: { classId: true } });
        owns = self?.classId === classId;
      } else if (role === 'parent') {
        const parent = await prisma.parent.findFirst({
          where: { userId },
          select: { children: { select: { student: { select: { classId: true } } } } },
        });
        owns = !!parent?.children.some((c) => c.student.classId === classId);
      }
      if (!owns) {
        return errorResponse('FORBIDDEN', 'Нет доступа к журналу этого класса', 403);
      }
    }

    // 1. Get class info
    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        level: true,
        curator: {
          select: { id: true, firstName: true, lastName: true, middleName: true },
        },
      },
    });

    if (!classInfo) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    // 2. Get students in the class
    const students = await prisma.student.findMany({
      where: { classId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photo: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // 3. Get subjects taught in this class
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classId },
      include: {
        subject: { select: { id: true, name: true, color: true } },
      },
    });

    const seen = new Set<string>();
    const subjects: { id: string; name: string; color: string | null }[] = [];
    for (const ts of teacherSubjects) {
      if (!seen.has(ts.subject.id)) {
        seen.add(ts.subject.id);
        subjects.push(ts.subject);
      }
    }
    subjects.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    // 4. Get all grades for students in this class, optionally filtered by period
    const gradeWhere: Record<string, unknown> = {
      studentId: { in: students.map((s) => s.id) },
    };
    if (periodId) {
      gradeWhere.periodId = periodId;
    }
    // Родитель/ученик видят только опубликованные оценки
    if (role === 'parent' || role === 'student') {
      gradeWhere.status = 'published';
    }

    const allGrades = await prisma.grade.findMany({
      where: gradeWhere,
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        value: true,
        scale: true,
        comment: true,
        status: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        categoryId: true,
        category: { select: { id: true, name: true, weight: true } },
      },
      orderBy: { date: 'asc' },
    });

    // 5. Get attendance for all students (all time for summary)
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    // 6. Build attendance summary per student
    const attendanceSummary = new Map<string, { absences: number; lates: number }>();
    for (const a of attendanceRecords) {
      if (!attendanceSummary.has(a.studentId)) {
        attendanceSummary.set(a.studentId, { absences: 0, lates: 0 });
      }
      const summary = attendanceSummary.get(a.studentId)!;
      if (a.status === 'absent' || a.status === 'excused') {
        summary.absences++;
      } else if (a.status === 'late') {
        summary.lates++;
      }
    }

    // 7. Build grades grouped by student -> subject
    // Each entry: { grades: GradeEntry[], average: number, count: number }
    interface JournalGradeRow {
      id: string;
      value: number;
      scale: 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER';
      comment: string | null;
      status: 'draft' | 'submitted' | 'moderated' | 'published';
      date: string;
      createdAt: string;
      updatedAt: string;
      categoryName: string;
      weight: number;
    }

    const gradesByStudentSubject = new Map<string, Map<string, {
      grades: JournalGradeRow[];
      weightedSum: number;
      weightTotal: number;
    }>>();

    for (const g of allGrades) {
      const key = g.studentId;
      if (!gradesByStudentSubject.has(key)) {
        gradesByStudentSubject.set(key, new Map());
      }
      const studentMap = gradesByStudentSubject.get(key)!;
      if (!studentMap.has(g.subjectId)) {
        studentMap.set(g.subjectId, { grades: [], weightedSum: 0, weightTotal: 0 });
      }
      const entry = studentMap.get(g.subjectId)!;
      entry.grades.push({
        id: g.id,
        value: g.value,
        scale: g.scale,
        comment: g.comment,
        status: g.status,
        date: g.date.toISOString(),
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        categoryName: g.category.name,
        weight: g.category.weight,
      });
      // В средневзвешенный учитываем только опубликованные оценки
      if (g.status === 'published' || g.status === 'moderated') {
        entry.weightedSum += g.value * g.category.weight;
        entry.weightTotal += g.category.weight;
      }
    }

    // 8. Build response
    const studentData = students.map((student) => {
      const att = attendanceSummary.get(student.id) || { absences: 0, lates: 0 };
      const studentGrades = gradesByStudentSubject.get(student.id);

      const subjectGrades: Record<string, {
        average: number;
        count: number;
        grades: JournalGradeRow[];
      }> = {};

      // Compute overall average across all subjects
      let totalWeightedSum = 0;
      let totalWeightCount = 0;

      for (const subj of subjects) {
        const entry = studentGrades?.get(subj.id);
        if (entry && entry.grades.length > 0) {
          const avg = entry.weightTotal > 0 ? entry.weightedSum / entry.weightTotal : 0;
          subjectGrades[subj.id] = {
            average: Math.round(avg * 100) / 100,
            count: entry.grades.length,
            grades: entry.grades,
          };
          totalWeightedSum += entry.weightedSum;
          totalWeightCount += entry.weightTotal;
        } else {
          subjectGrades[subj.id] = {
            average: 0,
            count: 0,
            grades: [],
          };
        }
      }

      const overallAverage = totalWeightCount > 0
        ? Math.round((totalWeightedSum / totalWeightCount) * 100) / 100
        : 0;

      // Performance level based on overall average
      let performanceLevel: string;
      let performanceColor: string;
      if (overallAverage === 0) {
        performanceLevel = 'НЕТ ДАННЫХ';
        performanceColor = 'gray';
      } else if (overallAverage >= 4.5) {
        performanceLevel = 'ОТЛИЧНАЯ';
        performanceColor = 'green';
      } else if (overallAverage >= 3.5) {
        performanceLevel = 'ХОРОШАЯ';
        performanceColor = 'blue';
      } else if (overallAverage >= 2.8) {
        performanceLevel = 'СРЕДНЯЯ';
        performanceColor = 'yellow';
      } else if (overallAverage >= 2.0) {
        performanceLevel = 'НИЗКАЯ';
        performanceColor = 'orange';
      } else {
        performanceLevel = 'ОЧЕНЬ НИЗКАЯ';
        performanceColor = 'red';
      }

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        photo: student.photo,
        absences: att.absences,
        lates: att.lates,
        overallAverage,
        performanceLevel,
        performanceColor,
        subjectGrades,
      };
    });

    // 9. Get periods for filter
    const periods = await prisma.academicPeriod.findMany({
      where: { type: 'trimester' },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    return successResponse({
      classInfo: {
        id: classInfo.id,
        grade: classInfo.grade,
        letter: classInfo.letter,
        level: classInfo.level,
        curator: classInfo.curator,
      },
      students: studentData,
      subjects,
      periods,
    });
  } catch (error) {
    console.error('GET /api/v1/grading/class-journal error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить журнал класса', 500);
  }
}
