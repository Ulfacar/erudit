import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { emitEvent } from '@/shared/lib/agent/engine';

const STAFF_NOTE_ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'accountant', 'call_center', 'hr', 'doctor', 'safeguarding_lead'] as const;

/** GET — заметки по ученику (кросс-ролевые). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const notes = await prisma.studentNote.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' } });
    return successResponse(notes);
  } catch (e) {
    console.error('GET student notes error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить заметки', 500);
  }
}

/** POST — добавить заметку (обещание колл-центра, статус и т.п.). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...STAFF_NOTE_ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const { type, text, meta } = body as Record<string, unknown>;
  if (!text || !String(text).trim()) return errorResponse('VALIDATION_ERROR', 'Текст заметки обязателен');
  try {
    const note = await prisma.studentNote.create({
      data: {
        studentId: id,
        authorId: auth.session.user.id,
        role: auth.session.user.role,
        type: typeof type === 'string' ? type : 'note',
        text: String(text).trim(),
        meta: (meta as object) ?? undefined,
      },
    });
    // Ядро: обещание оплаты от колл-центра → live-импульс колл-центр → финансы.
    if (note.type === 'promise') {
      await emitEvent('callcenter.promise', { actorUserId: auth.session.user.id, studentId: id, payload: { noteId: note.id } });
    }
    return successResponse(note, 201);
  } catch (e) {
    console.error('POST student notes error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось добавить заметку', 500);
  }
}
