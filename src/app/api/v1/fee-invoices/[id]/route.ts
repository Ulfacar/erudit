import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';
import type { Role } from '@prisma/client';

// Редактирование/удаление счёта по id.
// GET намеренно НЕ экспортируем: счёт по id не должен читаться родителем/учеником
// чужого ребёнка (generic .GET пускал любого авторизованного — RBAC-паттерн).
//
// Ранее использовался generic createCrudId, у которого нет ни филиальной изоляции,
// ни whitelist полей: PUT писал тело целиком в prisma.update (mass assignment),
// а PUT/DELETE не проверяли филиал ученика (findings B-1/B-2). Ниже — явные хендлеры:
// проверка доступа к ученику счёта ДО мутации + whitelist редактируемых полей.

const WRITE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'];
const INVOICE_STATUSES = ['pending', 'partial', 'paid', 'cancelled'] as const;

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: WRITE_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const invoice = await prisma.feeInvoice.findUnique({ where: { id }, select: { studentId: true } });
  if (!invoice) return errorResponse('NOT_FOUND', 'Счёт не найден', 404);

  // Филиальная изоляция: править можно только счёт ученика своего филиала (fail-closed).
  if (!(await canAccessStudent(auth.session.user.role, auth.session.user.id, invoice.studentId, auth.session.user.branchId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к счёту', 403);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Whitelist: ровно те поля, что редактирует модалка счёта (accounting UI).
  // studentId/contractId/id/системные поля через тело менять нельзя.
  const data: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body.period === null) data.period = null;
  else if (typeof body.period === 'string') data.period = body.period.trim() || null;
  if (body.amount !== undefined) {
    const amount = parseInt(String(body.amount), 10);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('VALIDATION_ERROR', 'Сумма должна быть больше нуля');
    data.amount = amount;
  }
  if (body.status !== undefined) {
    if (!INVOICE_STATUSES.includes(body.status as (typeof INVOICE_STATUSES)[number])) {
      return errorResponse('VALIDATION_ERROR', 'Недопустимый статус счёта');
    }
    data.status = body.status;
  }
  if (body.dueDate === null) data.dueDate = null;
  else if (typeof body.dueDate === 'string' && body.dueDate) data.dueDate = new Date(body.dueDate);

  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');

  try {
    const updated = await prisma.feeInvoice.update({
      where: { id },
      data,
      include: { payments: { select: { amount: true, verified: true } } },
    });
    return successResponse(updated);
  } catch (e) {
    console.error('PUT fee-invoices/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить', 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: WRITE_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const invoice = await prisma.feeInvoice.findUnique({ where: { id }, select: { studentId: true } });
  if (!invoice) return errorResponse('NOT_FOUND', 'Счёт не найден', 404);

  // Филиальная изоляция: удалять можно только счёт ученика своего филиала (fail-closed).
  if (!(await canAccessStudent(auth.session.user.role, auth.session.user.id, invoice.studentId, auth.session.user.branchId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к счёту', 403);
  }

  try {
    await prisma.feeInvoice.delete({ where: { id } });
    return successResponse({ id });
  } catch (e) {
    console.error('DELETE fee-invoices/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить', 500);
  }
}
