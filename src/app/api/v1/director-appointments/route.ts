import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const VIEW = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;
const DIRECTOR = ['super_admin', 'analyst', 'zavuch'] as const; // кто подтверждает

/** GET — список записей к директору (новые сверху). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...VIEW] });
  if (auth.response) return auth.response;
  try {
    const rows = await prisma.directorAppointment.findMany({ orderBy: { desiredAt: 'asc' } });
    return successResponse(rows);
  } catch (e) {
    console.error('GET director-appointments error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить записи', 500);
  }
}

/** POST — создать запись (ассистент/секретарь). */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...VIEW] });
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const { topic, studentName, desiredAt, note } = body as Record<string, unknown>;
  if (!topic || !String(topic).trim()) return errorResponse('VALIDATION_ERROR', 'Укажите тему встречи');
  if (!desiredAt) return errorResponse('VALIDATION_ERROR', 'Укажите желаемые дату и время');
  try {
    const row = await prisma.directorAppointment.create({
      data: {
        requesterId: auth.session.user.id,
        topic: String(topic).trim(),
        studentName: studentName ? String(studentName).trim() : null,
        desiredAt: new Date(String(desiredAt)),
        note: note ? String(note).trim() : null,
      },
    });
    return successResponse(row, 201);
  } catch (e) {
    console.error('POST director-appointments error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать запись', 500);
  }
}

/** PATCH — подтвердить/отклонить (директор). body: { id, status } */
export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...DIRECTOR] });
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const id = body.id ? String(body.id) : null;
  const status = body.status === 'confirmed' || body.status === 'declined' ? body.status : null;
  if (!id || !status) return errorResponse('VALIDATION_ERROR', 'Нужны id и корректный статус');
  try {
    const row = await prisma.directorAppointment.update({
      where: { id },
      data: { status, decidedById: auth.session.user.id, decidedAt: new Date() },
    });
    return successResponse(row);
  } catch (e) {
    console.error('PATCH director-appointments error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить запись', 500);
  }
}
