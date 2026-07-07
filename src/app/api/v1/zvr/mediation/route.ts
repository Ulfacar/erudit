import { type NextRequest } from 'next/server';
import type { MediationParty, Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhereVia, getBranchScope } from '@/shared/lib/branch-scope';
import { canAccessStudent } from '@/shared/lib/student-access';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];
const MEDIATION_PARTIES = ['student', 'parent'] as const satisfies readonly MediationParty[];

type ObligationInput = {
  party?: unknown;
  task?: unknown;
  deadline?: unknown;
};

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

async function ensureStudentInScope(user: { id: string; role: string; branchId?: string | null }, studentId: string) {
  const allowed = await canAccessStudent(user.role, user.id, studentId);
  if (!allowed) return { ok: false as const, response: errorResponse('FORBIDDEN', 'Forbidden', 403) };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, branchId: true },
  });
  if (!student) return { ok: false as const, response: errorResponse('NOT_FOUND', 'Ученик не найден', 404) };

  if (user.role !== 'super_admin') {
    const scope = await getBranchScope(user.id, user.role as Role, user.branchId);
    if (scope.closed || !scope.branchId || scope.branchId !== student.branchId) {
      return { ok: false as const, response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
    }
  }

  return { ok: true as const, student };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const studentId = request.nextUrl.searchParams.get('studentId')?.trim();
    const incidentId = request.nextUrl.searchParams.get('incidentId')?.trim();
    const where: Prisma.MediationProtocolWhereInput = {};
    if (studentId) where.studentId = studentId;
    if (incidentId) where.behaviorIncidentId = incidentId;

    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
      Object.assign(where, branchWhereVia(scope, 'student'));
    }

    const protocols = await prisma.mediationProtocol.findMany({
      where,
      take: 200,
      orderBy: { date: 'desc' },
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
        incident: { select: { id: true, type: true } },
        obligations: { orderBy: { createdAt: 'asc' } },
      },
    });

    return successResponse(protocols.map((protocol) => ({
      ...protocol,
      student: { ...protocol.student, fio: fio(protocol.student) },
    })));
  } catch (error) {
    console.error('GET /api/v1/zvr/mediation error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить протоколы медиации', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const behaviorIncidentId = typeof body.behaviorIncidentId === 'string' && body.behaviorIncidentId.trim()
      ? body.behaviorIncidentId.trim()
      : null;
    const agreement = typeof body.agreement === 'string' ? body.agreement.trim() : '';
    const date = typeof body.date === 'string' && body.date ? new Date(body.date) : new Date();
    const obligations: ObligationInput[] = Array.isArray(body.obligations) ? body.obligations : [];

    if (!studentId) return errorResponse('VALIDATION_ERROR', 'Укажите ученика', 400);
    if (!agreement) return errorResponse('VALIDATION_ERROR', 'Заполните соглашение', 400);
    if (Number.isNaN(date.getTime())) return errorResponse('VALIDATION_ERROR', 'Некорректная дата', 400);
    if (obligations.length === 0) return errorResponse('VALIDATION_ERROR', 'Добавьте хотя бы одно обязательство', 400);

    const normalizedObligations = obligations.map((item) => {
      const party = typeof item?.party === 'string' ? item.party : '';
      const task = typeof item?.task === 'string' ? item.task.trim() : '';
      const deadline = typeof item?.deadline === 'string' && item.deadline ? new Date(item.deadline) : null;
      return { party, task, deadline };
    });

    if (normalizedObligations.some((item) => !MEDIATION_PARTIES.includes(item.party as MediationParty) || !item.task || (item.deadline && Number.isNaN(item.deadline.getTime())))) {
      return errorResponse('VALIDATION_ERROR', 'Проверьте обязательства сторон', 400);
    }

    const guard = await ensureStudentInScope(auth.session.user, studentId);
    if (!guard.ok) return guard.response;

    if (behaviorIncidentId) {
      const incident = await prisma.behaviorIncident.findFirst({
        where: { id: behaviorIncidentId, studentId },
        select: { id: true },
      });
      if (!incident) return errorResponse('VALIDATION_ERROR', 'Инцидент не найден у выбранного ученика', 400);
    }

    const created = await prisma.$transaction(async (tx) => tx.mediationProtocol.create({
      data: {
        studentId,
        behaviorIncidentId,
        date,
        agreement,
        authorId: auth.session.user.id,
        obligations: {
          create: normalizedObligations.map((item) => ({
            party: item.party as MediationParty,
            task: item.task,
            deadline: item.deadline,
          })),
        },
      },
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
        incident: { select: { id: true, type: true } },
        obligations: { orderBy: { createdAt: 'asc' } },
      },
    }));

    return successResponse({ ...created, student: { ...created.student, fio: fio(created.student) } }, 201);
  } catch (error) {
    console.error('POST /api/v1/zvr/mediation error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать протокол медиации', 500);
  }
}
