import { prisma } from '@/shared/lib/prisma';
import type { Prisma } from '@prisma/client';
import { type AssistantScope, studentInScope, classInScope } from '@/shared/lib/ai/scope';
import { computeInsights } from '@/shared/lib/ai/insights';
import { computePenalty } from '@/shared/lib/finance/penalty';
import { verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';

/**
 * Инструменты AI-ассистента ядра. Каждый тул — это серверный запрос к Prisma,
 * жёстко обрезанный зоной доступа (scope). Нарушение зоны = `{error}` в ответе
 * тула, а не данные. Ответы компактные — экономим токены.
 *
 * Роли видят только разрешённые им определения тулов (см. toolDefinitionsForScope).
 */

interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  };
}

type ToolResult = Record<string, unknown> | Array<Record<string, unknown>>;
type ToolExecutor = (args: Record<string, unknown>, scope: AssistantScope) => Promise<ToolResult>;

const ACCESS_DENIED = { error: 'вне зоны доступа этой роли' };

function dayRange(date = new Date()): { gte: Date; lt: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

function studentWhere(scope: AssistantScope): Prisma.StudentWhereInput {
  return scope.allowedStudentIds === 'all' ? {} : { id: { in: scope.allowedStudentIds } };
}

function fio(s: { firstName: string; lastName: string }): string {
  return `${s.lastName} ${s.firstName}`;
}

// ─── 1. Обзор школы ──────────────────────────────────────────────────────────

const schoolOverview: ToolExecutor = async (_args, scope) => {
  if (!scope.canSeeSchoolStats) return ACCESS_DENIED;
  const [students, teachers, classes, parents, todayAttendance, openIncidents] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.parent.count(),
    prisma.attendance.groupBy({ by: ['status'], where: { date: dayRange() }, _count: true }),
    prisma.behaviorIncident.count({ where: { status: 'pending' } }),
  ]);
  return {
    учеников: students,
    педагогов: teachers,
    классов: classes,
    родителей: parents,
    посещаемость_сегодня: Object.fromEntries(todayAttendance.map((a) => [a.status, a._count])),
    открытых_инцидентов: openIncidents,
  };
};

// ─── 2. Наполняемость классов ────────────────────────────────────────────────

const classOccupancy: ToolExecutor = async (args, scope) => {
  const grade = typeof args.grade === 'number' ? args.grade : undefined;
  const where: Prisma.ClassWhereInput = {
    ...(grade ? { grade } : {}),
    ...(scope.allowedClassIds === 'all' ? {} : { id: { in: scope.allowedClassIds } }),
  };
  const classes = await prisma.class.findMany({
    where,
    select: {
      id: true, grade: true, letter: true,
      curator: { select: { firstName: true, lastName: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
  });
  if (!classes.length) return { info: 'классы не найдены (или вне зоны доступа)' };
  return classes.map((c) => ({
    classId: c.id,
    класс: `${c.grade}${c.letter}`,
    учеников: c._count.students,
    куратор: c.curator ? fio(c.curator) : null,
  }));
};

// ─── 3. Поиск ученика ────────────────────────────────────────────────────────

const findStudent: ToolExecutor = async (args, scope) => {
  const query = String(args.query ?? '').trim();
  if (query.length < 2) return { error: 'запрос слишком короткий' };
  const words = query.split(/\s+/).slice(0, 3);
  const students = await prisma.student.findMany({
    where: {
      AND: [
        studentWhere(scope),
        {
          OR: words.flatMap((w) => [
            { firstName: { contains: w, mode: 'insensitive' as const } },
            { lastName: { contains: w, mode: 'insensitive' as const } },
          ]),
        },
      ],
    },
    select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } } },
    take: 8,
  });
  if (!students.length) return { info: 'не найдено в вашей зоне доступа' };
  return students.map((s) => ({ studentId: s.id, имя: fio(s), класс: `${s.class.grade}${s.class.letter}` }));
};

// ─── 4. Профиль ученика ──────────────────────────────────────────────────────

const studentProfile: ToolExecutor = async (args, scope) => {
  const studentId = String(args.studentId ?? '');
  if (!studentInScope(scope, studentId)) return ACCESS_DENIED;

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [student, grades, attendance, incidents, achievements] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        firstName: true, lastName: true, status: true, enrolledAt: true,
        class: { select: { grade: true, letter: true, curator: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.grade.findMany({
      where: { studentId },
      select: { value: true, scale: true, date: true, subject: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    }),
    prisma.attendance.groupBy({ by: ['status'], where: { studentId, date: { gte: since30 } }, _count: true }),
    prisma.behaviorIncident.findMany({
      where: { studentId },
      select: { type: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    prisma.achievement.findMany({
      where: { studentId },
      select: { title: true, level: true, place: true },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ]);
  if (!student) return { error: 'ученик не найден' };

  // средний балл по предметам (пятибалльная шкала)
  const bySubject = new Map<string, { sum: number; n: number; last: number[] }>();
  for (const g of grades) {
    if (g.scale !== 'FIVE') continue;
    const e = bySubject.get(g.subject.name) ?? { sum: 0, n: 0, last: [] };
    e.sum += g.value;
    e.n += 1;
    if (e.last.length < 5) e.last.push(g.value);
    bySubject.set(g.subject.name, e);
  }

  return {
    имя: fio(student),
    класс: `${student.class.grade}${student.class.letter}`,
    куратор: student.class.curator ? fio(student.class.curator) : null,
    статус: student.status,
    оценки_по_предметам: [...bySubject.entries()].map(([subject, e]) => ({
      предмет: subject,
      средний: Math.round((e.sum / e.n) * 100) / 100,
      последние: e.last,
    })),
    посещаемость_30_дней: Object.fromEntries(attendance.map((a) => [a.status, a._count])),
    замечания: incidents.map((i) => ({ тип: i.type, описание: i.description.slice(0, 120), дата: i.createdAt.toISOString().slice(0, 10) })),
    достижения: achievements.map((a) => `${a.title} (${a.level}${a.place ? `, ${a.place}` : ''})`),
  };
};

// ─── 5. Финансы ученика ──────────────────────────────────────────────────────

const studentFinance: ToolExecutor = async (args, scope) => {
  const studentId = String(args.studentId ?? '');
  if (!scope.canSeeFinance || !studentInScope(scope, studentId)) return ACCESS_DENIED;

  const invoices = await prisma.feeInvoice.findMany({
    where: { studentId },
    select: { title: true, amount: true, status: true, dueDate: true, payments: { select: { amount: true, verified: true } } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const totalDue = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + verifiedPaidTotal(invoice.payments), 0);
  let totalPenalty = 0;
  const rows = invoices.map((i) => {
    const { penalty, overdueDays } = computePenalty(i);
    totalPenalty += penalty;
    return {
      название: i.title,
      сумма: i.amount,
      оплачено: verifiedPaidTotal(i.payments),
      статус: i.status,
      срок: i.dueDate?.toISOString().slice(0, 10) ?? null,
      ...(penalty > 0 ? { пеня: penalty, просрочка_дней: overdueDays } : {}),
    };
  });
  return {
    счета: rows,
    итого_начислено: totalDue,
    итого_оплачено: totalPaid,
    задолженность: Math.max(totalDue - totalPaid, 0),
    ...(totalPenalty > 0 ? { пеня_всего: totalPenalty, к_оплате_с_пеней: Math.max(totalDue - totalPaid, 0) + totalPenalty } : {}),
    валюта: 'сом',
  };
};

// ─── 6. Психолог/логопед/врач по ученику ─────────────────────────────────────

const studentPsych: ToolExecutor = async (args, scope) => {
  const studentId = String(args.studentId ?? '');
  if (!scope.canSeePsych || !studentInScope(scope, studentId)) return ACCESS_DENIED;

  // психолог видит только psych, врач — только medical, specialist/админ — всё
  const kindFilter =
    scope.allowedSpecialistKinds === 'all' ? {} : { kind: { in: scope.allowedSpecialistKinds } };

  const [sessions, recommendations, progress] = await Promise.all([
    prisma.specialistSession.findMany({
      where: { studentId, ...kindFilter },
      select: { kind: true, date: true, note: true },
      orderBy: { date: 'desc' },
      take: 8,
    }),
    prisma.specialistRecommendation.findMany({
      where: { studentId, ...kindFilter },
      select: { kind: true, text: true, date: true },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    prisma.specialistProgress.findMany({
      where: { studentId, ...kindFilter },
      select: { kind: true, metric: true, value: true, date: true },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);
  if (!sessions.length && !recommendations.length && !progress.length) {
    return { info: 'записей специалистов по ученику нет' };
  }
  return {
    сессии: sessions.map((s) => ({ вид: s.kind, дата: s.date.toISOString().slice(0, 10), заметка: s.note?.slice(0, 150) ?? null })),
    рекомендации: recommendations.map((r) => ({ вид: r.kind, текст: r.text.slice(0, 200), дата: r.date.toISOString().slice(0, 10) })),
    прогресс: progress.map((p) => ({ вид: p.kind, метрика: p.metric, значение: `${p.value}/100`, дата: p.date.toISOString().slice(0, 10) })),
  };
};

// ─── 7. Сводка по классу ─────────────────────────────────────────────────────

const classSummary: ToolExecutor = async (args, scope) => {
  const classId = String(args.classId ?? '');
  if (!classInScope(scope, classId)) return ACCESS_DENIED;

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      grade: true, letter: true,
      curator: { select: { firstName: true, lastName: true } },
      students: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!cls) return { error: 'класс не найден' };
  const studentIds = cls.students.map((s) => s.id);

  const [grades, attendance] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId: { in: studentIds }, scale: 'FIVE' },
      select: { studentId: true, value: true },
    }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId: { in: studentIds }, date: { gte: since30 } },
      _count: true,
    }),
  ]);

  const byStudent = new Map<string, { sum: number; n: number }>();
  for (const g of grades) {
    const e = byStudent.get(g.studentId) ?? { sum: 0, n: 0 };
    e.sum += g.value;
    e.n += 1;
    byStudent.set(g.studentId, e);
  }
  const avgAll = grades.length ? Math.round((grades.reduce((s, g) => s + g.value, 0) / grades.length) * 100) / 100 : null;
  const weak = cls.students
    .map((s) => {
      const e = byStudent.get(s.id);
      return e && e.n >= 3 ? { имя: fio(s), средний: Math.round((e.sum / e.n) * 100) / 100 } : null;
    })
    .filter((x): x is { имя: string; средний: number } => x !== null && x.средний <= 3.2)
    .slice(0, 5);

  return {
    класс: `${cls.grade}${cls.letter}`,
    куратор: cls.curator ? fio(cls.curator) : null,
    учеников: cls.students.length,
    средний_балл: avgAll,
    посещаемость_30_дней: Object.fromEntries(attendance.map((a) => [a.status, a._count])),
    требуют_внимания: weak,
  };
};

// ─── 8. Финансовая сводка школы ──────────────────────────────────────────────

const financeSummary: ToolExecutor = async (_args, scope) => {
  if (!scope.canSeeFinance || scope.allowedStudentIds !== 'all') return ACCESS_DENIED;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [invoiceAgg, paymentAgg, monthPayments, byStatus, expenseAgg, debtors] = await Promise.all([
    prisma.feeInvoice.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { verified: true }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { verified: true, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.feeInvoice.groupBy({ by: ['status'], _count: true }),
    prisma.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.feeInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] } },
      select: { amount: true, studentId: true },
    }),
  ]);
  const debtStudents = new Set(debtors.map((d) => d.studentId)).size;
  const invoiced = invoiceAgg._sum.amount ?? 0;
  const paid = paymentAgg._sum.amount ?? 0;
  return {
    начислено_всего: invoiced,
    оплачено_всего: paid,
    задолженность: Math.max(invoiced - paid, 0),
    оплат_в_этом_месяце: monthPayments._sum.amount ?? 0,
    расходы_в_этом_месяце: expenseAgg._sum.amount ?? 0,
    счета_по_статусам: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    учеников_с_долгом: debtStudents,
    валюта: 'сом',
  };
};

// ─── 9. Тренды посещаемости ──────────────────────────────────────────────────

const attendanceTrends: ToolExecutor = async (args, scope) => {
  const days = Math.min(Math.max(Number(args.days) || 30, 7), 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Prisma.AttendanceWhereInput = {
    date: { gte: since },
    ...(scope.allowedStudentIds === 'all' ? {} : { studentId: { in: scope.allowedStudentIds } }),
  };
  const byStatus = await prisma.attendance.groupBy({ by: ['status'], where, _count: true });
  const total = byStatus.reduce((s, a) => s + a._count, 0);
  if (!total) return { info: 'нет данных посещаемости за период' };
  return {
    период_дней: days,
    всего_отметок: total,
    по_статусам: Object.fromEntries(
      byStatus.map((a) => [a.status, `${a._count} (${Math.round((a._count / total) * 100)}%)`]),
    ),
  };
};

// ─── 10. Инбокс агента ───────────────────────────────────────────────────────

const agentInbox: ToolExecutor = async (_args, scope) => {
  const items = await prisma.agentItem.findMany({
    where: {
      OR: [{ forUserId: scope.userId }, { forRole: scope.role }],
      status: { in: ['new', 'in_progress'] },
    },
    select: { kind: true, severity: true, title: true, body: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (!items.length) return { info: 'входящих сигналов от агентов нет' };
  return items.map((i) => ({
    тип: i.kind,
    важность: i.severity,
    заголовок: i.title,
    текст: i.body.slice(0, 200),
    дата: i.createdAt.toISOString().slice(0, 10),
  }));
};

// ─── 11. Воронка приёмной ────────────────────────────────────────────────────

const admissionFunnel: ToolExecutor = async (_args, scope) => {
  if (!scope.canSeeSchoolStats) return ACCESS_DENIED;
  const byStage = await prisma.admissionLead.groupBy({ by: ['stage'], _count: true });
  const total = byStage.reduce((s, x) => s + x._count, 0);
  if (!total) return { info: 'заявок в приёмной пока нет' };
  const enrolled = byStage.find((s) => s.stage === 'enrolled')?._count ?? 0;
  const recent = await prisma.admissionLead.findMany({
    select: { childName: true, targetGrade: true, stage: true, source: true },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });
  return {
    всего_заявок: total,
    по_этапам: Object.fromEntries(byStage.map((s) => [s.stage, s._count])),
    конверсия_в_зачисление: `${Math.round((enrolled / total) * 100)}%`,
    последние: recent.map((l) => ({ ребёнок: l.childName, в_класс: l.targetGrade, этап: l.stage, источник: l.source })),
  };
};

// ─── 12. База знаний школы ───────────────────────────────────────────────────

/** Слова запроса для поиска (выкидываем служебные/короткие). */
export function knowledgeQueryWords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 6);
}

const schoolKnowledge: ToolExecutor = async (args, _scope) => {
  const query = String(args.query ?? '').trim();
  const words = knowledgeQueryWords(query);
  if (!words.length) return { info: 'уточните вопрос' };

  const docs = await prisma.knowledgeDoc.findMany({
    where: {
      OR: words.flatMap((w) => [
        { content: { contains: w, mode: 'insensitive' as const } },
        { title: { contains: w, mode: 'insensitive' as const } },
      ]),
    },
    select: { title: true, category: true, content: true },
    take: 6,
  });
  if (!docs.length) return { info: 'в базе знаний школы ничего не нашлось по этому вопросу' };

  // ранжируем по числу совпавших слов, берём топ-2 с выдержками
  const ranked = docs
    .map((d) => {
      const text = d.content.toLowerCase();
      const hits = words.filter((w) => text.includes(w) || d.title.toLowerCase().includes(w));
      const firstIdx = hits.length ? text.indexOf(hits[0]) : -1;
      return { doc: d, score: hits.length, firstIdx };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  return ranked.map(({ doc, firstIdx }) => {
    const start = Math.max(0, firstIdx - 120);
    const excerpt = doc.content.slice(start, start + 600).trim();
    return {
      документ: doc.title,
      категория: doc.category,
      выдержка: `${start > 0 ? '…' : ''}${excerpt}${start + 600 < doc.content.length ? '…' : ''}`,
    };
  });
};

// ─── 13. AI-инсайты (аномалии) ───────────────────────────────────────────────

const schoolInsights: ToolExecutor = async (_args, scope) => {
  if (!scope.canSeeSchoolStats) return ACCESS_DENIED;
  const insights = await computeInsights({ includeFinance: scope.canSeeFinance });
  if (!insights.length) return { info: 'аномалий не обнаружено — показатели школы в норме' };
  return insights.map((i) => ({ важность: i.severity, заголовок: i.title, детали: i.detail }));
};

// ─── Реестр ──────────────────────────────────────────────────────────────────

interface ToolEntry {
  def: ToolDef;
  execute: ToolExecutor;
  /** доступен ли тул роли (по scope) — недоступные не попадают в definitions */
  available: (scope: AssistantScope) => boolean;
}

const TOOLS: Record<string, ToolEntry> = {
  school_overview: {
    available: (s) => s.canSeeSchoolStats,
    execute: schoolOverview,
    def: {
      type: 'function',
      function: {
        name: 'school_overview',
        description: 'Общая сводка по школе: количество учеников, педагогов, классов, посещаемость сегодня, открытые инциденты.',
        parameters: { type: 'object', properties: {} },
      },
    },
  },
  class_occupancy: {
    available: () => true,
    execute: classOccupancy,
    def: {
      type: 'function',
      function: {
        name: 'class_occupancy',
        description: 'Наполняемость классов: список классов с количеством учеников и кураторами. Можно отфильтровать по параллели (grade).',
        parameters: {
          type: 'object',
          properties: { grade: { type: 'number', description: 'Параллель (например 5 для 5-х классов). Необязательно.' } },
        },
      },
    },
  },
  find_student: {
    available: () => true,
    execute: findStudent,
    def: {
      type: 'function',
      function: {
        name: 'find_student',
        description: 'Найти ученика по имени/фамилии. Возвращает studentId для других инструментов. Ищет только в зоне доступа пользователя.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Имя и/или фамилия ученика' } },
          required: ['query'],
        },
      },
    },
  },
  student_profile: {
    available: () => true,
    execute: studentProfile,
    def: {
      type: 'function',
      function: {
        name: 'student_profile',
        description: 'Полный профиль ученика: класс, средние оценки по предметам, посещаемость за 30 дней, замечания, достижения.',
        parameters: {
          type: 'object',
          properties: { studentId: { type: 'string', description: 'ID ученика (из find_student)' } },
          required: ['studentId'],
        },
      },
    },
  },
  student_finance: {
    available: (s) => s.canSeeFinance,
    execute: studentFinance,
    def: {
      type: 'function',
      function: {
        name: 'student_finance',
        description: 'Счета и оплаты ученика: начислено, оплачено, задолженность (в сомах).',
        parameters: {
          type: 'object',
          properties: { studentId: { type: 'string' } },
          required: ['studentId'],
        },
      },
    },
  },
  student_psych: {
    available: (s) => s.canSeePsych,
    execute: studentPsych,
    def: {
      type: 'function',
      function: {
        name: 'student_psych',
        description: 'Данные специалистов по ученику: сессии психолога/логопеда/врача, рекомендации, динамика метрик (тревожность и т.п.).',
        parameters: {
          type: 'object',
          properties: { studentId: { type: 'string' } },
          required: ['studentId'],
        },
      },
    },
  },
  class_summary: {
    available: () => true,
    execute: classSummary,
    def: {
      type: 'function',
      function: {
        name: 'class_summary',
        description: 'Сводка по классу: средний балл, посещаемость за 30 дней, ученики с низкой успеваемостью. classId — из class_occupancy.',
        parameters: {
          type: 'object',
          properties: { classId: { type: 'string' } },
          required: ['classId'],
        },
      },
    },
  },
  finance_summary: {
    available: (s) => s.canSeeFinance && s.allowedStudentIds === 'all',
    execute: financeSummary,
    def: {
      type: 'function',
      function: {
        name: 'finance_summary',
        description: 'Финансовая сводка школы: начислено/оплачено/задолженность, оплаты и расходы за текущий месяц, ученики с долгом.',
        parameters: { type: 'object', properties: {} },
      },
    },
  },
  attendance_trends: {
    available: () => true,
    execute: attendanceTrends,
    def: {
      type: 'function',
      function: {
        name: 'attendance_trends',
        description: 'Статистика посещаемости за период (в зоне доступа): присутствия, пропуски, опоздания в процентах.',
        parameters: {
          type: 'object',
          properties: { days: { type: 'number', description: 'Период в днях (7–90, по умолчанию 30)' } },
        },
      },
    },
  },
  agent_inbox: {
    available: () => true,
    execute: agentInbox,
    def: {
      type: 'function',
      function: {
        name: 'agent_inbox',
        description: 'Активные сигналы проактивных агентов для текущего пользователя: алерты, задачи, черновики (низкие оценки, пропуски и т.п.).',
        parameters: { type: 'object', properties: {} },
      },
    },
  },
  school_insights: {
    available: (s) => s.canSeeSchoolStats,
    execute: schoolInsights,
    def: {
      type: 'function',
      function: {
        name: 'school_insights',
        description: 'AI-инсайты: аномалии, найденные ядром — падение успеваемости учеников, классы с пропусками выше нормы, задолженности, застрявшие заявки приёмной.',
        parameters: { type: 'object', properties: {} },
      },
    },
  },
  school_knowledge: {
    available: () => true,
    execute: schoolKnowledge,
    def: {
      type: 'function',
      function: {
        name: 'school_knowledge',
        description: 'Поиск по базе знаний школы: режим работы, расписание звонков, правила приёма, оплата, контакты, внутренние инструкции. Используй для вопросов «как устроено в школе».',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Вопрос или ключевые слова' } },
          required: ['query'],
        },
      },
    },
  },
  admission_funnel: {
    available: (s) => s.canSeeSchoolStats,
    execute: admissionFunnel,
    def: {
      type: 'function',
      function: {
        name: 'admission_funnel',
        description: 'Воронка приёмной: заявки по этапам (звонок → тест → психолог → директор → договор → зачислен/отказ), конверсия.',
        parameters: { type: 'object', properties: {} },
      },
    },
  },
};

/** Определения тулов, доступных данной роли (для OpenRouter `tools`). */
export function toolDefinitionsForScope(scope: AssistantScope): ToolDef[] {
  return Object.values(TOOLS).filter((t) => t.available(scope)).map((t) => t.def);
}

/** Выполнить тул с инфорсментом зоны доступа. Никогда не бросает. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  scope: AssistantScope,
): Promise<string> {
  const tool = TOOLS[name];
  if (!tool) return JSON.stringify({ error: `неизвестный инструмент: ${name}` });
  if (!tool.available(scope)) return JSON.stringify(ACCESS_DENIED);
  try {
    const result = await tool.execute(args, scope);
    return JSON.stringify(result);
  } catch (err) {
    console.error(`[assistant] tool ${name} failed:`, err);
    return JSON.stringify({ error: 'ошибка выполнения запроса к базе' });
  }
}
