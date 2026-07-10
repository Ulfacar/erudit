import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { roleMatches } from '@/shared/lib/role-access';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

const READ_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'];
const CREATE_ROLES: Role[] = ['super_admin', 'zavuch', 'teacher', 'curator'];
const SELF_ROLES: Role[] = ['teacher', 'curator'];
const ADMIN_CREATE_ROLES: Role[] = ['super_admin', 'zavuch'];

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUserTeacherName(teacher: { firstName: string; lastName: string; middleName: string | null } | undefined) {
  return teacher ? [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ') : null;
}

async function enrichTimeOffRequests<
  T extends {
    teacherId: string;
    substituteTeacherId: string | null;
    reviewedById?: string | null;
    signedRole?: string | null;
    reviewedAt?: Date | null;
  },
>(
  requests: T[],
) {
  const teacherIds = Array.from(
    new Set(
      requests
        .flatMap((request) => [request.teacherId, request.substituteTeacherId])
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const reviewerIds = Array.from(
    new Set(requests.map((request) => request.reviewedById).filter((id): id is string => Boolean(id))),
  );

  const [teachers, reviewers, reviewerTeachers] = await Promise.all([
    teacherIds.length
      ? prisma.teacher.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, firstName: true, lastName: true, middleName: true, position: true },
        })
      : [],
    reviewerIds.length
      ? prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, login: true },
        })
      : [],
    reviewerIds.length
      ? prisma.teacher.findMany({
          where: { userId: { in: reviewerIds } },
          select: { userId: true, firstName: true, lastName: true, middleName: true },
        })
      : [],
  ]);

  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const reviewerTeacherMap = new Map(reviewerTeachers.map((teacher) => [teacher.userId, teacher]));

  return requests.map((request) => ({
    ...request,
    teacher: teacherMap.get(request.teacherId) ?? null,
    substituteTeacher: request.substituteTeacherId
      ? teacherMap.get(request.substituteTeacherId) ?? null
      : null,
    reviewedByName: request.reviewedById
      ? formatUserTeacherName(reviewerTeacherMap.get(request.reviewedById)) || reviewerMap.get(request.reviewedById)?.login || null
      : null,
    reviewedRole: request.signedRole ?? null,
    reviewedAt: request.reviewedAt ?? null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: READ_ROLES });
    if (auth.response) return auth.response;

    const role = auth.session.user.role as Role;
    const userId = auth.session.user.id;
    const { searchParams } = request.nextUrl;
    const where: { teacherId?: string; status?: string } = {};

    if (roleMatches(SELF_ROLES, role)) {
      const scope = await getTeacherScope(userId);
      if (!scope) return successResponse([]);
      where.teacherId = scope.teacherId;
    } else {
      const status = searchParams.get('status');
      const teacherId = searchParams.get('teacherId');
      if (status) where.status = status;
      if (teacherId) where.teacherId = teacherId;
    }

    const requests = await prisma.timeOffRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(await enrichTimeOffRequests(requests));
  } catch (error) {
    console.error('GET /api/v1/time-off error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить заявки на отгул', 500);
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

    if (!date || !Number.isInteger(hours) || hours <= 0) {
      return errorResponse('VALIDATION_ERROR', 'Поля date и hours обязательны');
    }

    let teacherId: string | null = null;

    if (roleMatches(SELF_ROLES, role)) {
      const scope = await getTeacherScope(auth.session.user.id);
      if (!scope) {
        return errorResponse('VALIDATION_ERROR', 'Профиль педагога не найден');
      }
      teacherId = scope.teacherId;
    } else if (roleMatches(ADMIN_CREATE_ROLES, role)) {
      teacherId = typeof body.teacherId === 'string' && body.teacherId ? body.teacherId : null;
      if (!teacherId) {
        return errorResponse('VALIDATION_ERROR', 'Поле teacherId обязательно');
      }
    }

    if (!teacherId) {
      return errorResponse('VALIDATION_ERROR', 'Профиль педагога не найден');
    }

    const created = await prisma.timeOffRequest.create({
      data: {
        teacherId,
        date,
        hours,
        reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null,
        status: 'pending',
      },
    });

    const [enriched] = await enrichTimeOffRequests([created]);
    return successResponse(enriched, 201);
  } catch (error) {
    console.error('POST /api/v1/time-off error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать заявку на отгул', 500);
  }
}
