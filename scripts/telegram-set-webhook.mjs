// Регистрирует webhook Telegram-бота (запустить ОДИН раз после установки токена).
// Запуск: TELEGRAM_BOT_TOKEN=... [TELEGRAM_WEBHOOK_SECRET=...] node scripts/telegram-set-webhook.mjs [baseUrl]
const token = process.env.TELEGRAM_BOT_TOKEN;
const base = process.argv[2] || 'https://bilimos.kg';
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;
if (!token) { console.error('TELEGRAM_BOT_TOKEN не задан'); process.exit(1); }

const url = `${base}/api/v1/integrations/telegram/webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'] }),
});
console.log('setWebhook →', JSON.stringify(await res.json()));
const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
console.log('bot:', me?.result?.username);
