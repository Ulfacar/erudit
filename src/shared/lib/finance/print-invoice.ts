import { computePenalty } from '@/shared/lib/finance/penalty';
import { verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';
import { invoiceStatusLabel } from '@/shared/lib/finance/invoice-status';

export interface PrintableInvoice {
  id: string;
  title: string;
  period?: string | null;
  amount: number;
  status: string;
  dueDate?: string | null;
  createdAt?: string | null;
  payments?: Array<{ amount: number; verified: boolean }> | null;
}

const fmtSom = (n: number) => `${n.toLocaleString('ru-RU')} сом`;
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

/**
 * Печатная форма счёта: отдельное окно с автономными стилями → window.print().
 * Не зависит от CSS приложения — бланк выглядит одинаково везде.
 */
export function printInvoice(inv: PrintableInvoice, studentName: string) {
  const { remaining, penalty, overdueDays } = computePenalty(inv);
  const paid = verifiedPaidTotal(inv.payments ?? []);

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Счёт — ${inv.title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #228be6; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; color: #228be6; letter-spacing: -0.02em; }
  .brand small { display: block; color: #6b7280; font-weight: 400; font-size: 12px; margin-top: 2px; }
  h1 { font-size: 18px; margin: 24px 0 4px; }
  .muted { color: #6b7280; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  td, th { padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 14px; text-align: left; }
  th { background: #f8f9fb; font-weight: 600; width: 40%; }
  .total td { font-weight: 700; background: #f0f7ff; }
  .penalty td { color: #c92a2a; font-weight: 600; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; }
  .sign { margin-top: 48px; display: flex; gap: 64px; font-size: 13px; }
  .sign div { border-top: 1px solid #9ca3af; padding-top: 4px; width: 220px; }
  @media print { body { margin: 16mm; } }
</style></head><body>
  <div class="head">
    <div class="brand">Bilim OS<small>Система управления школой</small></div>
    <div class="muted">Счёт № ${inv.id.slice(-8).toUpperCase()}<br>от ${fmtD(inv.createdAt ?? null)}</div>
  </div>
  <h1>Счёт на оплату обучения</h1>
  <div class="muted">${inv.title}${inv.period ? ` · ${inv.period}` : ''}</div>
  <table>
    <tr><th>Ученик</th><td>${studentName}</td></tr>
    <tr><th>Назначение</th><td>${inv.title}</td></tr>
    <tr><th>Период</th><td>${inv.period ?? '—'}</td></tr>
    <tr><th>Срок оплаты</th><td>${fmtD(inv.dueDate)}</td></tr>
    <tr><th>Статус</th><td>${invoiceStatusLabel(inv.status)}</td></tr>
    <tr><th>Сумма счёта</th><td>${fmtSom(inv.amount)}</td></tr>
    <tr><th>Оплачено</th><td>${fmtSom(paid)}</td></tr>
    ${penalty > 0 ? `<tr class="penalty"><th>Пеня (просрочка ${overdueDays} дн, 0,1%/день)</th><td>+${fmtSom(penalty)}</td></tr>` : ''}
    <tr class="total"><td>К оплате</td><td>${fmtSom(remaining + penalty)}</td></tr>
  </table>
  <div class="sign">
    <div>Бухгалтер</div>
    <div>Дата</div>
  </div>
  <div class="footer">
    <span>Сформировано в Bilim OS</span>
    <span>${new Date().toLocaleDateString('ru-RU')}</span>
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
