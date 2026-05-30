import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * POST /api/v1/consents/sign  { consentId, studentId, agreed }
 * Родитель подтверждает/отклоняет согласие за своего ребёнка.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['parent'] });
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;
    const { consentId, studentId, agreed } = await request.json();
    if (!consentId || !studentId || typeof agreed !== 'boolean') {
      return errorResponse('VALIDATION_ERROR', 'Поля consentId, studentId, agreed обязательны');
    }
    const link = await prisma.parentStudent.findFirst({ where: { studentId, parent: { userId } }, select: { studentId: true } });
    if (!link) return errorResponse('FORBIDDEN', 'Это не ваш ребёнок', 403);

    const resp = await prisma.consentResponse.upsert({
      where: { consentId_studentId: { consentId, studentId } },
      update: { agreed, signedBy: userId, signedAt: new Date() },
      create: { consentId, studentId, agreed, signedBy: userId },
    });
    return successResponse(resp);
  } catch (error) {
    console.error('POST /api/v1/consents/sign error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось подписать согласие', 500);
  }
}
