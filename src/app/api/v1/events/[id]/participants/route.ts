import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const WRITE = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'safeguarding_lead', 'event_manager'] as const;

interface RouteParams { params: Promise<{ id: string }> }
type Activity = 'active' | 'passive' | null;

function parseActivity(value: unknown): Activity | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  if (value === 'active' || value === 'passive') return value;
  return 'invalid';
}

function achievementDescription(note: string | null, activity: Activity) {
  const activityText = activity === 'active' ? 'Активное участие' : activity === 'passive' ? 'Пассивное участие' : null;
  return [activityText, note].filter(Boolean).join('\n') || null;
}

/** GET — участники мероприятия (с отметкой «отличился»). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await withAuth(request, { roles: [...WRITE] });
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const list = await prisma.eventParticipant.findMany({ where: { eventId: id }, orderBy: { createdAt: 'asc' } });
    return successResponse(list);
  } catch (e) {
    console.error('GET event participants error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить участников', 500);
  }
}

/**
 * PUT — заменить список участников. Для «отличившихся» создаём достижение (category social,
 * level school, eventId), для снятых — убираем его. Достижение знает источник-событие (eventId).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await withAuth(request, { roles: [...WRITE] });
  if (auth.response) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body.participants) ? body.participants : [];
  const parsedRows: { studentId: string; distinguished: boolean; note: string | null; activity: Activity | 'invalid' }[] = incoming
    .filter((p: { studentId?: string }) => p.studentId)
    .map((p: { studentId: string; distinguished?: boolean; note?: string; activity?: unknown }) => {
      const activity = parseActivity(p.activity);
      return {
        studentId: String(p.studentId),
        distinguished: p.distinguished === true,
        note: p.note?.trim() || null,
        activity,
      };
    });

  if (parsedRows.some((row) => row.activity === 'invalid')) {
    return errorResponse('VALIDATION_ERROR', 'activity должен быть active, passive или null');
  }
  const rows = parsedRows as { studentId: string; distinguished: boolean; note: string | null; activity: Activity }[];

  try {
    const event = await prisma.schoolEvent.findUnique({ where: { id }, select: { id: true, title: true, date: true } });
    if (!event) return errorResponse('NOT_FOUND', 'Мероприятие не найдено', 404);

    const achievementsCreated = await prisma.$transaction(async (tx) => {
      const keepIds = rows.map((r) => r.studentId);
      await tx.eventParticipant.deleteMany({
        where: {
          eventId: id,
          studentId: { notIn: keepIds.length ? keepIds : ['__none__'] },
        },
      });
      await tx.achievement.deleteMany({
        where: {
          eventId: id,
          studentId: { notIn: keepIds.length ? keepIds : ['__none__'] },
        },
      });

      const existingAchievements = await tx.achievement.findMany({
        where: { eventId: id },
        select: { studentId: true },
      });
      const achievementStudentIds = new Set(
        existingAchievements.map((achievement) => achievement.studentId),
      );
      let created = 0;

      for (const r of rows) {
        await tx.eventParticipant.upsert({
          where: { eventId_studentId: { eventId: id, studentId: r.studentId } },
          update: { distinguished: r.distinguished, note: r.note, activity: r.activity },
          create: {
            eventId: id,
            studentId: r.studentId,
            distinguished: r.distinguished,
            note: r.note,
            activity: r.activity,
          },
        });

        const existing = achievementStudentIds.has(r.studentId);
        if (r.distinguished && !existing) {
          await tx.achievement.create({
            data: {
              studentId: r.studentId,
              title: event.title,
              description: achievementDescription(r.note, r.activity),
              category: 'social',
              level: 'school',
              place: 'отличился',
              date: event.date,
              authorId: auth.session.user.id,
              eventId: id,
            },
          });
          achievementStudentIds.add(r.studentId);
          created++;
        } else if (r.distinguished && existing) {
          await tx.achievement.updateMany({
            where: { eventId: id, studentId: r.studentId },
            data: { description: achievementDescription(r.note, r.activity) },
          });
        } else if (!r.distinguished && existing) {
          await tx.achievement.deleteMany({
            where: { eventId: id, studentId: r.studentId },
          });
          achievementStudentIds.delete(r.studentId);
        }
      }

      return created;
    });

    return successResponse({ count: rows.length, achievementsCreated });
  } catch (e) {
    console.error('PUT event participants error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить участников', 500);
  }
}
