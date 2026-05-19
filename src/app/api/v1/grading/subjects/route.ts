import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET subjects taught in a specific class (via TeacherSubject assignments).
 * Query param: classId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return errorResponse('VALIDATION_ERROR', 'Параметр classId обязателен');
    }

    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classId },
      include: {
        subject: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Deduplicate subjects (multiple teachers can teach same subject)
    const seen = new Set<string>();
    const subjects = [];
    for (const ts of teacherSubjects) {
      if (!seen.has(ts.subject.id)) {
        seen.add(ts.subject.id);
        subjects.push(ts.subject);
      }
    }

    subjects.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return successResponse(subjects);
  } catch (error) {
    console.error('GET /api/v1/grading/subjects error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить предметы', 500);
  }
}
