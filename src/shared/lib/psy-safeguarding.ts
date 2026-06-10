import { prisma } from '@/shared/lib/prisma';
import { notifyUser } from '@/shared/lib/agent/notify';
import { emitEvent } from '@/shared/lib/agent/engine';

/**
 * Safeguarding (UC-5): при критическом (красном) риске создаём алерт и шлём
 * координаторам СЛЕПОЕ уведомление — строго стандартный текст без имён и номеров
 * кейса. Детали доступны только после входа в закрытый контур (/safeguarding).
 */
export const COORDINATOR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const;

const BLIND_TITLE = '🔒 Новое системное уведомление eSPSMS';
const BLIND_BODY = 'Требуется авторизация в системе.';

export async function emitSafeguardingAlert(caseId: string, reason: string): Promise<void> {
  try {
    // не плодим дубли открытых алертов на один кейс
    const existing = await prisma.psyAlert.findFirst({ where: { caseId, status: { not: 'resolved' } } });
    if (!existing) {
      await prisma.psyAlert.create({ data: { caseId, reason, status: 'open' } });
    }
    const coords = await prisma.user.findMany({
      where: { role: { in: [...COORDINATOR_ROLES] }, isActive: true },
      select: { id: true },
    });
    await Promise.all(coords.map((u) => notifyUser(u.id, BLIND_TITLE, BLIND_BODY)));
    // Ядро: слепой импульс в нейро-граф (без ФИО — приватность ТЗ).
    await emitEvent('safeguard.alert', { payload: { caseId } });
  } catch (e) {
    console.error('emitSafeguardingAlert failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// АВТО-ЭСКАЛАЦИЯ (ответ Эмиру, вопрос №2).
// Красный сигнал не взят в работу за N часов → поднимаем директору + напоминаем,
// пока кто-то не возьмёт в работу (status != 'open'). Тексты слепые, без ФИО.
// ─────────────────────────────────────────────────────────────────────────────

/** Кому эскалируем «выше» — директор/владелец. */
const DIRECTOR_ROLES = ['super_admin'] as const;

const ESC_TITLE = '🔴 Эскалация eSPSMS: критический сигнал без реакции';
const ESC_REMIND_TITLE = '🔴 Напоминание eSPSMS: сигнал всё ещё не в работе';
const ESC_BODY = 'Критический сигнал не взят в работу в срок. Требуется авторизация в системе.';

/** Часы до эскалации директору (дефолт 24, настраивается PSY_ESCALATION_HOURS). */
export function escalationHours(): number {
  const n = Number(process.env.PSY_ESCALATION_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 24;
}
/** Интервал повторных напоминаний после эскалации (дефолт 6, PSY_REMIND_HOURS). */
export function remindHours(): number {
  const n = Number(process.env.PSY_REMIND_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

/**
 * Поднимает «зависшие» открытые алерты: первая эскалация директору + повторные
 * напоминания по интервалу. Идемпотентна — безопасно звать часто (cron / on-read).
 */
export async function escalateStaleAlerts(): Promise<{ escalated: number; reminded: number }> {
  const now = Date.now();
  const cutoff = new Date(now - escalationHours() * 3_600_000);
  const stale = await prisma.psyAlert.findMany({ where: { status: 'open', createdAt: { lt: cutoff } } });
  if (stale.length === 0) return { escalated: 0, reminded: 0 };

  const directors = await prisma.user.findMany({
    where: { role: { in: [...DIRECTOR_ROLES] }, isActive: true },
    select: { id: true },
  });
  const remindCutoff = new Date(now - remindHours() * 3_600_000);
  let escalated = 0;
  let reminded = 0;

  for (const a of stale) {
    if (!a.escalatedAt) {
      // первая эскалация
      await Promise.all(directors.map((u) => notifyUser(u.id, ESC_TITLE, ESC_BODY)));
      await prisma.psyAlert.update({
        where: { id: a.id },
        data: { escalatedAt: new Date(), lastNotifiedAt: new Date(), remindCount: 1 },
      });
      await emitEvent('safeguard.escalated', { payload: { caseId: a.caseId } });
      escalated += 1;
    } else if (!a.lastNotifiedAt || a.lastNotifiedAt < remindCutoff) {
      // повторное напоминание — пока не возьмут в работу
      await Promise.all(directors.map((u) => notifyUser(u.id, ESC_REMIND_TITLE, ESC_BODY)));
      await prisma.psyAlert.update({
        where: { id: a.id },
        data: { lastNotifiedAt: new Date(), remindCount: { increment: 1 } },
      });
      reminded += 1;
    }
  }
  return { escalated, reminded };
}
