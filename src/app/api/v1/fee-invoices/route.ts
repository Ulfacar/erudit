import { NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { createCrud } from '@/shared/lib/crud';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';

const LIST_ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager', 'secretary', 'call_center'] as const;
const WRITE_ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] as const;

const handlers = createCrud({
  model: 'feeInvoice',
  listRoles: [...LIST_ROLES],
  writeRoles: [...WRITE_ROLES],
  createFields: ['studentId', 'contractId', 'title', 'period', 'amount', 'status', 'dueDate'],
  dateFields: ['dueDate'],
  intFields: ['amount'],
  include: { payments: { select: { amount: true, verified: true } } },
  orderBy: { dueDate: 'asc' },
  filterableParams: ['status', 'studentId', 'contractId'],
  branchScope: 'student',
  branchParent: { model: 'student', fk: 'studentId' },
});

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...LIST_ROLES] });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const where: Prisma.FeeInvoiceWhereInput = {};
    const status = searchParams.get('status');
    const studentId = searchParams.get('studentId');
    const contractId = searchParams.get('contractId');
    const classId = searchParams.get('classId');

    if (status) where.status = status as Prisma.FeeInvoiceWhereInput['status'];
    if (studentId) where.studentId = studentId;
    if (contractId) where.contractId = contractId;
    if (classId) where.student = { classId };
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
    Object.assign(where, {
      student: {
        ...((where.student as Record<string, unknown> | undefined) ?? {}),
        ...branchWhere(scope),
      },
    });

    const rows = await prisma.feeInvoice.findMany({
      where,
      include: { payments: { select: { amount: true, verified: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return successResponse(rows);
  } catch (error) {
    console.error('GET feeInvoice error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить данные', 500);
  }
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
