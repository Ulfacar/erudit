import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { roleMatches } from '@/shared/lib/role-access';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

const READ_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'];
const CREATE_ROLES: Role[] = ['super_admin', 'zavuch', 'teacher', 'curator'];
const SELF_ROLES: Role[] = ['teacher', 'curator'];
const ADMIN_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch'];

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function enrichTeacherHours<T extends { teacherId: string }>(items: T[]) {
  const teacherIds = Array.from(new Set(items.map((item) => item.teacherId)));

  const teachers = teacherIds.length
    ? await prisma.teacher.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, firstName: true, lastName: true, middleName: true, position: true },
      })
    : [];

  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));

  return items.map((item) => ({
    ...item,
    teacher: teacherMap.get(item.teacherId) ?? null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: READ_ROLES });
    if (auth.response) return auth.response;

    const role = auth.session.user.role as Role;
    const userId = auth.session.user.id;
    const { searchParams } = request.nextUrl;
    const where: { teacherId?: string } = {};

    if (roleMatches(SELF_ROLES, role)) {
      const scope = await getTeacherScope(userId);
      if (!scope) return successResponse([]);
      where.teacherId = scope.teacherId;
    } else {
      const teacherId = searchParams.get('teacherId');
      if (teacherId) where.teacherId = teacherId;
    }

    const items = await prisma.teacherHours.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return successResponse(await enrichTeacherHours(items));
  } catch (error) {
    console.error('GET /api/v1/teacher-hours error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить часы присутствия', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: CREATE_ROLES });
    if (auth.response) return auth.response;

    const role = auth.session.user.role as Role;
    const body = await request.json().catch(() => ({}));
    const date = parseDate(body.date);
    const hours = Number(body.hours);

    if (!date || !Number.isInteger(hours) || hours <= 0 || hours > 24) {
      return errorResponse('VALIDATION_ERROR', 'Поля date и hours обязательны, hours должен быть целым числом от 1 до 24');
    }

    let teacherId: string | null = null;

    if (roleMatches(SELF_ROLES, role)) {
      const scope = await getTeacherScope(auth.session.user.id);
      if (!scope) {
        return errorResponse('VALIDATION_ERROR', 'Профиль педагога не найден');
      }
      teacherId = scope.teacherId;
    } else if (roleMatches(ADMIN_ROLES, role)) {
      teacherId = typeof body.teacherId === 'string' && body.teacherId ? body.teacherId : null;
      if (!teacherId) {
        return errorResponse('VALIDATION_ERROR', 'Поле teacherId обязательно');
      }
    }

    if (!teacherId) {
      return errorResponse('VALIDATION_ERROR', 'Профиль педагога не найден');
    }

    const created = await prisma.teacherHours.create({
      data: {
        teacherId,
        date,
        hours,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
      },
    });

    const [enriched] = await enrichTeacherHours([created]);
    return successResponse(enriched, 201);
  } catch (error) {
    console.error('POST /api/v1/teacher-hours error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать запись часов присутствия', 500);
  }
}
