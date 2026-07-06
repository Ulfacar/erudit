import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { createItem } from '@/shared/lib/agent/engine';
import { sendWebPush } from '@/shared/lib/agent/webpush';

const DAY = 86400000;
const OPEN_ITEM_STATUSES = ['new', 'in_progress'];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysLeft(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / DAY);
}

async function hasOpenApplicationItem(args: {
  forUserId?: string | null;
  forRole?: string | null;
  applicationId: string;
  payloadKind?: string;
}) {
  const found = await prisma.agentItem.findFirst({
    where: {
      status: { in: OPEN_ITEM_STATUSES },
      ...(args.forUserId ? { forUserId: args.forUserId } : {}),
      ...(args.forRole ? { forRole: args.forRole } : {}),
      AND: [
        { payload: { path: ['applicationId'], equals: args.applicationId } },
        ...(args.payloadKind ? [{ payload: { path: ['kind'], equals: args.payloadKind } }] : []),
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

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
    const today = startOfToday();
    const in14d = new Date(today.getTime() + 14 * DAY);
    const apps = await prisma.ccApplication.findMany({
      where: {
        admissionStatus: { in: ['scouting', 'document_prep'] },
        deadlineDate: { gte: today, lte: in14d },
      },
      include: {
        profile: {
          include: {
            student: { select: { firstName: true, lastName: true, middleName: true } },
            documents: {
              where: {
                docType: { in: ['essay', 'personal_statement'] },
                status: 'not_started',
              },
            },
          },
        },
      },
      orderBy: { deadlineDate: 'asc' },
    });

    let tasks = 0;
    let escalations = 0;
    for (const app of apps) {
      const counselorId = app.profile.counselorId;
      if (!counselorId || !app.deadlineDate) continue;

      const title = `Критический дедлайн: подача в ${app.universityName}`;
      const duplicate = await hasOpenApplicationItem({
        forUserId: counselorId,
        applicationId: app.id,
      });
      if (!duplicate) {
        const student = [app.profile.student.lastName, app.profile.student.firstName, app.profile.student.middleName].filter(Boolean).join(' ');
        const left = daysLeft(app.deadlineDate);
        await createItem({
          ruleKey: 'cc-deadline-14d',
          forUserId: counselorId,
          studentId: app.profile.studentId,
          kind: 'task',
          severity: 'urgent',
          title,
          body: `${student}: дедлайн ${app.deadlineDate.toLocaleDateString('ru-RU')} (${left} дн.). Проверьте документы и статус заявки.`,
          payload: { applicationId: app.id },
        });
        tasks += 1;
      }

      if (daysLeft(app.deadlineDate) <= 5 && app.profile.documents.length > 0) {
        const directors = await prisma.user.findMany({
          where: { role: { in: ['founder', 'super_admin'] }, isActive: true },
          select: { id: true },
        });
        const riskTitle = '\u0410\u043a\u0430\u0434\u0435\u043c\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0440\u0438\u0441\u043a\u0438';
        const riskBody = `${app.universityName}: \u044d\u0441\u0441\u0435 \u0438\u043b\u0438 personal statement \u043d\u0435 \u043d\u0430\u0447\u0430\u0442\u044b, \u0434\u0435\u0434\u043b\u0430\u0439\u043d \u0431\u043b\u0438\u0437\u043a\u043e`;
        for (const director of directors) {
          const duplicateRisk = await hasOpenApplicationItem({
            forUserId: director.id,
            applicationId: app.id,
            payloadKind: 'essay_risk',
          });
          if (duplicateRisk) continue;

          await createItem({
            ruleKey: 'cc-essay-risk',
            forUserId: director.id,
            studentId: app.profile.studentId,
            kind: 'alert',
            severity: 'urgent',
            title: riskTitle,
            body: riskBody,
            payload: { applicationId: app.id, kind: 'essay_risk' },
          });
          await sendWebPush(
            director.id,
            riskTitle,
            riskBody,
            '/cc/reports',
          );
          escalations += 1;
        }
      }
    }

    return successResponse({ tasks, escalations, checked: apps.length, at: new Date().toISOString() });
  } catch (error) {
    console.error('GET /api/cron/cc-deadlines error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обработать CC-дедлайны', 500);
  }
}
