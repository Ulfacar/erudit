import { NextResponse, type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { createCrud } from '@/shared/lib/crud';
import { prisma } from '@/shared/lib/prisma';
import { withAuth } from '@/shared/lib/api-auth';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { sendWebPush, isWebPushConfigured } from '@/shared/lib/agent/webpush';

const WRITE = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'safeguarding_lead', 'event_manager'] as const;
const LIST_ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist', 'student', 'parent', 'safeguarding_lead', 'event_manager'] as const satisfies readonly Role[];
const EVENT_SOCIAL_GOALS = ['integration', 'adaptation', 'teambuilding', 'friendship', 'tradition', 'discipline_council', 'civic'] as const;
type EventSocialGoalValue = (typeof EVENT_SOCIAL_GOALS)[number];

// GET/DELETE — из общего CRUD; POST переопределён, чтобы уведомлять учеников/родителей.
const crud = createCrud({
  model: 'schoolEvent',
  listRoles: [...LIST_ROLES],
  writeRoles: [...WRITE],
  createFields: ['title', 'description', 'date', 'endDate', 'location', 'audience'],
  dateFields: ['date', 'endDate'],
  injectUserId: 'organizerId',
  orderBy: { date: 'asc' },
});
export const DELETE = crud.DELETE;

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...LIST_ROLES] });
  if (auth.response) return auth.response;

  const response = await crud.GET(request);
  const role = auth.session.user.role;
  if (role !== 'student' && role !== 'parent') return response;

  const body = await response.json().catch(() => null) as { data?: unknown } | null;
  if (!body || !Array.isArray(body.data)) {
    return NextResponse.json(body, { status: response.status });
  }

  return NextResponse.json(
    {
      ...body,
      data: body.data.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const publicItem = { ...(item as Record<string, unknown>) };
        delete publicItem.socialGoal;
        delete publicItem.targetClassIds;
        return publicItem;
      }),
    },
    { status: response.status },
  );
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...WRITE] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { title, description, date, endDate, location, audience, socialGoal, targetClassIds } = body as Record<string, unknown>;
  if (!title || !date) return errorResponse('VALIDATION_ERROR', 'Нужны название и дата');

  const normalizedSocialGoal = socialGoal ? String(socialGoal) : null;
  if (normalizedSocialGoal && !EVENT_SOCIAL_GOALS.includes(normalizedSocialGoal as EventSocialGoalValue)) {
    return errorResponse('VALIDATION_ERROR', 'Недопустимая социальная цель');
  }
  const normalizedTargetClassIds = Array.isArray(targetClassIds)
    ? [...new Set(targetClassIds.filter((classId): classId is string => typeof classId === 'string' && classId.trim().length > 0).map((classId) => classId.trim()))]
    : [];

  try {
    const event = await prisma.schoolEvent.create({
      data: {
        title: String(title),
        description: description ? String(description) : null,
        date: new Date(String(date)),
        endDate: endDate ? new Date(String(endDate)) : null,
        location: location ? String(location) : null,
        audience: Array.isArray(audience) ? (audience as string[]) : [],
        socialGoal: normalizedSocialGoal as EventSocialGoalValue | null,
        targetClassIds: normalizedTargetClassIds,
        organizerId: auth.session.user.id,
      },
    });

    // Уведомить учеников и родителей (best-effort; запрос только если push настроен).
    if (isWebPushConfigured()) {
      try {
        const users = await prisma.user.findMany({ where: { role: { in: ['student', 'parent'] } }, select: { id: true } });
        const d = new Date(String(date)).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
        await Promise.all(users.map((u) => sendWebPush(u.id, 'Новое мероприятие', `${String(title)} — ${d}`, '/events')));
      } catch (e) { console.error('event notify failed:', e); }
    }

    return successResponse(event, 201);
  } catch (e) {
    console.error('POST events error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать мероприятие', 500);
  }
}
