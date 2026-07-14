import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { removeObject } from '@/shared/lib/storage/minio';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    const key = request.nextUrl.searchParams.get('key');
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return errorResponse('UNAUTHORIZED', 'Неверный ключ cron', 401);
    }
  }

  try {
    const cutoff = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const sessions = await prisma.psySession.findMany({
      where: {
        audioKey: { not: null },
        OR: [
          { audioSetAt: { lt: cutoff } },
          { audioSetAt: null, createdAt: { lt: cutoff } },
        ],
      },
      select: { id: true, audioKey: true },
    });

    for (const session of sessions) {
      if (session.audioKey) {
        try { await removeObject(session.audioKey); } catch {}
      }
      await prisma.psySession.update({ where: { id: session.id }, data: { audioKey: null } });
    }

    return successResponse({ purged: sessions.length });
  } catch (e) {
    console.error('GET /api/cron/psy-audio-retention error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выполнить ретеншн аудио', 500);
  }
}
