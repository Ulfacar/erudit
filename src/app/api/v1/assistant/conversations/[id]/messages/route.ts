import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** GET /api/v1/assistant/conversations/[id]/messages — история диалога (только владелец). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const conversation = await prisma.assistantConversation.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!conversation || conversation.userId !== auth.session.user.id) {
      return errorResponse('NOT_FOUND', 'Диалог не найден', 404);
    }

    const messages = await prisma.assistantMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return successResponse(messages);
  } catch (error) {
    console.error('GET /api/v1/assistant/conversations/[id]/messages error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сообщения', 500);
  }
}
