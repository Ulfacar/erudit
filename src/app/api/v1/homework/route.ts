import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhereVia } from '@/shared/lib/branch-scope';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

/**
 * GET /api/v1/homework
 * List homework assignments, filterable by classId and subjectId.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');

    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;

    // Student видит только ДЗ своего класса; parent — только классов своих детей.
    // where.classId перезаписывается — подмена classId из query params невозможна.
    const STAFF: string[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist'];
    if (!STAFF.includes(role)) {
      if (role === 'student') {
        const self = await prisma.student.findFirst({ where: { userId }, select: { classId: true } });
        if (!self) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
        where.classId = self.classId;
      } else if (role === 'parent') {
        const parent = await prisma.parent.findFirst({
          where: { userId },
          select: { children: { select: { student: { select: { classId: true } } } } },
        });
        const childClassIds = (parent?.children.map((c) => c.student.classId).filter(Boolean) ?? []) as string[];
        // If parent specified a classId and it belongs to one of their children — use it
        if (classId && childClassIds.includes(classId)) {
          where.classId = classId;
        } else {
          where.classId = { in: childClassIds };
        }
      } else {
        return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      }
    } else {
      const scope = await getBranchScope(userId, role, auth.session.user.branchId);
      const classBranchWhere = branchWhereVia(scope, 'class').class as Record<string, unknown> | undefined;
      if (classBranchWhere) {
        where.class = { ...((where.class as object | undefined) ?? {}), ...classBranchWhere };
      }
    }

    const homework = await prisma.homework.findMany({
      where,
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
        subject: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    // Статус «выполнено» (EduPage): счётчик по каждому ДЗ + отметка текущего ученика
    const hwIds = homework.map((h) => h.id);
    const completions = hwIds.length
      ? await prisma.homeworkCompletion.findMany({ where: { homeworkId: { in: hwIds } }, select: { homeworkId: true, studentId: true } })
      : [];
    const countByHw: Record<string, number> = {};
    for (const c of completions) countByHw[c.homeworkId] = (countByHw[c.homeworkId] ?? 0) + 1;

    // студентский id (для doneByMe) — только если роль student
    let myStudentId: string | null = null;
    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      myStudentId = self?.id ?? null;
    }
    // ?studentId= — флаг «выполнено» для конкретного ученика (дневник родителя/ученика)
    const sid = new URL(request.url).searchParams.get('studentId') ?? myStudentId;
    const result = homework.map((h) => ({
      ...h,
      completedCount: countByHw[h.id] ?? 0,
      done: sid ? completions.some((c) => c.homeworkId === h.id && c.studentId === sid) : false,
    }));

    return successResponse(result);
  } catch (error) {
    console.error('GET /api/v1/homework error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить домашние задания', 500);
  }
}

/**
 * POST /api/v1/homework
 * Create a homework assignment. Teachers only for their classes.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['teacher', 'curator', 'zavuch', 'super_admin'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { classId, subjectId, teacherId, description, dueDate } = body;

    if (!classId || !subjectId || !teacherId || !description || !dueDate) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Все поля обязательны: classId, subjectId, teacherId, description, dueDate',
      );
    }

    // Verify class exists
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    // Учитель/куратор задаёт ДЗ ТОЛЬКО своим классам, teacherId — из сессии (не из тела).
    const role = auth.session.user.role;
    let effectiveTeacherId = teacherId;
    if (role === 'teacher' || role === 'curator') {
      const scope = await getTeacherScope(auth.session.user.id);
      if (!scope || !scope.classIds.includes(classId)) {
        return errorResponse('FORBIDDEN', 'Нет доступа к этому классу', 403);
      }
      effectiveTeacherId = scope.teacherId;
    }

    const homework = await prisma.homework.create({
      data: {
        classId,
        subjectId,
        teacherId: effectiveTeacherId,
        description,
        dueDate: new Date(dueDate),
      },
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
        subject: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return successResponse(homework, 201);
  } catch (error) {
    console.error('POST /api/v1/homework error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать домашнее задание', 500);
  }
}
