import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** Подписка устройства на web-push. Доступна любому авторизованному (только своя). */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;

    const body = await request.json();
    const endpoint = String(body?.endpoint ?? '');
    const p256dh = String(body?.keys?.p256dh ?? '');
    const authKey = String(body?.keys?.auth ?? '');
    if (!endpoint || !p256dh || !authKey) return errorResponse('VALIDATION_ERROR', 'Некорректная подписка');

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth: authKey },
      create: { userId, endpoint, p256dh, auth: authKey },
    });
    return successResponse({ ok: true }, 201);
  } catch (error) {
    console.error('POST /api/v1/push/subscribe error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить подписку', 500);
  }
}

/** Отписка устройства. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint ?? '');
    if (!endpoint) return errorResponse('VALIDATION_ERROR', 'Не указан endpoint');
    // Удаляем только свою подписку
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: auth.session.user.id } });
    return successResponse({ ok: true });
  } catch (error) {
    console.error('DELETE /api/v1/push/subscribe error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить подписку', 500);
  }
}

/** Публичный VAPID-ключ для клиента (+ признак, настроены ли пуши). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;
  const key = process.env.VAPID_PUBLIC_KEY ?? null;
  return successResponse({ configured: Boolean(key), publicKey: key });
}
