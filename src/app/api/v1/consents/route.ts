import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * Согласия родителей (EduPage, Модуль 7): школа создаёт согласие (экскурсия/мероприятие),
 * родитель подтверждает/отклоняет за своего ребёнка.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const consents = await prisma.consent.findMany({
      include: { responses: { select: { studentId: true, agreed: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        select: { children: { select: { studentId: true, student: { select: { classId: true } } } } },
      });
      const children = parent?.children ?? [];
      const childClassIds = new Set(children.map((c) => c.student.classId));
      const visible = consents.filter((c) => !c.classId || childClassIds.has(c.classId));
      const data = visible.map((c) => ({
        id: c.id, title: c.title, description: c.description, eventDate: c.eventDate, classId: c.classId,
        myResponses: children.map((ch) => {
          const r = c.responses.find((x) => x.studentId === ch.studentId);
          return { studentId: ch.studentId, signed: !!r, agreed: r?.agreed ?? null };
        }),
      }));
      return successResponse(data);
    }

    // staff
    const data = consents.map((c) => ({
      id: c.id, title: c.title, description: c.description, eventDate: c.eventDate, classId: c.classId,
      agreedCount: c.responses.filter((r) => r.agreed).length,
      declinedCount: c.responses.filter((r) => !r.agreed).length,
      total: c.responses.length,
    }));
    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/consents error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить согласия', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'] });
    if (auth.response) return auth.response;
    const { title, description, eventDate, classId } = await request.json();
    if (!title) return errorResponse('VALIDATION_ERROR', 'Заголовок обязателен');
    const consent = await prisma.consent.create({
      data: {
        title, description: description ?? null,
        eventDate: eventDate ? new Date(eventDate) : null,
        classId: classId || null, authorId: auth.session.user.id,
      },
    });
    return successResponse(consent, 201);
  } catch (error) {
    console.error('POST /api/v1/consents error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать согласие', 500);
  }
}
