import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

/** GET /api/v1/class-reserve?classId= — очередь в класс. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const classId = url.searchParams.get('classId');
  const status = url.searchParams.get('status');
  try {
    const entries = await prisma.classReserveEntry.findMany({
      where: { ...(classId ? { classId } : {}), ...(status && status !== 'all' ? { status } : !status ? { status: 'waiting' } : {}) },
      orderBy: { position: 'asc' },
    });
    return successResponse(entries);
  } catch (e) {
    console.error('GET class-reserve error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить очередь', 500);
  }
}

/** POST /api/v1/class-reserve — добавить ребёнка в очередь (в конец). */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const { classId, childName, parentName, parentPhone, dateOfBirth, desiredYear, note } = body as Record<string, string>;
  if (!classId || !childName?.trim()) return errorResponse('VALIDATION_ERROR', 'Нужны класс и ФИО ребёнка');
  try {
    const last = await prisma.classReserveEntry.findFirst({ where: { classId, status: 'waiting' }, orderBy: { position: 'desc' }, select: { position: true } });
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { branchId: true } });
    const entry = await prisma.classReserveEntry.create({
      data: {
        classId, childName: childName.trim(),
        parentName: parentName?.trim() || null, parentPhone: parentPhone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, desiredYear: desiredYear?.trim() || null,
        note: note || null, position: (last?.position ?? 0) + 1, branchId: cls?.branchId ?? null,
      },
    });
    return successResponse(entry, 201);
  } catch (e) {
    console.error('POST class-reserve error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось добавить в очередь', 500);
  }
}

/** PATCH /api/v1/class-reserve — сменить статус (waiting/cancelled). */
export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const { id, status } = (await request.json().catch(() => ({}))) as { id?: string; status?: string };
  if (status === 'enrolled') {
    return errorResponse('VALIDATION_ERROR', 'Use enroll-flow to set enrolled status');
  }
  if (!id || !['waiting', 'cancelled'].includes(status ?? '')) {
    return errorResponse('VALIDATION_ERROR', 'Нужны id и status');
  }
  try {
    const updated = await prisma.classReserveEntry.update({ where: { id }, data: { status: status as string } });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH class-reserve error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить', 500);
  }
}
