import { prisma } from '@/shared/lib/prisma';
import { sendTelegram, isTelegramConfigured } from '@/shared/lib/agent/telegram';
import { sendWebPush, isWebPushConfigured } from '@/shared/lib/agent/webpush';
import { sendWhatsapp, isWhatsappConfigured } from '@/shared/lib/agent/whatsapp';
import { sendSms, isSmsConfigured } from '@/shared/lib/agent/sms';
import { sendEmail, isEmailConfigured } from '@/shared/lib/agent/email';

/**
 * Канал-агностичный нотификатор. Источник правды — AgentItem (внутренний инбокс),
 * а этот слой дублирует уведомление во внешние каналы пользователя.
 * Каналы: Telegram + web-push (PWA); WhatsApp/SMS добавляются здесь же новым адаптером.
 * Всегда best-effort — не должен ронять создание AgentItem.
 */
export async function notifyUser(userId: string | null | undefined, title: string, body: string): Promise<void> {
  if (!userId) return;
  try {
    if (isTelegramConfigured()) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
      if (user?.telegramChatId) {
        await sendTelegram(user.telegramChatId, `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`);
      }
    }
  } catch (e) {
    console.error('[notify] telegram failed:', e);
  }
  try {
    if (isWebPushConfigured()) {
      await sendWebPush(userId, title, body);
    }
  } catch (e) {
    console.error('[notify] webpush failed:', e);
  }
  // WhatsApp / SMS — по телефону родителя (фолбэк для тех, кто не в Telegram).
  try {
    if (isWhatsappConfigured() || isSmsConfigured()) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { parent: { select: { phone: true } } } });
      const phone = u?.parent?.phone;
      if (phone) {
        if (isWhatsappConfigured()) await sendWhatsapp(phone, `${title}\n${body}`);
        else if (isSmsConfigured()) await sendSms(phone, `${title}: ${body}`);
      }
    }
  } catch (e) {
    console.error('[notify] whatsapp/sms failed:', e);
  }
  // Email — фолбэк для тех, у кого указан e-mail (родитель/сотрудник).
  try {
    if (isEmailConfigured()) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (u?.email) await sendEmail(u.email, title, body);
    }
  } catch (e) {
    console.error('[notify] email failed:', e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
