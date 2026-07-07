import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

type SubjectCardType = 'parent' | 'teacher';

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as SubjectCardType | null;
  const id = searchParams.get('id');

  if (!type || !['parent', 'teacher'].includes(type) || !id) {
    return errorResponse('VALIDATION_ERROR', 'Нужны type=parent|teacher и id');
  }

  try {
    const [cases, appointments, parent] = await Promise.all([
      prisma.psyCase.findMany({
        where: { subjectType: type, subjectId: id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, stage: true, riskLevel: true, status: true },
      }),
      prisma.psyAppointment.findMany({
        where: { withType: type, withId: id },
        orderBy: { at: 'desc' },
        select: { at: true, topic: true, kind: true, status: true, trainingType: true },
      }),
      type === 'parent'
        ? prisma.parent.findUnique({
            where: { id },
            select: {
              children: {
                select: {
                  student: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      class: { select: { grade: true, letter: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    const children = parent?.children.map(({ student }) => ({
      studentId: student.id,
      name: `${student.lastName} ${student.firstName}`,
      className: student.class ? `${student.class.grade}${student.class.letter}` : '—',
    }));

    return successResponse({
      type,
      cases,
      appointments,
      ...(type === 'parent' ? { children: children ?? [] } : {}),
    });
  } catch (e) {
    console.error('GET psy/subject-card error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить карточку субъекта', 500);
  }
}
