import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * Заказ столовой (EduPage, Модуль 6, поверх MealMenu).
 * Ученик/родитель заказывает/отменяет обед по дням. Без оплаты.
 */
async function resolveStudent(role: string, userId: string, bodyStudentId?: string): Promise<{ id: string } | { error: string; code: number }> {
  if (role === 'student') {
    const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
    if (!self) return { error: 'Профиль ученика не найден', code: 403 };
    return { id: self.id };
  }
  if (!bodyStudentId) return { error: 'Укажите ребёнка', code: 400 };
  const link = await prisma.parentStudent.findFirst({ where: { studentId: bodyStudentId, parent: { userId } }, select: { studentId: true } });
  if (!link) return { error: 'Это не ваш ребёнок', code: 403 };
  return { id: bodyStudentId };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['student', 'parent', 'super_admin', 'analyst', 'zavuch', 'secretary'] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const where: Record<string, unknown> = { status: 'ordered' };
    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      where.studentId = self?.id ?? '__none__';
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({ where: { userId }, select: { children: { select: { studentId: true } } } });
      where.studentId = { in: parent?.children.map((c) => c.studentId) ?? [] };
    }
    const orders = await prisma.mealOrder.findMany({ where, orderBy: { date: 'asc' } });
    return successResponse(orders);
  } catch (error) {
    console.error('GET /api/v1/meal-orders error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить заказы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['student', 'parent'] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const body = await request.json();
    const { date, meal, status } = body;
    if (!date || !meal) return errorResponse('VALIDATION_ERROR', 'Поля date и meal обязательны');

    const st = await resolveStudent(role, userId, body.studentId);
    if ('error' in st) return errorResponse('FORBIDDEN', st.error, st.code);

    const d = new Date(date);
    const normDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const newStatus = status === 'cancelled' ? 'cancelled' : 'ordered';

    const order = await prisma.mealOrder.upsert({
      where: { studentId_date_meal: { studentId: st.id, date: normDate, meal } },
      update: { status: newStatus },
      create: { studentId: st.id, date: normDate, meal, status: newStatus },
    });
    return successResponse(order, 201);
  } catch (error) {
    console.error('POST /api/v1/meal-orders error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось оформить заказ', 500);
  }
}
