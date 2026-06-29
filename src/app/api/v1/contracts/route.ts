import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { createContractWithInvoices } from '@/shared/lib/finance/renew-contract';
import { canAccessStudent } from '@/shared/lib/student-access';
import { roleMatches } from '@/shared/lib/role-access';
import type { Role } from '@prisma/client';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;
const FULL_LIST_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'accountant', 'chief_accountant', 'finance_manager'];

/** GET /api/v1/contracts?studentId= — договоры (история), новые сверху. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;
  const studentId = new URL(request.url).searchParams.get('studentId');
  const role = auth.session.user.role as Role;
  const userId = auth.session.user.id;

  if (studentId) {
    const allowed = await canAccessStudent(role, userId, studentId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к договорам этого ученика', 403);
  } else if (!roleMatches(FULL_LIST_ROLES, role)) {
    return errorResponse('FORBIDDEN', 'Нет доступа к полному списку договоров', 403);
  }

  try {
    const contracts = await prisma.contract.findMany({
      where: studentId ? { studentId } : {},
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(contracts);
  } catch (e) {
    console.error('GET contracts error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить договоры', 500);
  }
}

/** POST /api/v1/contracts — создать договор + сгенерировать счета по графику. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { studentId, number, year, baseAmount, discountPct, discountNote, prepaymentPct,
    scheduleType, scheduleMonths, paymentDay, representative, startDate, generateInvoices, renew } = body as Record<string, unknown>;

  if (!studentId || !number || baseAmount === undefined) {
    return errorResponse('VALIDATION_ERROR', 'Нужны ученик, номер договора и стоимость');
  }

  try {
    const { contract, invoices } = await createContractWithInvoices({
      studentId: String(studentId),
      number: String(number),
      year: year != null ? String(year) : '',
      baseAmount: parseInt(String(baseAmount), 10) || 0,
      discountPct: discountPct as number | undefined,
      discountNote: discountNote != null ? String(discountNote) : null,
      prepaymentPct: prepaymentPct as number | undefined,
      scheduleType: scheduleType as string | undefined,
      scheduleMonths: scheduleMonths as number | undefined,
      paymentDay: paymentDay as number | undefined,
      representative: (representative as object) ?? null,
      startDate: startDate ? new Date(String(startDate)) : null,
      generateInvoices: generateInvoices as boolean | undefined,
      renew: renew === true,
      createdById: auth.session.user.id,
    });
    return successResponse({ contract, invoices }, 201);
  } catch (e) {
    console.error('POST contracts error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать договор', 500);
  }
}
