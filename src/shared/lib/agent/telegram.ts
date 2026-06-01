/**
 * Telegram-канал доставки уведомлений агента.
 * Gated на TELEGRAM_BOT_TOKEN — без токена все вызовы безопасный no-op.
 * Привязка: родитель открывает t.me/<bot>?start=<code> → webhook сохраняет chatId.
 */
const API = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!isTelegramConfigured() || !chatId) return false;
  try {
    const res = await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error('[telegram] sendMessage failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram] sendMessage error:', e);
    return false;
  }
}

export async function setWebhook(url: string, secret?: string): Promise<unknown> {
  const res = await fetch(API('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret || undefined, allowed_updates: ['message'] }),
  });
  return res.json();
}
