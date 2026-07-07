import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhereVia, getBranchScope } from '@/shared/lib/branch-scope';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];
const INCIDENT_STATUSES = ['pending', 'moderated', 'resolved'] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const status = request.nextUrl.searchParams.get('status')?.trim();
    if (status && !INCIDENT_STATUSES.includes(status as (typeof INCIDENT_STATUSES)[number])) {
      return errorResponse('BAD_REQUEST', 'Недопустимый статус', 400);
    }

    const where: Prisma.BehaviorIncidentWhereInput = {};
    if (status) where.status = status as Prisma.BehaviorIncidentWhereInput['status'];

    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
      Object.assign(where, branchWhereVia(scope, 'student'));
    }

    const incidents = await prisma.behaviorIncident.findMany({
      where,
      take: 200,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            class: { select: { grade: true, letter: true } },
          },
        },
        participants: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                class: { select: { grade: true, letter: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(incidents);
  } catch (error) {
    console.error('GET /api/v1/zvr/incidents error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить инциденты', 500);
  }
}
