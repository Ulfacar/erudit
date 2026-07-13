import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { prisma } from '@/shared/lib/prisma';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { deidentifyForCase, reidentify, residualPiiRisk, strictPrivacyEnabled } from '@/shared/lib/ai/psy/deidentify';
import { structureDap } from '@/shared/lib/ai/psy/dap';

/**
 * POST /api/v1/psy/sessions/dap  { caseId, rawNote }
 * Структурирует сырую заметку в DAP. ПРИВАТНОСТЬ: текст обезличивается на сервере
 * (ФИО → маркеры) ДО облачного LLM; ответ ре-идентифицируется здесь же.
 * Ничего не сохраняет — отдаёт черновик, который психолог проверяет и правит.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const { caseId, rawNote } = (await request.json().catch(() => ({}))) as { caseId?: string; rawNote?: string };
  if (!caseId || !rawNote?.trim()) return errorResponse('VALIDATION_ERROR', 'Нужны caseId и текст заметки');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  try {
    const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { riskLevel: true } });
    const requiresManualReview = c?.riskLevel === 'red';

    // 1) обезличиваем (ФИО → маркеры) — карта остаётся ТОЛЬКО на сервере
    const deid = await deidentifyForCase(caseId, rawNote);
    // 2) FAIL-CLOSED: если строгий режим и в тексте остался возможный PII —
    //    НЕ отправляем в облако, структурируем локально. «Не уверены → не шлём.»
    const strict = strictPrivacyEnabled();
    const risk = residualPiiRisk(deid.masked);
    const allowCloud = !(strict && risk.risky);
    const signals = risk.signals;
    // 3) структурируем обезличенный текст (облако или локальный сплиттер)
    const { dap, source } = await structureDap(deid.masked, { allowCloud });
    // 4) ре-идентификация ответа для показа психологу
    const result = {
      data: reidentify(dap.data, deid.map),
      assessment: reidentify(dap.assessment, deid.map),
      plan: reidentify(dap.plan, deid.map),
    };
    return successResponse({
      dap: result,
      source, // 'llm' | 'stub'
      privacy: {
        maskedEntities: deid.count,
        strict,
        requiresManualReview,
        mode: allowCloud ? 'cloud' : 'local-only', // ушло в облако или осталось на месте
        residualSignals: signals, // что заставило придержать (если придержали)
        sentToCloud: allowCloud ? deid.masked : null, // прозрачность: что реально ушло (null = ничего)
      },
    });
  } catch (e) {
    console.error('POST psy/sessions/dap error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось структурировать DAP', 500);
  }
}
