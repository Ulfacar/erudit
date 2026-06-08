/**
 * Email-канал (фолбэк для родителей/сотрудников без Telegram/WhatsApp).
 * Gated на SMTP_HOST + SMTP_USER + SMTP_PASS — без них безопасный no-op.
 * nodemailer импортируется динамически, чтобы не тянуть его в бандл, если канал не настроен.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!isEmailConfigured() || !to) return false;
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (e) {
    console.error('[email] error:', e);
    return false;
  }
}
