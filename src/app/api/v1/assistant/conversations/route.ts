import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** GET /api/v1/assistant/conversations — диалоги текущего пользователя. */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const conversations = await prisma.assistantConversation.findMany({
      where: { userId: auth.session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, updatedAt: true },
    });
    return successResponse(conversations);
  } catch (error) {
    console.error('GET /api/v1/assistant/conversations error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить диалоги', 500);
  }
}
