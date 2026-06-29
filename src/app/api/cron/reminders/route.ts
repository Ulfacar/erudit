import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { computePenalty } from '@/shared/lib/finance/penalty';
import { emitEvent } from '@/shared/lib/agent/engine';
import { notifyUser } from '@/shared/lib/agent/notify';

/**
 * GET /api/cron/reminders — авто-рассылка напоминаний о просрочках (по расписанию).
 * Та же логика, что в ручной кнопке send-reminders, но без user-auth: защищено
 * CRON_SECRET (Vercel cron шлёт `Authorization: Bearer <CRON_SECRET>`). Если секрет
 * не задан — разрешаем (dev/Coolify). Дедуп открытых напоминаний — внутри правила.
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
    const invoices = await prisma.feeInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { not: null, lt: new Date() } },
      include: { payments: { select: { amount: true, verified: true } } },
    });
    let count = 0;
    for (const inv of invoices) {
      const { remaining, penalty, overdueDays } = computePenalty(inv);
      if (remaining <= 0 || overdueDays <= 0) continue;
      await emitEvent('invoice.overdue', {
        actorUserId: null,
        studentId: inv.studentId,
        payload: { invoiceId: inv.id, title: inv.title, remaining, penalty, overdueDays },
      });
      count += 1;
    }

    // Pre-due: мягкое напоминание родителям за 3 дня ДО срока («заранее выдавливаем»).
    let preCount = 0;
    const in3d = new Date(Date.now() + 3 * 864e5);
    const upcoming = await prisma.feeInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { gte: new Date(), lte: in3d } },
      select: { id: true, title: true, amount: true, dueDate: true, studentId: true },
    });
    for (const inv of upcoming) {
      const parent = await prisma.parent.findFirst({
        where: { children: { some: { studentId: inv.studentId } } },
        select: { userId: true },
      });
      if (!parent?.userId) continue;
      await notifyUser(parent.userId, '💳 Напоминание об оплате', `Скоро срок оплаты «${inv.title}» (${inv.amount.toLocaleString('ru-RU')} сом) до ${inv.dueDate?.toLocaleDateString('ru-RU')}.`);
      preCount += 1;
    }

    return successResponse({ overdue: count, preDue: preCount, at: new Date().toISOString() });
  } catch (e) {
    console.error('GET /api/cron/reminders error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось разослать напоминания', 500);
  }
}
