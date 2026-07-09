import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { omrExtract } from '@/shared/lib/ai/psy/vision';

/**
 * POST /api/v1/psy/omr  { caseId, templateId, imageBase64 }
 * Распознаёт бумажный бланк с галочками → «сырые баллы» по вопросам методики.
 * Возвращает массив для предзаполнения калькулятора шкалы (психолог проверяет).
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const { caseId, templateId, imageBase64 } = (await request.json().catch(() => ({}))) as { caseId?: string; templateId?: string; imageBase64?: string };
  if (!caseId || !templateId || !imageBase64) return errorResponse('VALIDATION_ERROR', 'Нужны caseId, templateId и изображение');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const tpl = await prisma.psyDiagnosticTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return errorResponse('NOT_FOUND', 'Методика не найдена', 404);

  const schema = (tpl.schema as { questions?: Array<{ type?: string }>; scaleMax?: number }) ?? {};
  const scaleQuestions = (schema.questions ?? []).filter((q) => (q.type ?? 'scale') === 'scale');
  const count = scaleQuestions.length || (schema.questions?.length ?? 5);

  try {
    const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { riskLevel: true } });
    const allowCloud = c?.riskLevel !== 'red';

    const { scores, source } = await omrExtract(imageBase64, count, Number(schema.scaleMax ?? 10), allowCloud);
    return successResponse({ scores, source, total: scores.reduce((s, v) => s + v, 0) });
  } catch (e) {
    console.error('POST psy/omr error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось распознать бланк', 500);
  }
}
