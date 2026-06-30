import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { botUsername, isTelegramConfigured } from '@/shared/lib/agent/telegram';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const bot = botUsername();
    return successResponse({
      configured: isTelegramConfigured() && Boolean(bot),
      botUsername: bot,
    });
  } catch (error) {
    console.error('GET telegram qr-config error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить настройки Telegram QR', 500);
  }
}
