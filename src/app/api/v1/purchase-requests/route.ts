import { createCrud } from '@/shared/lib/crud';
import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const LIST_ROLES = ['super_admin', 'analyst', 'finance_manager', 'accountant', 'chief_accountant', 'zavhoz', 'zavuch'] as const;

const handlers = createCrud({
  model: 'purchaseRequest',
  listRoles: [...LIST_ROLES],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'],
  createFields: ['title', 'items', 'amount'],
  intFields: ['amount'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status'],
});

function formatTeacherName(teacher: { firstName: string; lastName: string; middleName: string | null } | undefined) {
  return teacher ? [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ') : null;
}

async function enrichPurchaseRequests<
  T extends {
    authorId: string | null;
    authorName: string | null;
    reviewedById?: string | null;
    signedRole?: string | null;
    reviewedAt?: Date | null;
    forwardedById?: string | null;
    forwardedRole?: string | null;
    forwardedAt?: Date | null;
  },
>(requests: T[]) {
  const userIds = Array.from(
    new Set(
      requests
        .flatMap((request) => [request.authorId, request.reviewedById, request.forwardedById])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [users, teachers] = userIds.length
    ? await Promise.all([
        prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, login: true },
        }),
        prisma.teacher.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, firstName: true, lastName: true, middleName: true },
        }),
      ])
    : [[], []];

  const teacherByUserId = new Map(teachers.map((teacher) => [teacher.userId, teacher]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return requests.map((request) => {
    const { authorId, reviewedById: _reviewedById, forwardedById: _forwardedById, ...safeRequest } = request;
    const teacherName = authorId ? formatTeacherName(teacherByUserId.get(authorId)) : null;
    const login = authorId ? userById.get(authorId)?.login : null;
    const reviewedByName = request.reviewedById
      ? formatTeacherName(teacherByUserId.get(request.reviewedById)) || userById.get(request.reviewedById)?.login || null
      : null;
    const forwardedByName = request.forwardedById
      ? formatTeacherName(teacherByUserId.get(request.forwardedById)) || userById.get(request.forwardedById)?.login || null
      : null;

    return {
      ...safeRequest,
      authorName: request.authorName || teacherName || login || null,
      reviewedByName,
      reviewedRole: request.signedRole ?? null,
      reviewedAt: request.reviewedAt ?? null,
      forwardedByName,
      forwardedRole: request.forwardedRole ?? null,
      forwardedAt: request.forwardedAt ?? null,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...LIST_ROLES] });
    if (auth.response) return auth.response;

    const status = request.nextUrl.searchParams.get('status');
    const rows = await prisma.purchaseRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(await enrichPurchaseRequests(rows));
  } catch (error) {
    console.error('GET purchaseRequest error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить данные', 500);
  }
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
