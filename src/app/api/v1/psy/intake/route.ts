import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { emitEvent } from '@/shared/lib/agent/engine';

const VERDICTS = ['recommended', 'not_recommended', 'redirected'];
const RISK_LEVELS = ['green', 'yellow', 'red'];

/** GET /api/v1/psy/intake — список поступающих, отправленных психологу. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  try {
    const leads = await prisma.admissionLead.findMany({
      where: { sentToPsych: true, stage: { notIn: ['enrolled', 'rejected'] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, childName: true, targetGrade: true, phone: true, stage: true, psychCaseId: true },
    });
    const psychCaseIds = [...new Set(leads.map((l) => l.psychCaseId).filter((id): id is string => !!id))];
    const cases = psychCaseIds.length
      ? await prisma.psyCase.findMany({
          where: { id: { in: psychCaseIds } },
          select: { id: true, intakeVerdict: true },
        })
      : [];
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const payload = leads.map((lead) => {
      const verdict = lead.psychCaseId ? caseById.get(lead.psychCaseId)?.intakeVerdict ?? null : null;
      return {
        ...lead,
        verdict,
        done: Boolean(verdict),
      };
    });
    return successResponse(payload);
  } catch (e) {
    console.error('GET psy/intake error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить поступающих', 500);
  }
}

/** POST /api/v1/psy/intake — сохранить экспресс-тест поступающего. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { admissionLeadId, verdict, note, riskLevel } = body as Record<string, string>;

  if (!VERDICTS.includes(verdict)) {
    return errorResponse('VALIDATION_ERROR', 'Некорректное заключение');
  }
  if (!admissionLeadId) return errorResponse('NOT_FOUND', 'Поступающий не найден', 404);

  const risk = (RISK_LEVELS.includes(riskLevel) ? riskLevel : 'green') as 'green' | 'yellow' | 'red';

  try {
    const lead = await prisma.admissionLead.findUnique({
      where: { id: admissionLeadId },
      select: { id: true, childName: true, psychCaseId: true },
    });
    if (!lead) return errorResponse('NOT_FOUND', 'Поступающий не найден', 404);

    const result = await prisma.$transaction(async (tx) => {
      if (lead.psychCaseId) {
        await tx.psyCase.update({
          where: { id: lead.psychCaseId },
          data: { intakeVerdict: verdict, riskLevel: risk },
        });
        const session = await tx.psySession.findFirst({
          where: { caseId: lead.psychCaseId, type: 'primary_diagnosis' },
          orderBy: { date: 'asc' },
          select: { id: true },
        });
        if (session) {
          const hasNote = typeof note === 'string' && note.trim().length > 0;
          await tx.psySession.update({
            where: { id: session.id },
            data: { ...(hasNote ? { dapAssessment: note } : {}), isHumanVerified: true },
          });
        } else {
          await tx.psySession.create({
            data: {
              caseId: lead.psychCaseId,
              authorId: auth.session.user.id,
              type: 'primary_diagnosis',
              dapAssessment: note ?? null,
              isHumanVerified: true,
            },
          });
        }
        return { caseId: lead.psychCaseId, created: false };
      }

      const psyCase = await tx.psyCase.create({
        data: {
          isIntake: true,
          subjectType: 'student',
          studentId: null,
          subjectId: lead.id,
          subjectName: lead.childName,
          ownerId: auth.session.user.id,
          title: 'Первичная диагностика (поступление)',
          reason: 'Экспресс-тест при поступлении',
          riskLevel: risk,
          status: 'in_progress',
          intakeVerdict: verdict,
        },
      });
      await tx.psySession.create({
        data: {
          caseId: psyCase.id,
          authorId: auth.session.user.id,
          type: 'primary_diagnosis',
          dapAssessment: note ?? null,
          isHumanVerified: true,
        },
      });
      await tx.admissionLead.update({
        where: { id: admissionLeadId },
        data: { psychCaseId: psyCase.id, psychNote: note ?? null, sentToPsych: true },
      });
      return { caseId: psyCase.id, created: true };
    });

    await emitEvent('intake.completed', {
      actorUserId: auth.session.user.id,
      payload: { leadId: admissionLeadId, caseId: result.caseId, verdict, childName: lead.childName },
    });

    return successResponse({ caseId: result.caseId, verdict }, result.created ? 201 : 200);
  } catch (e) {
    console.error('POST psy/intake error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить экспресс-тест', 500);
  }
}
