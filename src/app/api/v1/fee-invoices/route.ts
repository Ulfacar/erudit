import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { createCrud } from '@/shared/lib/crud';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const LIST_ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager', 'secretary', 'call_center'] as const;
const WRITE_ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] as const;

const handlers = createCrud({
  model: 'feeInvoice',
  listRoles: [...LIST_ROLES],
  writeRoles: [...WRITE_ROLES],
  createFields: ['studentId', 'contractId', 'title', 'period', 'amount', 'status', 'dueDate'],
  dateFields: ['dueDate'],
  intFields: ['amount'],
  include: { payments: { select: { amount: true } } },
  orderBy: { dueDate: 'asc' },
  filterableParams: ['status', 'studentId', 'contractId'],
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

    const rows = await prisma.feeInvoice.findMany({
      where,
      include: { payments: { select: { amount: true } } },
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
