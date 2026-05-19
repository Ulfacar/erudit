import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET teacher-subject assignments for a given class.
 * Used by the schedule modal to populate the "teacher + subject" dropdown.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = request.nextUrl;
    const classId = searchParams.get('classId');

    if (!classId) {
      return errorResponse('VALIDATION_ERROR', 'Параметр classId обязателен');
    }

    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classId },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        subject: { select: { id: true, name: true, color: true } },
      },
      orderBy: [
        { teacher: { lastName: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });

    return successResponse(teacherSubjects);
  } catch (error) {
    console.error('GET /api/v1/schedule/teacher-subjects error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить назначения', 500);
  }
}
