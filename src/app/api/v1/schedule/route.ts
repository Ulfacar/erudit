import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { checkConflicts } from '@/modules/schedule/services/conflict-checker';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const { searchParams } = request.nextUrl;
    let classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const dayOfWeek = searchParams.get('dayOfWeek');

    // Privacy учителя: видит только свои классы. teacherId из query игнорируем —
    // берём собственный из сессии. Чужой classId → 403 (не пустой массив, чтобы не маскировать).
    let scopedTeacherId: string | null = null;
    if (role === 'teacher' || role === 'curator') {
      const scope = await getTeacherScope(userId);
      if (!scope) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      if (classId && !scope.classIds.includes(classId)) {
        return errorResponse('FORBIDDEN', 'Нет доступа к расписанию этого класса', 403);
      }
      if (!classId) scopedTeacherId = scope.teacherId; // по умолчанию — своё расписание
    }

    // Student/parent: принудительно ограничиваем classId своим/детским классом
    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { classId: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      classId = self.classId;
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        select: { children: { select: { student: { select: { classId: true } } } } },
      });
      const childClassIds = (parent?.children.map((c) => c.student.classId).filter(Boolean) ?? []) as string[];
      if (!classId || !childClassIds.includes(classId)) {
        classId = childClassIds[0] ?? null;
      }
    }

    if (!classId && !scopedTeacherId && !teacherId) {
      return errorResponse('VALIDATION_ERROR', 'Необходимо указать classId или teacherId');
    }

    const where: Record<string, unknown> = {};

    if (classId) where.classId = classId;
    if (scopedTeacherId) {
      // учитель без явного класса — только своё расписание (query teacherId игнорируем)
      where.teacherId = scopedTeacherId;
    } else if (teacherId) {
      where.teacherId = teacherId;
    }
    if (dayOfWeek) where.dayOfWeek = Number(dayOfWeek);
    if (periodStart && periodEnd) {
      where.periodStart = { lte: new Date(periodEnd) };
      where.periodEnd = { gte: new Date(periodStart) };
    }

    const entries = await prisma.scheduleEntry.findMany({
      where,
      include: {
        class: { select: { id: true, grade: true, letter: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        subject: { select: { id: true, name: true, color: true } },
        slot: { select: { id: true, slotNumber: true, startTime: true, endTime: true, type: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { slot: { slotNumber: 'asc' } }],
    });

    return successResponse(entries);
  } catch (error) {
    console.error('GET /api/v1/schedule error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить расписание', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { classId, teacherId, subjectId, slotId, dayOfWeek, periodStart, periodEnd } = body;

    if (!classId || !teacherId || !subjectId || !slotId || !dayOfWeek || !periodStart || !periodEnd) {
      return errorResponse('VALIDATION_ERROR', 'Все поля обязательны: classId, teacherId, subjectId, slotId, dayOfWeek, periodStart, periodEnd');
    }

    // Check for teacher conflicts
    const conflicts = await checkConflicts(
      teacherId,
      Number(dayOfWeek),
      slotId,
      new Date(periodStart),
      new Date(periodEnd),
    );

    if (conflicts.length > 0) {
      return errorResponse(
        'CONFLICT',
        `Конфликт: педагог уже занят в это время (${conflicts.map((c) => `${c.class.grade}${c.class.letter} — ${c.subject.name}`).join(', ')})`,
        409,
      );
    }

    const entry = await prisma.scheduleEntry.create({
      data: {
        classId,
        teacherId,
        subjectId,
        slotId,
        dayOfWeek: Number(dayOfWeek),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
      include: {
        class: { select: { id: true, grade: true, letter: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        subject: { select: { id: true, name: true, color: true } },
        slot: { select: { id: true, slotNumber: true, startTime: true, endTime: true, type: true } },
      },
    });

    return successResponse(entry, 201);
  } catch (error) {
    console.error('POST /api/v1/schedule error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать запись расписания', 500);
  }
}
