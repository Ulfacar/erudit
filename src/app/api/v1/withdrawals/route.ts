import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';
import { canAccessStudent } from '@/shared/lib/student-access';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

/** GET /api/v1/withdrawals — журнал отчислений (с именами). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  try {
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const items = await prisma.withdrawal.findMany({ where: branchWhere(scope), orderBy: { date: 'desc' }, take: 200 });
    const ids = items.map((w) => w.studentId);
    const students = await prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
    const rows = items.map((w) => {
      const s = students.find((x) => x.id === w.studentId);
      return { ...w, studentName: s ? `${s.lastName} ${s.firstName}` : '—' };
    });
    return successResponse(rows);
  } catch (e) {
    console.error('GET withdrawals error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить отчисления', 500);
  }
}

/** POST /api/v1/withdrawals — отчислить ученика: статус withdrawn + запись + отмена счетов/договора. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const { studentId, reason } = (await request.json().catch(() => ({}))) as { studentId?: string; reason?: string };
  if (!studentId || !reason?.trim()) return errorResponse('VALIDATION_ERROR', 'Нужны ученик и причина');

  // Филиальная изоляция: нельзя отчислять ученика чужого филиала по прямому ID.
  // Проверка до транзакции и любых изменений (fail-closed, без existence-oracle).
  if (!(await canAccessStudent(auth.session.user.role, auth.session.user.id, studentId, auth.session.user.branchId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { branchId: true } });
  if (!student) return errorResponse('NOT_FOUND', 'Ученик не найден', 404);

  try {
    await prisma.$transaction([
      prisma.student.update({ where: { id: studentId }, data: { status: 'withdrawn' } }),
      prisma.withdrawal.create({ data: { studentId, reason: reason.trim(), branchId: student.branchId, authorId: auth.session.user.id } }),
      // отменяем неоплаченные счета и завершаем активный договор
      prisma.feeInvoice.updateMany({ where: { studentId, status: { in: ['pending', 'partial'] } }, data: { status: 'cancelled' } }),
      prisma.contract.updateMany({ where: { studentId, status: 'active' }, data: { status: 'cancelled' } }),
      prisma.studentNote.create({ data: { studentId, authorId: auth.session.user.id, role: auth.session.user.role, type: 'status', text: `Отчислен: ${reason.trim()}` } }),
    ]);
    return successResponse({ studentId });
  } catch (e) {
    console.error('POST withdrawals error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось отчислить', 500);
  }
}
