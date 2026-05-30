import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

/**
 * Заявления-онлайн / записка об отсутствии (EduPage, Модуль 4).
 * Родитель/ученик подаёт → завуч/учитель видит входящие по своим классам и согласует.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const where: Record<string, unknown> = {};
    const status = new URL(request.url).searchParams.get('status');
    if (status) where.status = status;

    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      where.studentId = self.id;
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({ where: { userId }, select: { children: { select: { studentId: true } } } });
      where.studentId = { in: parent?.children.map((c) => c.studentId) ?? [] };
    } else if (role === 'teacher' || role === 'curator') {
      const scope = await getTeacherScope(userId);
      if (!scope) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      where.classId = { in: scope.classIds };
    }
    // zavuch/analyst/super_admin/secretary — видят все

    const apps = await prisma.application.findMany({ where, orderBy: { createdAt: 'desc' } });

    // подтянуть имена учеников
    const ids = [...new Set(apps.map((a) => a.studentId))];
    const students = await prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } } } });
    const map = new Map(students.map((s) => [s.id, s]));
    const data = apps.map((a) => {
      const s = map.get(a.studentId);
      return { ...a, studentName: s ? `${s.lastName} ${s.firstName}` : '—', className: s?.class ? `${s.class.grade}${s.class.letter}` : '' };
    });
    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/applications error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить заявления', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['parent', 'student'] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const body = await request.json();
    const { type, reason, fromDate, toDate } = body;
    let { studentId } = body;
    if (!reason || !fromDate) return errorResponse('VALIDATION_ERROR', 'Поля reason и fromDate обязательны');

    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true, classId: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Профиль ученика не найден', 403);
      studentId = self.id;
    } else {
      if (!studentId) return errorResponse('VALIDATION_ERROR', 'Укажите ребёнка (studentId)');
      const link = await prisma.parentStudent.findFirst({ where: { studentId, parent: { userId } }, select: { studentId: true } });
      if (!link) return errorResponse('FORBIDDEN', 'Это не ваш ребёнок', 403);
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });

    const app = await prisma.application.create({
      data: {
        type: type ?? 'absence',
        studentId,
        classId: student?.classId ?? null,
        authorId: userId,
        reason,
        fromDate: new Date(fromDate),
        toDate: toDate ? new Date(toDate) : null,
      },
    });
    return successResponse(app, 201);
  } catch (error) {
    console.error('POST /api/v1/applications error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось подать заявление', 500);
  }
}
