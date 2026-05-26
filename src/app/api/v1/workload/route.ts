import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'],
    });
    if (auth.response) return auth.response;

    const [teachers, classes, teacherSubjects] = await Promise.all([
      prisma.teacher.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          position: true,
        },
        orderBy: { lastName: 'asc' },
      }),
      prisma.class.findMany({
        include: { level: true },
        orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
      }),
      prisma.teacherSubject.findMany({
        include: {
          subject: true,
          teacher: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    // Build a lookup: teacherId -> classId -> { subjectId, subject, hours }[]
    const workloadMap: Record<string, Record<string, { subjectId: string; subjectName: string; subjectColor: string | null; hours: number }[]>> = {};
    for (const ts of teacherSubjects) {
      if (!workloadMap[ts.teacherId]) workloadMap[ts.teacherId] = {};
      if (!workloadMap[ts.teacherId][ts.classId]) workloadMap[ts.teacherId][ts.classId] = [];
      workloadMap[ts.teacherId][ts.classId].push({
        subjectId: ts.subjectId,
        subjectName: ts.subject.name,
        subjectColor: ts.subject.color,
        hours: ts.hoursPerWeek,
      });
    }

    return successResponse({
      teachers,
      classes,
      workloadMap,
    });
  } catch (error) {
    console.error('GET /api/v1/workload error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сводную нагрузку', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { teacherId, subjectId, classId, hoursPerWeek } = body;

    if (!teacherId || !subjectId || !classId) {
      return errorResponse('VALIDATION_ERROR', 'Поля teacherId, subjectId и classId обязательны');
    }

    const entry = await prisma.teacherSubject.upsert({
      where: {
        teacherId_subjectId_classId: {
          teacherId,
          subjectId,
          classId,
        },
      },
      create: {
        teacherId,
        subjectId,
        classId,
        hoursPerWeek: hoursPerWeek || 0,
      },
      update: {
        hoursPerWeek: hoursPerWeek || 0,
      },
      include: {
        subject: true,
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return successResponse(entry, 201);
  } catch (error) {
    console.error('POST /api/v1/workload error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось назначить предмет', 500);
  }
}
