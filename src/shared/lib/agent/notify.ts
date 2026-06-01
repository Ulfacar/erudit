import { prisma } from '@/shared/lib/prisma';
import { sendTelegram, isTelegramConfigured } from '@/shared/lib/agent/telegram';

/**
 * Канал-агностичный нотификатор. Источник правды — AgentItem (внутренний инбокс),
 * а этот слой дублирует уведомление во внешние каналы пользователя.
 * Сейчас подключён Telegram; WhatsApp/SMS добавляются здесь же новым адаптером.
 * Всегда best-effort — не должен ронять создание AgentItem.
 */
export async function notifyUser(userId: string | null | undefined, title: string, body: string): Promise<void> {
  if (!userId) return;
  try {
    if (!isTelegramConfigured()) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
    if (user?.telegramChatId) {
      await sendTelegram(user.telegramChatId, `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`);
    }
    // TODO(channels): WhatsApp / SMS адаптеры — по Parent.phone, когда подключим.
  } catch (e) {
    console.error('[notify] failed:', e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
