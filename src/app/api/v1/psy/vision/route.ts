import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { visionInterpret } from '@/shared/lib/ai/psy/vision';
import { putObject, dataUrlToBuffer, isStorageConfigured } from '@/shared/lib/storage/minio';

/**
 * POST /api/v1/psy/vision  { caseId, imageBase64 (data URL, уже с заблюренными подписями), methodology }
 * Сохраняет рисунок в приватный MinIO, отдаёт AI-черновик заключения (vision/stub).
 * Создаёт PsyTestResult (не верифицирован — психолог проверяет и подтверждает).
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const { caseId, imageBase64, originalBase64, methodology } = (await request.json().catch(() => ({}))) as {
    caseId?: string; imageBase64?: string; originalBase64?: string; methodology?: string;
  };
  if (!caseId || !imageBase64) return errorResponse('VALIDATION_ERROR', 'Нужны caseId и изображение');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const method = methodology?.trim() || 'Проективный рисунок';

  try {
    const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { riskLevel: true } });
    const allowCloud = c?.riskLevel !== 'red';

    // 1) Цифровой сейф: ОРИГИНАЛ (до блюра) навсегда в приватное хранилище школы.
    //    В облако (vision) уходит только заблюренная версия.
    let imageKey: string | null = null;
    if (isStorageConfigured()) {
      try {
        const safe = originalBase64 || imageBase64; // оригинал, если прислан
        const { buffer, contentType } = dataUrlToBuffer(safe);
        imageKey = await putObject(`cases/${caseId}/${Date.now()}.png`, buffer, contentType);
      } catch (e) {
        console.error('vision putObject failed (продолжаем без сохранения):', e);
      }
    }
    // 2) AI-черновик заключения — по ЗАБЛЮРЕННОМУ изображению
    const { text, source } = await visionInterpret(imageBase64, method, allowCloud);
    // 3) запись результата (не верифицирован)
    const result = await prisma.psyTestResult.create({
      data: {
        caseId, templateId: 'projective', templateVersion: 1,
        imageKey, aiInterpretation: text, isHumanVerified: false,
        rawScores: { methodology: method },
      },
    });
    return successResponse({ id: result.id, draft: text, source, imageKey, stored: Boolean(imageKey), redBlocked: !allowCloud }, 201);
  } catch (e) {
    console.error('POST psy/vision error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обработать рисунок', 500);
  }
}
