import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { sendTelegram } from '@/shared/lib/agent/telegram';

/**
 * POST — webhook Telegram. Обрабатывает /start <code> для привязки чата к пользователю.
 * Регистрация webhook: scripts/telegram-set-webhook.mjs (после установки токена).
 * Всегда отвечает 200, чтобы Telegram не ретраил.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = await request.json().catch(() => null);
    const message = update?.message;
    const chatId = message?.chat?.id ? String(message.chat.id) : null;
    const text: string = message?.text ?? '';

    if (chatId && text.startsWith('/start')) {
      const code = text.split(/\s+/)[1]?.trim();
      if (code) {
        const user = await prisma.user.findUnique({ where: { telegramLinkCode: code }, select: { id: true } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { telegramChatId: chatId, telegramLinkCode: null },
          });
          await sendTelegram(chatId, '✅ Готово! Уведомления Bilim OS подключены. Здесь будут приходить важные оповещения.');
        } else {
          await sendTelegram(chatId, 'Ссылка устарела. Откройте «Подключить Telegram» в Bilim OS ещё раз.');
        }
      } else {
        await sendTelegram(chatId, 'Привет! Чтобы подключить уведомления, откройте ссылку привязки в Bilim OS.');
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST telegram webhook error:', error);
    return NextResponse.json({ ok: true }); // не ретраить
  }
}
