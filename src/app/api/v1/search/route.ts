import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const q = request.nextUrl.searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return successResponse({ students: [], teachers: [] });
    }

    const searchFilter = {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' as const } },
        { lastName: { contains: q, mode: 'insensitive' as const } },
        { middleName: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const [students, teachers] = await Promise.all([
      prisma.student.findMany({
        where: searchFilter,
        include: {
          class: {
            include: {
              level: true,
              curator: {
                select: { firstName: true, lastName: true, middleName: true },
              },
            },
          },
        },
        orderBy: { lastName: 'asc' },
        take: 10,
      }),
      prisma.teacher.findMany({
        where: searchFilter,
        include: {
          subjects: { include: { subject: true } },
          curatorOf: { select: { grade: true, letter: true } },
        },
        orderBy: { lastName: 'asc' },
        take: 10,
      }),
    ]);

    const studentResults = students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      middleName: s.middleName,
      photo: s.photo,
      type: 'student' as const,
      classLabel: s.class ? `${s.class.grade}${s.class.letter}` : null,
      classId: s.classId,
      curator: s.class?.curator
        ? `${s.class.curator.lastName} ${s.class.curator.firstName} ${s.class.curator.middleName || ''}`.trim()
        : null,
    }));

    const teacherResults = teachers.map((t) => {
      const uniqueSubjects = [
        ...new Map(t.subjects.map((ts) => [ts.subjectId, ts.subject])).values(),
      ];
      return {
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        middleName: t.middleName,
        photo: t.photo,
        type: 'teacher' as const,
        position: t.position,
        subjects: uniqueSubjects.map((s) => s.name),
        curatorOf: t.curatorOf.map((c) => `${c.grade}${c.letter}`),
      };
    });

    return successResponse({ students: studentResults, teachers: teacherResults });
  } catch (error) {
    console.error('GET /api/v1/search error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка поиска', 500);
  }
}
