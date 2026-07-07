import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhereVia, getBranchScope } from '@/shared/lib/branch-scope';
import { countSessionsDone } from '@/modules/zvr/supervision';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const studentId = request.nextUrl.searchParams.get('studentId')?.trim();
    const incidentId = request.nextUrl.searchParams.get('incidentId')?.trim();
    const includeClosed = request.nextUrl.searchParams.get('includeClosed') === '1';

    const where: Prisma.SupervisionCaseWhereInput = {};
    if (!includeClosed) where.closedAt = null;
    if (studentId) where.studentId = studentId;
    if (incidentId) where.behaviorIncidentId = incidentId;

    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
      Object.assign(where, branchWhereVia(scope, 'student'));
    }

    const cases = await prisma.supervisionCase.findMany({
      where,
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
        incident: {
          select: {
            id: true,
            type: true,
            level: true,
            status: true,
          },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });

    const data = await Promise.all(
      cases.map(async (item) => ({
        ...item,
        sessionsDone: await countSessionsDone(prisma, item.studentId, item.openedAt),
        student: {
          id: item.student.id,
          fio: fio(item.student),
          class: item.student.class ? `${item.student.class.grade}${item.student.class.letter}` : null,
          firstName: item.student.firstName,
          lastName: item.student.lastName,
          middleName: item.student.middleName,
        },
      })),
    );

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/zvr/supervision error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить карту сопровождения', 500);
  }
}
