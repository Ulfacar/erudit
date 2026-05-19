import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/shared/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const periodId = searchParams.get('periodId');
    const studentId = searchParams.get('studentId');

    const where: Record<string, unknown> = {};
    // Родитель/ученик видят только утверждённые (опубликованные) оценки
    if (role === 'parent' || role === 'student') {
      where.status = 'published';
    }

    if (subjectId) where.subjectId = subjectId;
    if (periodId) where.periodId = periodId;
    if (studentId) where.studentId = studentId;
    if (classId) where.student = { classId };

    const grades = await prisma.grade.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        subject: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true, weight: true },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        period: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    // Add editWindowExpired flag: true if grade was created > 24 hours ago
    const now = new Date();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const enrichedGrades = grades.map((grade) => ({
      ...grade,
      editWindowExpired: now.getTime() - new Date(grade.createdAt).getTime() > TWENTY_FOUR_HOURS,
    }));

    return successResponse(enrichedGrades);
  } catch (error) {
    console.error('GET /api/v1/grading error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить оценки', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 100 requests per minute per IP
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, 100, 60000)) {
      return errorResponse('RATE_LIMITED', 'Слишком много запросов. Попробуйте позже.', 429);
    }

    const auth = await withAuth(request, { roles: ['teacher', 'curator', 'super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const {
      studentId,
      subjectId,
      categoryId,
      teacherId,
      periodId,
      value,
      date,
      scale,
      comment,
    } = body as {
      studentId?: string;
      subjectId?: string;
      categoryId?: string;
      teacherId?: string;
      periodId?: string;
      value?: number;
      date?: string;
      scale?: 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER';
      comment?: string;
    };

    if (!studentId || !subjectId || !categoryId || !teacherId || !periodId || value === undefined || !date) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Все поля обязательны: studentId, subjectId, categoryId, teacherId, periodId, value, date',
      );
    }

    const gradeScale = scale ?? 'FIVE';
    const ranges: Record<string, [number, number]> = {
      FIVE: [1, 5],
      TWELVE: [1, 12],
      HUNDRED: [0, 100],
      LETTER: [0, 14],
    };
    const [min, max] = ranges[gradeScale] ?? ranges.FIVE;
    if (value < min || value > max) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Оценка по шкале ${gradeScale} должна быть от ${min} до ${max}`,
      );
    }

    if (comment && comment.length > 500) {
      return errorResponse('VALIDATION_ERROR', 'Комментарий — не более 500 символов');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404);
    }

    const category = await prisma.gradeCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      return errorResponse('NOT_FOUND', 'Категория оценки не найдена', 404);
    }

    // По ТЗ: на модерацию идут только Контрольные / Зачёт / Триместровая / Итоговая / Экзамен —
    // помечены флагом requiresModeration в GradeCategory. Все остальные (включая
    // Олимпиадные, Эссе, Диктанты и т.д. — даже с большим весом) публикуются сразу,
    // у педагога 24ч на правку (`Grade.createdAt`).
    const initialStatus = category.requiresModeration ? 'submitted' : 'published';

    const grade = await prisma.grade.create({
      data: {
        studentId,
        subjectId,
        categoryId,
        teacherId,
        periodId,
        value,
        scale: gradeScale,
        comment: comment || null,
        date: new Date(date),
        status: initialStatus,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
        category: {
          select: { id: true, name: true, weight: true },
        },
      },
    });

    // Create audit log entry
    await prisma.gradeAuditLog.create({
      data: {
        gradeId: grade.id,
        userId: auth.session.user.id,
        oldValue: null,
        newValue: value,
        action: 'created',
      },
    });

    return successResponse(grade, 201);
  } catch (error) {
    console.error('POST /api/v1/grading error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать оценку', 500);
  }
}
