import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, middleName: true },
    });

    if (!teacher) {
      return errorResponse('NOT_FOUND', 'Педагог не найден', 404);
    }

    const workload = await prisma.teacherSubject.findMany({
      where: { teacherId: id },
      include: {
        subject: true,
      },
    });

    const totalHours = workload.reduce((sum, ts) => sum + ts.hoursPerWeek, 0);

    // Group by class
    const byClass: Record<string, { subjectName: string; hours: number }[]> = {};
    for (const entry of workload) {
      if (!byClass[entry.classId]) {
        byClass[entry.classId] = [];
      }
      byClass[entry.classId].push({
        subjectName: entry.subject.name,
        hours: entry.hoursPerWeek,
      });
    }

    return successResponse({
      teacher,
      workload,
      totalHours,
      byClass,
    });
  } catch (error) {
    console.error('GET /api/v1/teachers/[id]/workload error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить нагрузку педагога', 500);
  }
}
