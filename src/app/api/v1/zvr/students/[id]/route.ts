import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';
import { canAccessStudent } from '@/shared/lib/student-access';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(student: { class?: { grade: number; letter: string } | null }) {
  return student.class ? `${student.class.grade}${student.class.letter}` : 'Без класса';
}

function isRecord(value: Prisma.JsonValue | null | undefined): value is Record<string, Prisma.JsonValue> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function nestedPhone(value: Prisma.JsonValue | null | undefined, key: 'mother' | 'father') {
  if (!isRecord(value) || !isRecord(value[key])) return null;
  const phone = value[key].phone;
  return typeof phone === 'string' && phone.trim() ? phone.trim() : null;
}

function parentPhones(student: {
  parentLinks: { parent: { phone: string | null } }[];
  familyData: Prisma.JsonValue | null;
}) {
  const phones = [
    ...student.parentLinks.map((link) => link.parent.phone?.trim()),
    nestedPhone(student.familyData, 'mother'),
    nestedPhone(student.familyData, 'father'),
  ].filter((phone): phone is string => Boolean(phone));

  return Array.from(new Set(phones));
}

async function ensureStudentInScope(user: { id: string; role: string; branchId?: string | null }, studentId: string) {
  const allowed = await canAccessStudent(user.role, user.id, studentId);
  if (!allowed) return { ok: false as const, response: errorResponse('FORBIDDEN', 'Forbidden', 403) };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, branchId: true },
  });
  if (!student) return { ok: false as const, response: errorResponse('NOT_FOUND', 'Ученик не найден', 404) };

  if (user.role !== 'super_admin') {
    const scope = await getBranchScope(user.id, user.role as Role, user.branchId);
    if (scope.closed || !scope.branchId || scope.branchId !== student.branchId) {
      return { ok: false as const, response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
    }
  }

  return { ok: true as const, student };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const guard = await ensureStudentInScope(auth.session.user, id);
    if (!guard.ok) return guard.response;

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        familyData: true,
        class: { select: { grade: true, letter: true } },
        parentLinks: { select: { parent: { select: { phone: true } } } },
      },
    });
    if (!student) return errorResponse('NOT_FOUND', 'Ученик не найден', 404);

    return successResponse({
      id: student.id,
      fio: fio(student),
      className: className(student),
      parentPhones: parentPhones(student),
    });
  } catch (error) {
    console.error('GET /api/v1/zvr/students/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить ученика', 500);
  }
}
