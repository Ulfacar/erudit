import { type NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { escalateStaleAlerts, escalationHours, remindHours } from '@/shared/lib/psy-safeguarding';

/**
 * GET /api/cron/psy-escalation — авто-эскалация «зависших» критических сигналов.
 * Красный сигнал не взят в работу за PSY_ESCALATION_HOURS (дефолт 24) → директору,
 * далее напоминания каждые PSY_REMIND_HOURS (дефолт 6), пока не возьмут в работу.
 * Защита — CRON_SECRET (как у /api/cron/reminders). Без секрета разрешаем (Coolify/on-prem).
 */
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
    const res = await escalateStaleAlerts();
    return successResponse({
      ...res,
      escalationHours: escalationHours(),
      remindHours: remindHours(),
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('GET /api/cron/psy-escalation error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выполнить эскалацию', 500);
  }
}
