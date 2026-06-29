import { createCrud } from '@/shared/lib/crud';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';
import { roleMatches } from '@/shared/lib/role-access';
import type { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';

const FULL_LIST_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'event_manager', 'safeguarding_lead'];

const handlers = createCrud({
  model: 'achievement',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['studentId', 'title', 'description', 'category', 'level', 'place', 'date'],
  dateFields: ['date'],
  injectUserId: 'authorId',
  orderBy: { date: 'desc' },
  filterableParams: ['studentId', 'category', 'level'],
});

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const role = auth.session.user.role as Role;
  const userId = auth.session.user.id;

  if (studentId) {
    const allowed = await canAccessStudent(role, userId, studentId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к достижениям этого ученика', 403);
  } else if (!roleMatches(FULL_LIST_ROLES, role)) {
    return errorResponse('FORBIDDEN', 'Нет доступа к полному списку достижений', 403);
  }

  try {
    const where: Record<string, string> = {};
    for (const param of ['studentId', 'category', 'level']) {
      const value = searchParams.get(param);
      if (value) where[param] = value;
    }

    const achievements = await prisma.achievement.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    return successResponse(achievements);
  } catch (error) {
    console.error('GET achievements error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить достижения', 500);
  }
}

export const { POST, DELETE } = handlers;
