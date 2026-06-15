import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian', 'secretary'] as const;

async function withStudent(loan: { studentId: string | null }) {
  if (!loan.studentId) return null;
  return prisma.student.findUnique({
    where: { id: loan.studentId },
    select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } } },
  });
}

/**
 * GET /api/v1/library/loans?code=  — найти активную выдачу по штрихкоду (чей учебник).
 * GET /api/v1/library/loans?studentId=  — учебники, числящиеся за учеником.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const studentId = searchParams.get('studentId');

  try {
    if (code) {
      const loan = await prisma.libraryLoan.findFirst({
        where: { code, returnedAt: null },
        orderBy: { takenAt: 'desc' },
      });
      if (!loan) return successResponse(null);
      const student = await withStudent(loan);
      return successResponse({ ...loan, student });
    }
    if (studentId) {
      const loans = await prisma.libraryLoan.findMany({
        where: { studentId, returnedAt: null },
        orderBy: { takenAt: 'desc' },
      });
      return successResponse(loans);
    }
    return errorResponse('VALIDATION_ERROR', 'Укажите code или studentId');
  } catch (e) {
    console.error('GET library/loans error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить выдачи', 500);
  }
}

/** POST /api/v1/library/loans — выдать учебник (по скану/коду) ученику. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const code = body.code ? String(body.code).trim() : null;
  const studentId = body.studentId ? String(body.studentId) : null;
  const title = body.title ? String(body.title).trim() : null;
  const classId = body.classId ? String(body.classId) : null;

  if (!code) return errorResponse('VALIDATION_ERROR', 'Не указан штрихкод учебника');
  if (!studentId) return errorResponse('VALIDATION_ERROR', 'Не выбран ученик');

  try {
    // Учебник уже на руках у кого-то?
    const existing = await prisma.libraryLoan.findFirst({ where: { code, returnedAt: null } });
    if (existing) {
      const student = await withStudent(existing);
      const who = student ? `${student.lastName} ${student.firstName}` : 'другого ученика';
      return errorResponse('CONFLICT', `Этот учебник уже числится за: ${who}`, 409);
    }
    const loan = await prisma.libraryLoan.create({
      data: { code, studentId, title, classId, teacherId: auth.session.user.id },
    });
    return successResponse(loan, 201);
  } catch (e) {
    console.error('POST library/loans error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выдать учебник', 500);
  }
}

/** PATCH /api/v1/library/loans — вернуть учебник (returnedAt). */
export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = body.id ? String(body.id) : null;
  if (!id) return errorResponse('VALIDATION_ERROR', 'Не указан id выдачи');

  try {
    const loan = await prisma.libraryLoan.update({ where: { id }, data: { returnedAt: new Date() } });
    return successResponse(loan);
  } catch (e) {
    console.error('PATCH library/loans error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось вернуть учебник', 500);
  }
}
