import webpush from 'web-push';
import { prisma } from '@/shared/lib/prisma';

/**
 * Web-push адаптер (зеркало telegram.ts): no-op без VAPID-ключей.
 * Ключи: npx web-push generate-vapid-keys → env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 */

let configured = false;

export function isWebPushConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@bilimos.kg', pub, priv);
    configured = true;
  }
  return true;
}

export async function sendWebPush(userId: string, title: string, body: string, url = '/agent'): Promise<void> {
  if (!isWebPushConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({ title, body, url });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        // 404/410 — подписка протухла, чистим
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('[webpush] send failed:', err);
        }
      }
    })
  );
}
