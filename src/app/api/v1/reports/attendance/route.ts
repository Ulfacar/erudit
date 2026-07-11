import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, canAccessBranch } from '@/shared/lib/branch-scope';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

/**
 * GET /api/v1/reports/attendance
 *
 * Returns attendance summary by student for a date range.
 * Query params: classId (required), startDate (required), endDate (required)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'curator', 'teacher'],
    });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!classId || !startDate || !endDate) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Параметры classId, startDate и endDate обязательны',
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return errorResponse('VALIDATION_ERROR', 'Неверный формат даты');
    }

    const role = auth.session.user.role;
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { branchId: true } });
    if (!cls) return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    const scope = await getBranchScope(auth.session.user.id, role, auth.session.user.branchId);
    if (!canAccessBranch(scope, cls.branchId)) return errorResponse('FORBIDDEN', 'Нет доступа к этому классу', 403);
    if (role === 'teacher' || role === 'curator') {
      const ts = await getTeacherScope(auth.session.user.id);
      if (!ts || !ts.classIds.includes(classId)) return errorResponse('FORBIDDEN', 'Нет доступа к этому классу', 403);
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

    // Get attendance records for the period
    const records = await prisma.attendance.findMany({
      where: {
        student: { classId },
        date: { gte: start, lte: end },
      },
    });

    // Calculate total school days in range (weekdays only)
    let totalSchoolDays = 0;
    const d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) totalSchoolDays++;
      d.setDate(d.getDate() + 1);
    }

    // Group attendance by student
    const attendanceByStudent = new Map<
      string,
      { present: number; absent: number; excused: number; late: number; trip: number; quarantine: number }
    >();

    for (const rec of records) {
      if (!attendanceByStudent.has(rec.studentId)) {
        attendanceByStudent.set(rec.studentId, {
          present: 0,
          absent: 0,
          excused: 0,
          late: 0,
          trip: 0,
          quarantine: 0,
        });
      }
      const entry = attendanceByStudent.get(rec.studentId)!;
      if (rec.status in entry) {
        entry[rec.status as keyof typeof entry]++;
      }
    }

    // Build rows
    const rows = students.map((student) => {
      const fullName = [student.lastName, student.firstName, student.middleName]
        .filter(Boolean)
        .join(' ');

      const att = attendanceByStudent.get(student.id) ?? {
        present: 0,
        absent: 0,
        excused: 0,
        late: 0,
        trip: 0,
        quarantine: 0,
      };

      // Days not marked as any absence type = present
      const totalAbsent = att.absent + att.excused + att.trip + att.quarantine;
      const daysPresent = totalSchoolDays - totalAbsent;
      const attendancePercent = totalSchoolDays > 0
        ? Math.round((daysPresent / totalSchoolDays) * 1000) / 10
        : 100;

      return {
        studentId: student.id,
        studentName: fullName,
        daysPresent: Math.max(0, daysPresent),
        daysAbsent: att.absent,
        daysExcused: att.excused,
        daysLate: att.late,
        daysTrip: att.trip,
        daysQuarantine: att.quarantine,
        attendancePercent,
      };
    });

    // Summary row
    const summary = {
      totalStudents: rows.length,
      totalSchoolDays,
      avgPresent: rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.daysPresent, 0) / rows.length) * 10) / 10
        : 0,
      avgAbsent: rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.daysAbsent, 0) / rows.length) * 10) / 10
        : 0,
      avgExcused: rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.daysExcused, 0) / rows.length) * 10) / 10
        : 0,
      avgLate: rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.daysLate, 0) / rows.length) * 10) / 10
        : 0,
      avgAttendancePercent: rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.attendancePercent, 0) / rows.length) * 10) / 10
        : 100,
    };

    return successResponse({
      rows,
      summary,
      totalSchoolDays,
      period: { startDate, endDate },
    });
  } catch (error) {
    console.error('GET /api/v1/reports/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сформировать отчёт по посещаемости', 500);
  }
}
