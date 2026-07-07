import { prisma } from '@/shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { notifyUser } from '@/shared/lib/agent/notify';

/**
 * Проактивный агентский движок (Фаза A+B). См. docs/ai-agents-blueprint.md.
 * Событие → правило → AgentItem в инбоксе роли. Без LLM (Фаза D добавит черновики).
 *
 * emitEvent() вызывается из доменных API (grading, attendance, tests). Обработка
 * синхронная, но ошибки агента НИКОГДА не валят основной запрос (всё в try/catch).
 */

type Scale = 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER';

interface EventCtx {
  actorUserId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  payload: Record<string, unknown>;
}

const LOW_GRADE_THRESHOLDS: Partial<Record<Scale, number>> = { FIVE: 2, TWELVE: 4, HUNDRED: 40 };

function isLowGrade(value: number, scale: Scale): boolean {
  const t = LOW_GRADE_THRESHOLDS[scale];
  return t !== undefined && value <= t;
}

async function ruleEnabled(key: string): Promise<boolean> {
  const rule = await prisma.agentRule.findUnique({ where: { key }, select: { enabled: true } });
  return rule ? rule.enabled : true; // нет строки = правило активно по умолчанию
}

export async function createItem(args: {
  ruleKey?: string | null; eventId?: string | null; forUserId?: string | null; forRole?: string | null;
  studentId?: string | null; kind: string; severity?: string; title: string; body: string;
  payload?: Record<string, unknown>;
}) {
  const item = await prisma.agentItem.create({
    data: {
      ruleKey: args.ruleKey ?? null, eventId: args.eventId ?? null,
      forUserId: args.forUserId ?? null, forRole: args.forRole ?? null,
      studentId: args.studentId ?? null, kind: args.kind, severity: args.severity ?? 'info',
      title: args.title, body: args.body.slice(0, 2000),
      payload: (args.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  await prisma.agentActionLog.create({ data: { itemId: item.id, action: 'created', byUserId: null } });
  // Дублируем во внешний канал (Telegram), если получатель его привязал. Best-effort.
  await notifyUser(args.forUserId, args.title, args.body);
  return item;
}

async function hasOpenItem(ruleKey: string, studentId: string, forUserId?: string | null) {
  const found = await prisma.agentItem.findFirst({
    where: {
      ruleKey, studentId, status: { in: ['new', 'in_progress'] },
      ...(forUserId ? { forUserId } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

async function parentUserIds(studentId: string): Promise<string[]> {
  const links = await prisma.parentStudent.findMany({
    where: { studentId }, select: { parent: { select: { userId: true } } },
  });
  return links.map((l) => l.parent.userId).filter(Boolean);
}

async function studentLabel(studentId: string): Promise<string> {
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
  return s ? `${s.lastName} ${s.firstName}` : 'ученика';
}

// ─── Правила ───────────────────────────────────────────────────────────────

async function ruleLowGrade(eventId: string, ctx: EventCtx) {
  const key = 'low-grade-parent-alert';
  if (!(await ruleEnabled(key))) return;
  const value = Number(ctx.payload.value);
  const scale = (ctx.payload.scale as Scale) ?? 'FIVE';
  if (!Number.isFinite(value) || !isLowGrade(value, scale)) return;
  if (!ctx.studentId) return;

  const subjectId = ctx.payload.subjectId as string | undefined;
  const subject = subjectId
    ? await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } })
    : null;
  const who = await studentLabel(ctx.studentId);
  const subjName = subject?.name ? ` по предмету «${subject.name}»` : '';

  const parents = await parentUserIds(ctx.studentId);
  const message = `Здравствуйте! ${who} получил(а) низкую оценку (${value})${subjName}. Рекомендуем уделить внимание этой теме дома; при вопросах — свяжитесь с учителем.`;

  // Исходящее наружу — через согласование (Фаза C): черновик письма учителю.
  // Учитель проверяет/правит и подтверждает → письмо уходит родителю(ям).
  if (ctx.actorUserId) {
    await createItem({
      ruleKey: key, eventId, forUserId: ctx.actorUserId, studentId: ctx.studentId, kind: 'draft', severity: 'warn',
      title: 'Письмо родителю — на согласование',
      body: message,
      payload: { proposedMessage: message, parentUserIds: parents, value, scale, subjectId },
    });
  } else {
    // нет инициатора (системное событие) — прямой алерт родителю(ям)
    for (const uid of parents) {
      await createItem({
        ruleKey: key, eventId, forUserId: uid, studentId: ctx.studentId, kind: 'alert', severity: 'warn',
        title: 'Низкая оценка у ребёнка', body: message, payload: { value, scale, subjectId },
      });
    }
  }
}

async function ruleAbsenceStreak(eventId: string, ctx: EventCtx) {
  const key = 'absence-streak-curator';
  if (!(await ruleEnabled(key))) return;
  if (ctx.payload.status !== 'absent' || !ctx.studentId) return;

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const absences = await prisma.attendance.count({
    where: { studentId: ctx.studentId, status: 'absent', date: { gte: since } },
  });
  if (absences < 3) return;

  const student = await prisma.student.findUnique({
    where: { id: ctx.studentId },
    select: { classId: true, class: { select: { curator: { select: { userId: true } } } } },
  });
  const curatorUserId = student?.class?.curator?.userId;
  if (!curatorUserId) return;
  if (await hasOpenItem(key, ctx.studentId, curatorUserId)) return;

  const who = await studentLabel(ctx.studentId);
  await createItem({
    ruleKey: key, eventId, forUserId: curatorUserId, studentId: ctx.studentId, kind: 'alert', severity: 'warn',
    title: 'Частые пропуски в классе',
    body: `${who}: ${absences} пропуск(ов) за 2 недели. Стоит выяснить причину и при необходимости подключить психолога.`,
    payload: { absences },
  });
}

async function ruleTestFailed(eventId: string, ctx: EventCtx) {
  const key = 'test-failed-remedial';
  if (!(await ruleEnabled(key))) return;
  const score = Number(ctx.payload.score);
  const maxScore = Number(ctx.payload.maxScore);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return;
  if (score / maxScore >= 0.5 || !ctx.studentId) return;

  const studentUserId = ctx.payload.studentUserId as string | undefined;
  if (!studentUserId) return;
  if (await hasOpenItem(key, ctx.studentId, studentUserId)) return;

  const testTitle = (ctx.payload.testTitle as string) || 'тест';
  await createItem({
    ruleKey: key, eventId, forUserId: studentUserId, studentId: ctx.studentId, kind: 'suggestion', severity: 'info',
    title: 'Разберём сложную тему?',
    body: `Похоже, «${testTitle}» дался непросто (${score}/${maxScore}). Давай разберём слабые места — это поможет подтянуть результат.`,
    payload: { score, maxScore },
  });
}

async function ruleInvoiceOverdue(eventId: string, ctx: EventCtx) {
  const key = 'invoice-overdue-parent';
  if (!(await ruleEnabled(key))) return;
  if (!ctx.studentId) return;

  const title = (ctx.payload.title as string) || 'Оплата обучения';
  const remaining = Number(ctx.payload.remaining ?? 0);
  const penalty = Number(ctx.payload.penalty ?? 0);
  const overdueDays = Number(ctx.payload.overdueDays ?? 0);
  if (remaining <= 0) return;

  const who = await studentLabel(ctx.studentId);
  const parents = await parentUserIds(ctx.studentId);
  if (parents.length === 0) return;

  const penaltyPart = penalty > 0 ? ` Начислена пеня ${penalty.toLocaleString('ru-RU')} сом (просрочка ${overdueDays} дн, 0,1%/день).` : '';
  const body = `По счёту «${title}» (${who}) есть задолженность ${remaining.toLocaleString('ru-RU')} сом.${penaltyPart} Пожалуйста, погасите её — оплату можно внести в бухгалтерии школы.`;

  for (const uid of parents) {
    if (await hasOpenItem(key, ctx.studentId, uid)) continue; // не дублируем открытые напоминания
    await createItem({
      ruleKey: key, eventId, forUserId: uid, studentId: ctx.studentId, kind: 'alert', severity: 'urgent',
      title: 'Задолженность по оплате обучения',
      body,
      payload: { invoiceId: ctx.payload.invoiceId, remaining, penalty, overdueDays },
    });
  }
}

async function ruleCcRecommendationRequested(eventId: string, ctx: EventCtx) {
  const key = 'cc-recommendation-requested';
  if (!(await ruleEnabled(key))) return;
  const teacherUserId = ctx.payload.teacherUserId as string | undefined;
  const documentId = ctx.payload.documentId as string | undefined;
  if (!teacherUserId || !documentId) return;

  const student = ctx.studentId ? await studentLabel(ctx.studentId) : String(ctx.payload.studentName ?? 'ученика');
  const deadline = ctx.payload.requestedDeadline ? new Date(String(ctx.payload.requestedDeadline)).toLocaleDateString('ru-RU') : 'не указан';
  const title = `Запрос рекомендации для ${student}`;
  const duplicate = await prisma.agentItem.findFirst({
    where: {
      ruleKey: key,
      forUserId: teacherUserId,
      title,
      status: { in: ['new', 'in_progress'] },
    },
    select: { id: true },
  });
  if (duplicate) return;

  await createItem({
    ruleKey: key,
    eventId,
    forUserId: teacherUserId,
    studentId: ctx.studentId ?? null,
    kind: 'task',
    severity: 'urgent',
    title,
    body: `Колледж-консультант запросил рекомендацию. Дедлайн: ${deadline}.`,
    payload: { documentId },
  });
}

function intakeVerdictLabel(verdict: unknown): string {
  if (verdict === 'recommended') return 'рекомендован';
  if (verdict === 'not_recommended') return 'не рекомендован';
  if (verdict === 'redirected') return 'перенаправлен';
  return 'заключение не указано';
}

async function ruleIntakeCompleted(eventId: string, ctx: EventCtx) {
  const key = 'intake-completed-secretary';
  if (!(await ruleEnabled(key))) return;

  const childName = String(ctx.payload.childName ?? 'Поступающий');
  const verdict = ctx.payload.verdict;
  await createItem({
    ruleKey: key,
    eventId,
    forRole: 'secretary',
    kind: 'task',
    severity: 'info',
    title: '🎓 Заключение психолога по поступающему',
    body: `${childName}: ${intakeVerdictLabel(verdict)}`,
    payload: { leadId: ctx.payload.leadId, caseId: ctx.payload.caseId, verdict, childName },
  });
}

// ─── Диспетчер ───────────────────────────────────────────────────────────────

async function processEvent(eventId: string, type: string, ctx: EventCtx) {
  try {
    if (type === 'grade.created') await ruleLowGrade(eventId, ctx);
    else if (type === 'attendance.marked') await ruleAbsenceStreak(eventId, ctx);
    else if (type === 'test.completed') await ruleTestFailed(eventId, ctx);
    else if (type === 'invoice.overdue') await ruleInvoiceOverdue(eventId, ctx);
    else if (type === 'cc.recommendation.requested') await ruleCcRecommendationRequested(eventId, ctx);
    else if (type === 'intake.completed') await ruleIntakeCompleted(eventId, ctx);
    await prisma.agentEvent.update({ where: { id: eventId }, data: { processedAt: new Date() } });
  } catch (err) {
    console.error(`[agent] processEvent ${type} failed:`, err);
  }
}

/**
 * Зафиксировать событие и тут же его обработать.
 * Безопасно: любые ошибки агента проглатываются — основной запрос не падает.
 */
export async function emitEvent(type: string, ctx: EventCtx): Promise<void> {
  try {
    const event = await prisma.agentEvent.create({
      data: {
        type, actorUserId: ctx.actorUserId ?? null,
        studentId: ctx.studentId ?? null, classId: ctx.classId ?? null,
        payload: ctx.payload as Prisma.InputJsonValue,
      },
    });
    await processEvent(event.id, type, ctx);
  } catch (err) {
    console.error(`[agent] emitEvent ${type} failed:`, err);
  }
}
