import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { caseWhereForScope, getPsyScope, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { getBranchScope } from '@/shared/lib/branch-scope';
import { branchAllowed, hasPsyCrossBranch, subjectBranchIds } from '@/shared/lib/psy-branch';

type SubjectCardType = 'parent' | 'teacher';

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as SubjectCardType | null;
  const id = searchParams.get('id');

  if (!type || !['parent', 'teacher'].includes(type) || !id) {
    return errorResponse('VALIDATION_ERROR', 'Нужны type=parent|teacher и id');
  }

  try {
    const userId = auth.session.user.id;
    const role = auth.session.user.role;
    const scope = getPsyScope(userId, role);
    const branchScope = await getBranchScope(userId, role, auth.session.user.branchId);
    const cross = await hasPsyCrossBranch(userId);
    const bIds = await subjectBranchIds(type, id);
    if (!branchAllowed(branchScope, bIds, cross)) {
      return errorResponse('FORBIDDEN', 'Нет доступа к субъекту', 403);
    }
    const scopeWhere = await caseWhereForScope(scope);
    const appointmentWhere = {
      withType: type,
      withId: id,
      ...(!branchScope.canSeeAll && !cross && branchScope.branchId ? { branchId: branchScope.branchId } : {}),
    };

    const [cases, appointments, parent] = await Promise.all([
      prisma.psyCase.findMany({
        where: { AND: [scopeWhere, { subjectType: type, subjectId: id }] },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, stage: true, riskLevel: true, status: true },
      }),
      prisma.psyAppointment.findMany({
        where: appointmentWhere,
        orderBy: { at: 'desc' },
        select: { at: true, topic: true, kind: true, status: true, trainingType: true },
      }),
      type === 'parent'
        ? prisma.parent.findUnique({
            where: { id },
            select: {
              children: {
                select: {
                  student: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      psyCode: true,
                      branchId: true,
                      class: { select: { grade: true, letter: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    const revealNames = scope.role === 'psy_coordinator' || scope.role === 'super_admin' || (cases.length > 0 && scope.role !== 'senior_psychologist');
    const children = parent?.children
      .filter(({ student }) => cross || branchScope.canSeeAll || student.branchId === branchScope.branchId)
      .map(({ student }) => ({
      studentId: student.id,
      name: revealNames ? `${student.lastName} ${student.firstName}` : student.psyCode ?? 'код скрыт',
      className: student.class ? `${student.class.grade}${student.class.letter}` : '—',
    }));

    return successResponse({
      type,
      cases,
      appointments,
      ...(type === 'parent' ? { children: children ?? [] } : {}),
    });
  } catch (e) {
    console.error('GET psy/subject-card error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить карточку субъекта', 500);
  }
}
