import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { isTelegramConfigured, botUsername } from '@/shared/lib/agent/telegram';

/**
 * GET — выдать пользователю deep-link для привязки Telegram-бота.
 * Создаёт telegramLinkCode при первом обращении.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramLinkCode: true },
    });

    let code = user?.telegramLinkCode ?? null;
    if (!code) {
      code = randomBytes(8).toString('hex');
      await prisma.user.update({ where: { id: userId }, data: { telegramLinkCode: code } });
    }

    const bot = botUsername();
    const url = bot && isTelegramConfigured() ? `https://t.me/${bot}?start=${code}` : null;
    return successResponse({
      configured: isTelegramConfigured() && Boolean(bot),
      linked: Boolean(user?.telegramChatId),
      url,
    });
  } catch (error) {
    console.error('GET /api/v1/integrations/telegram/link error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить ссылку привязки', 500);
  }
}
