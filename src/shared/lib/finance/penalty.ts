/**
 * Пени за просрочку оплаты (правка Даткайым, этап финансов).
 *
 * Расчёт детерминированный и «на лету» — без cron и записи в БД,
 * пеня всегда актуальна на момент запроса. Единственный источник истины,
 * используется бухгалтерией, ассистентом и AI-инсайтами.
 */

export const PENALTY_RATE_PER_DAY = 0.001; // 0.1% в день от непогашенного остатка
export const PENALTY_GRACE_DAYS = 3; // льготные дни после срока
export const PENALTY_MAX_PCT = 0.2; // потолок: 20% от суммы счёта

export interface PenaltyInput {
  amount: number;
  status: string; // pending | partial | paid | cancelled
  dueDate?: string | Date | null;
  payments?: Array<{ amount: number }> | null;
}

export interface PenaltyResult {
  overdueDays: number;
  remaining: number; // непогашенный остаток
  penalty: number; // сом, округлено
}

export function computePenalty(invoice: PenaltyInput, now: Date = new Date()): PenaltyResult {
  const paid = (invoice.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(invoice.amount - paid, 0);

  if (!invoice.dueDate || remaining <= 0 || invoice.status === 'paid' || invoice.status === 'cancelled') {
    return { overdueDays: 0, remaining, penalty: 0 };
  }

  const due = new Date(invoice.dueDate);
  const overdueDays = Math.floor((now.getTime() - due.getTime()) / 864e5) - PENALTY_GRACE_DAYS;
  if (overdueDays <= 0) return { overdueDays: 0, remaining, penalty: 0 };

  const raw = remaining * PENALTY_RATE_PER_DAY * overdueDays;
  const capped = Math.min(raw, invoice.amount * PENALTY_MAX_PCT);
  return { overdueDays, remaining, penalty: Math.round(capped) };
}
