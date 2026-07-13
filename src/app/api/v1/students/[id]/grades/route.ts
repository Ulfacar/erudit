import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    // Психологи и колл-центр не имеют доступа к академическим оценкам ученика.
    if (role === 'psychologist' || role === 'senior_psychologist' || role === 'call_center') {
      return errorResponse('FORBIDDEN', 'Доступ к оценкам ограничен для вашей роли', 403);
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get('periodId');

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parentLinks: { select: { parentId: true } },
        user: { select: { id: true } },
      },
    });
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404);
    }
    if (role !== 'student' && role !== 'parent') {
      const allowed = await canAccessStudent(role, userId, id, auth.session.user.branchId);
      if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);
    }
    if (role === 'student' && student.user?.id !== userId) {
      return errorResponse('FORBIDDEN', 'Доступ запрещён', 403);
    }
    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId },
        select: { id: true },
      });
      const ok = parent ? student.parentLinks.some((pl) => pl.parentId === parent.id) : false;
      if (!ok) {
        return errorResponse('FORBIDDEN', 'Доступ запрещён', 403);
      }
    }

    const whereGrade: Record<string, unknown> = { studentId: id };
    if (periodId) {
      whereGrade.periodId = periodId;
    }
    // По ТЗ: ученик и родитель видят только утверждённые оценки
    if (role === 'parent' || role === 'student') {
      whereGrade.status = 'published';
    }

    const grades = await prisma.grade.findMany({
      where: whereGrade,
      include: {
        subject: true,
        category: true,
        period: true,
        teacher: true,
      },
      orderBy: [{ subject: { name: 'asc' } }, { date: 'asc' }],
    });

    // Group by subject
    const grouped: Record<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectColor: string | null;
        grades: {
          id: string;
          value: number;
          weight: number;
          categoryName: string;
          date: string;
          periodName: string;
          teacherName: string;
          status: string;
        }[];
        weightedAverage: number;
      }
    > = {};

    for (const grade of grades) {
      const sid = grade.subjectId;
      if (!grouped[sid]) {
        grouped[sid] = {
          subjectId: sid,
          subjectName: grade.subject.name,
          subjectColor: grade.subject.color,
          grades: [],
          weightedAverage: 0,
        };
      }

      grouped[sid].grades.push({
        id: grade.id,
        value: grade.value,
        weight: grade.category.weight,
        categoryName: grade.category.name,
        date: grade.date.toISOString(),
        periodName: grade.period.name,
        teacherName: `${grade.teacher.lastName} ${grade.teacher.firstName}`,
        status: grade.status,
      });
    }

    // Calculate weighted averages
    for (const sid of Object.keys(grouped)) {
      const entry = grouped[sid];
      let totalWeightedValue = 0;
      let totalWeight = 0;
      for (const g of entry.grades) {
        totalWeightedValue += g.value * g.weight;
        totalWeight += g.weight;
      }
      entry.weightedAverage =
        totalWeight > 0 ? Math.round((totalWeightedValue / totalWeight) * 100) / 100 : 0;
    }

    return successResponse(Object.values(grouped));
  } catch (error) {
    console.error('GET /api/v1/students/[id]/grades error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка при получении оценок ученика', 500);
  }
}
