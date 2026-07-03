import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * По ТЗ уровни видимости относятся к ДЕСКРИПТОРАМ педагога:
 *   accessLevel=1 — видим мы (super_admin/analyst), завучи и сам педагог
 *   accessLevel=2 — только завучи и super_admin/analyst
 *   accessLevel=3 — только super_admin/analyst
 *
 * Базовая информация (ФИО, фото, расписание, часы, кураторство, замены) —
 * общедоступна всем аутентифицированным пользователям.
 */
function maxDescriptorLevel(role: string, isSelf: boolean): number {
  if (role === 'super_admin' || role === 'analyst') return 3;
  if (role === 'zavuch') return 2;
  if (isSelf) return 1;
  return 0;
}

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
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
        curatorOf: {
          include: {
            level: true,
            students: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
              },
              orderBy: { lastName: 'asc' },
            },
          },
        },
        scheduleEntries: {
          include: {
            subject: true,
            class: true,
            slot: true,
          },
        },
        substitutions: true,
        user: {
          select: { email: true, role: true, isActive: true, createdAt: true },
        },
      },
    });

    if (!teacher) {
      return errorResponse('NOT_FOUND', 'Педагог не найден', 404);
    }

    const totalHours = teacher.subjects.reduce((sum, ts) => sum + ts.hoursPerWeek, 0);

    // Enrich teacher subjects with class info for study plan
    const classIds = [...new Set(teacher.subjects.map((ts) => ts.classId))];
    const classesForSubjects = await prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, grade: true, letter: true },
    });
    const classMap = Object.fromEntries(classesForSubjects.map((c) => [c.id, c]));
    const enrichedSubjects = teacher.subjects.map((ts) => ({
      ...ts,
      class: classMap[ts.classId] || null,
    }));

    // Count substitutions where this teacher was absent (original)
    const substitutionAsOriginalCount = await prisma.substitution.count({
      where: { originalTeacherId: id },
    });
    // Count substitutions where this teacher was the substitute
    const substitutionAsSubstituteCount = await prisma.substitution.count({
      where: { substituteTeacherId: id },
    });

    // Дескрипторы — фильтруем по уровню доступа текущего пользователя
    const isSelf = teacher.userId === auth.session.user.id
    const maxLevel = maxDescriptorLevel(auth.session.user.role, isSelf)
    const descriptors = maxLevel === 0
      ? []
      : await prisma.teacherDescriptor.findMany({
          where: {
            teacherId: id,
            accessLevel: { lte: maxLevel },
          },
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        })

    const fullPayload = {
      ...teacher,
      subjects: enrichedSubjects,
      totalHours,
      substitutionAsOriginalCount,
      substitutionAsSubstituteCount,
      descriptors,
      viewerMaxDescriptorLevel: maxLevel,
    };

    return successResponse(fullPayload);
  } catch (error) {
    console.error('GET /api/v1/teachers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить педагога', 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch', 'secretary'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, middleName, position, photo, hireDate } = body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Педагог не найден', 404);
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(middleName !== undefined && { middleName }),
        ...(position !== undefined && { position }),
        ...(photo !== undefined && { photo }),
        ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
      },
      include: {
        subjects: { include: { subject: true } },
        user: { select: { email: true, role: true } },
      },
    });

    return successResponse(teacher);
  } catch (error) {
    console.error('PUT /api/v1/teachers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить педагога', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Педагог не найден', 404);
    }

    await prisma.teacher.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/v1/teachers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить педагога', 500);
  }
}
