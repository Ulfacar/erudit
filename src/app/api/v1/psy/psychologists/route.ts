import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

function displayName(user: {
  login: string;
  teacher: { firstName: string; lastName: string; middleName: string | null } | null;
}) {
  const fio = user.teacher
    ? [user.teacher.lastName, user.teacher.firstName, user.teacher.middleName].filter(Boolean).join(' ')
    : '';
  return fio || user.login;
}

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  try {
    const users = await prisma.user.findMany({
      where: { role: { in: CASE_OWNER_ROLES }, isActive: true },
      select: {
        id: true,
        login: true,
        role: true,
        teacher: { select: { firstName: true, lastName: true, middleName: true } },
      },
      orderBy: [{ login: 'asc' }],
    });

    return successResponse(users.map((user) => ({
      id: user.id,
      login: user.login,
      role: user.role,
      name: displayName(user),
    })));
  } catch (e) {
    console.error('GET psy/psychologists error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to load psychologists', 500);
  }
}
