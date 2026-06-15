import { type NextRequest } from 'next/server';
import { createCrud } from '@/shared/lib/crud';
import { prisma } from '@/shared/lib/prisma';
import { withAuth } from '@/shared/lib/api-auth';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { sendWebPush, isWebPushConfigured } from '@/shared/lib/agent/webpush';

const WRITE = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'safeguarding_lead'] as const;

// GET/DELETE — из общего CRUD; POST переопределён, чтобы уведомлять учеников/родителей.
const crud = createCrud({
  model: 'schoolEvent',
  writeRoles: [...WRITE],
  createFields: ['title', 'description', 'date', 'endDate', 'location', 'audience'],
  dateFields: ['date', 'endDate'],
  injectUserId: 'organizerId',
  orderBy: { date: 'asc' },
});
export const GET = crud.GET;
export const DELETE = crud.DELETE;

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...WRITE] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { title, description, date, endDate, location, audience } = body as Record<string, unknown>;
  if (!title || !date) return errorResponse('VALIDATION_ERROR', 'Нужны название и дата');

  try {
    const event = await prisma.schoolEvent.create({
      data: {
        title: String(title),
        description: description ? String(description) : null,
        date: new Date(String(date)),
        endDate: endDate ? new Date(String(endDate)) : null,
        location: location ? String(location) : null,
        audience: Array.isArray(audience) ? (audience as string[]) : [],
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
