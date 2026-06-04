import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { resolveScope } from '@/shared/lib/ai/scope';
import { runAssistant } from '@/shared/lib/ai/assistant';

/**
 * POST /api/v1/assistant/chat  { message, conversationId? }
 * Чат с ассистентом ядра. Зона доступа резолвится из сессии,
 * история диалога хранится в БД («он помнит всё про его чат»).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const user = auth.session.user;

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    if (!message) return errorResponse('VALIDATION_ERROR', 'Пустое сообщение');

    // диалог: существующий (с проверкой владельца) или новый
    let conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
    if (conversationId) {
      const conv = await prisma.assistantConversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
      if (!conv || conv.userId !== user.id) conversationId = null;
    }
    if (!conversationId) {
      const conv = await prisma.assistantConversation.create({
        data: { userId: user.id, title: message.slice(0, 60) },
        select: { id: true },
      });
      conversationId = conv.id;
    }

    // последние ходы диалога — контекст для модели
    const recent = await prisma.assistantMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, content: true },
    });
    const history = recent
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const scope = await resolveScope(user);
    const result = await runAssistant({ scope, history, userMessage: message });

    await prisma.$transaction([
      prisma.assistantMessage.create({
        data: { conversationId, role: 'user', content: message },
      }),
      prisma.assistantMessage.create({
        data: { conversationId, role: 'assistant', content: result.reply.slice(0, 8000) },
      }),
      prisma.assistantConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return successResponse({
      conversationId,
      reply: result.reply,
      model: result.model,
      usedTools: result.usedTools,
    });
  } catch (error) {
    console.error('POST /api/v1/assistant/chat error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ассистент временно недоступен', 500);
  }
}
