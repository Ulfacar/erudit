import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';

const ROLES = ['parent', 'student', 'uniform_manager', 'super_admin'] as const;

async function resolveStudent(
  role: string,
  userId: string,
  bodyStudentId?: string,
): Promise<{ id: string } | { error: string; code: number }> {
  if (role === 'student') {
    const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
    if (!self) return { error: 'Профиль ученика не найден', code: 403 };
    if (bodyStudentId && bodyStudentId !== self.id) return { error: 'Это не ваш профиль ученика', code: 403 };
    return { id: self.id };
  }

  if (role === 'parent') {
    if (!bodyStudentId) return { error: 'Укажите ребёнка', code: 400 };
    const link = await prisma.parentStudent.findFirst({
      where: { studentId: bodyStudentId, parent: { userId } },
      select: { studentId: true },
    });
    if (!link) return { error: 'Это не ваш ребёнок', code: 403 };
    return { id: bodyStudentId };
  }

  if (!bodyStudentId) return { error: 'Укажите ученика', code: 400 };
  return { id: bodyStudentId };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const role = auth.session.user.role;
    const userId = auth.session.user.id;
    const { searchParams } = new URL(request.url);
    const requestedStudentId = searchParams.get('studentId')?.trim();

    let studentIds: string[] | undefined;

    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Профиль ученика не найден', 403);
      if (requestedStudentId && requestedStudentId !== self.id) {
        return errorResponse('FORBIDDEN', 'Это не ваш профиль ученика', 403);
      }
      studentIds = [self.id];
    } else if (role === 'parent') {
      const links = await prisma.parentStudent.findMany({
        where: { parent: { userId } },
        select: { studentId: true },
      });
      const childrenIds = links.map((link) => link.studentId);
      if (requestedStudentId) {
        if (!childrenIds.includes(requestedStudentId)) {
          return errorResponse('FORBIDDEN', 'Это не ваш ребёнок', 403);
        }
        studentIds = [requestedStudentId];
      } else {
        studentIds = childrenIds;
      }
    } else if (requestedStudentId) {
      const allowed = await canAccessStudent(role, userId, requestedStudentId, auth.session.user.branchId);
      if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);
      studentIds = [requestedStudentId];
    }

    const rows = await prisma.uniformIssue.findMany({
      where: studentIds ? { studentId: { in: studentIds } } : {},
      select: {
        id: true,
        item: { select: { name: true } },
        size: true,
        status: true,
        paid: true,
        amount: true,
        issuedAt: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    return successResponse(rows);
  } catch (error) {
    console.error('GET /api/v1/uniform/reservations error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить брони формы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const role = auth.session.user.role;
    const userId = auth.session.user.id;
    const body = await request.json();
    const itemId = String(body.itemId ?? '').trim();
    const size = String(body.size ?? '').trim();
    const bodyStudentId = body.studentId ? String(body.studentId).trim() : undefined;

    if (!itemId || !size) {
      return errorResponse('VALIDATION_ERROR', 'Поля itemId и size обязательны');
    }

    const resolved = await resolveStudent(role, userId, bodyStudentId);
    if ('error' in resolved) return errorResponse('FORBIDDEN', resolved.error, resolved.code);

    if (role !== 'parent' && role !== 'student') {
      const allowed = await canAccessStudent(role, userId, resolved.id, auth.session.user.branchId);
      if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);
    }

    const variant = await prisma.uniformVariant.findUnique({
      where: { itemId_size: { itemId, size } },
      select: {
        id: true,
        available: true,
        item: { select: { id: true, basic: true, price: true } },
      },
    });

    if (!variant || variant.available <= 0) {
      return errorResponse('NO_STOCK', 'Нет остатка по размеру');
    }

    const student = await prisma.student.findUnique({
      where: { id: resolved.id },
      select: { id: true, class: { select: { grade: true, letter: true } } },
    });
    if (!student) return errorResponse('NOT_FOUND', 'Ученик не найден', 404);

    const issue = await prisma.uniformIssue.create({
      data: {
        status: 'reserved',
        paid: !variant.item.basic,
        amount: variant.item.basic ? 0 : (variant.item.price ?? 0),
        studentId: student.id,
        className: student.class ? `${student.class.grade}${student.class.letter}` : null,
        itemId,
        size,
        note: 'бронь',
      },
      include: {
        item: { select: { id: true, name: true, category: true, basic: true, price: true } },
      },
    });

    return successResponse(issue, 201);
  } catch (error) {
    console.error('POST /api/v1/uniform/reservations error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать бронь формы', 500);
  }
}
