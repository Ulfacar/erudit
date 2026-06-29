import { prisma } from '@/shared/lib/prisma';
import { computePenalty } from '@/shared/lib/finance/penalty';

/**
 * AI-инсайты ядра: детерминированный поиск аномалий по реальным данным.
 * Без LLM — правила, которые находят то, что человек глазами не сложит:
 * падение успеваемости, классы-выбросы по пропускам, долги, застрявшие заявки.
 */

export interface Insight {
  severity: 'info' | 'warn' | 'urgent';
  title: string;
  detail: string;
  href: string;
}

const SEVERITY_ORDER: Record<Insight['severity'], number> = { urgent: 0, warn: 1, info: 2 };

export async function computeInsights(opts?: { includeFinance?: boolean }): Promise<Insight[]> {
  const includeFinance = opts?.includeFinance ?? true;
  const insights: Insight[] = [];
  const now = Date.now();
  const d14 = new Date(now - 14 * 864e5);
  const d44 = new Date(now - 44 * 864e5);
  const d30 = new Date(now - 30 * 864e5);
  const d7 = new Date(now - 7 * 864e5);

  // ── 1. Падение успеваемости: avg за 14 дн vs avg за предыдущие 30 дн ──
  try {
    const grades = await prisma.grade.findMany({
      where: { scale: 'FIVE', date: { gte: d44 } },
      select: { studentId: true, value: true, date: true },
    });
    const byStudent = new Map<string, { recent: number[]; prior: number[] }>();
    for (const g of grades) {
      const e = byStudent.get(g.studentId) ?? { recent: [], prior: [] };
      (g.date >= d14 ? e.recent : e.prior).push(g.value);
      byStudent.set(g.studentId, e);
    }
    const drops: Array<{ studentId: string; drop: number; recentAvg: number }> = [];
    for (const [studentId, e] of byStudent) {
      if (e.recent.length < 3 || e.prior.length < 3) continue;
      const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
      const drop = avg(e.prior) - avg(e.recent);
      if (drop >= 0.7) drops.push({ studentId, drop, recentAvg: avg(e.recent) });
    }
    drops.sort((a, b) => b.drop - a.drop);
    if (drops.length) {
      const students = await prisma.student.findMany({
        where: { id: { in: drops.slice(0, 3).map((d) => d.studentId) } },
        select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } } },
      });
      const sById = new Map(students.map((s) => [s.id, s]));
      for (const d of drops.slice(0, 3)) {
        const s = sById.get(d.studentId);
        if (!s) continue;
        insights.push({
          severity: d.drop >= 1.2 ? 'urgent' : 'warn',
          title: `Падение успеваемости: ${s.lastName} ${s.firstName[0]}., ${s.class.grade}${s.class.letter}`,
          detail: `Средний балл снизился на ${d.drop.toFixed(1)} за 2 недели (сейчас ${d.recentAvg.toFixed(1)}). Рекомендуем разговор с куратором.`,
          href: `/students/${d.studentId}`,
        });
      }
    }
  } catch (e) {
    console.error('[insights] grades drop failed:', e);
  }

  // ── 2. Класс-выброс по пропускам (absent-rate выше среднешкольного на ≥5пп) ──
  try {
    const att = await prisma.attendance.findMany({
      where: { date: { gte: d30 } },
      select: { status: true, student: { select: { classId: true } } },
    });
    if (att.length >= 50) {
      const byClass = new Map<string, { total: number; absent: number }>();
      let totalAll = 0;
      let absentAll = 0;
      for (const a of att) {
        const e = byClass.get(a.student.classId) ?? { total: 0, absent: 0 };
        e.total += 1;
        if (a.status === 'absent') e.absent += 1;
        byClass.set(a.student.classId, e);
        totalAll += 1;
        if (a.status === 'absent') absentAll += 1;
      }
      const schoolRate = absentAll / totalAll;
      const outliers: Array<{ classId: string; rate: number }> = [];
      for (const [classId, e] of byClass) {
        if (e.total < 20) continue;
        const rate = e.absent / e.total;
        if (rate - schoolRate >= 0.05) outliers.push({ classId, rate });
      }
      outliers.sort((a, b) => b.rate - a.rate);
      if (outliers.length) {
        const classes = await prisma.class.findMany({
          where: { id: { in: outliers.slice(0, 2).map((o) => o.classId) } },
          select: { id: true, grade: true, letter: true },
        });
        const cById = new Map(classes.map((c) => [c.id, c]));
        for (const o of outliers.slice(0, 2)) {
          const c = cById.get(o.classId);
          if (!c) continue;
          insights.push({
            severity: 'warn',
            title: `Пропуски выше нормы: класс ${c.grade}${c.letter}`,
            detail: `${Math.round(o.rate * 100)}% пропусков за месяц при среднем по школе ${Math.round(schoolRate * 100)}%. Стоит выяснить причину.`,
            href: '/reports/attendance',
          });
        }
      }
    }
  } catch (e) {
    console.error('[insights] attendance outlier failed:', e);
  }

  // ── 3. Задолженность (агрегат, без публичного позора конкретных семей) ──
  if (includeFinance) {
    try {
      const [invoiceAgg, paymentAgg, debtors] = await Promise.all([
        prisma.feeInvoice.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { verified: true }, _sum: { amount: true } }),
        prisma.feeInvoice.findMany({ where: { status: { in: ['pending', 'partial'] } }, select: { studentId: true } }),
      ]);
      const debt = (invoiceAgg._sum.amount ?? 0) - (paymentAgg._sum.amount ?? 0);
      const debtStudents = new Set(debtors.map((d) => d.studentId)).size;
      if (debt > 0 && debtStudents > 0) {
        insights.push({
          severity: debtStudents >= 10 ? 'warn' : 'info',
          title: `Задолженность по оплате: ${debt.toLocaleString('ru-RU')} сом`,
          detail: `${debtStudents} учеников со счетами в ожидании оплаты. Бухгалтерия может отправить напоминания.`,
          href: '/workspace/accounting',
        });
      }
    } catch (e) {
      console.error('[insights] finance failed:', e);
    }
  }

  // ── 3b. Пени за просрочку (расчёт на лету по просроченным счетам) ──
  if (includeFinance) {
    try {
      const overdue = await prisma.feeInvoice.findMany({
        where: { status: { in: ['pending', 'partial'] }, dueDate: { lt: new Date(now) } },
        select: { amount: true, status: true, dueDate: true, studentId: true, payments: { select: { amount: true, verified: true } } },
      });
      let totalPenalty = 0;
      const penaltyStudents = new Set<string>();
      for (const inv of overdue) {
        const { penalty } = computePenalty(inv);
        if (penalty > 0) {
          totalPenalty += penalty;
          penaltyStudents.add(inv.studentId);
        }
      }
      if (totalPenalty > 0) {
        insights.push({
          severity: penaltyStudents.size >= 5 ? 'warn' : 'info',
          title: `Пени за просрочку: ${totalPenalty.toLocaleString('ru-RU')} сом`,
          detail: `${penaltyStudents.size} учеников с просроченными счетами. Пеня 0.1%/день, начисляется автоматически.`,
          href: '/workspace/accounting',
        });
      }
    } catch (e) {
      console.error('[insights] penalty failed:', e);
    }
  }

  // ── 4. Застрявшие заявки приёмной (>7 дней без движения) ──
  try {
    const stuck = await prisma.admissionLead.count({
      where: { stage: { notIn: ['enrolled', 'rejected'] }, updatedAt: { lt: d7 } },
    });
    if (stuck > 0) {
      insights.push({
        severity: 'info',
        title: `Заявки без движения: ${stuck}`,
        detail: `В воронке приёмной ${stuck} заявок не обновлялись больше недели — семьи могут уйти в другую школу.`,
        href: '/admission',
      });
    }
  } catch (e) {
    console.error('[insights] admission stuck failed:', e);
  }

  return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]).slice(0, 6);
}
