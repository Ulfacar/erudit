import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { dataUrlToBuffer, isStorageConfigured, presignedGet, putObject, removeObject } from '@/shared/lib/storage/minio';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const { audioBase64 } = (await request.json().catch(() => ({}))) as { audioBase64?: string };
  if (!audioBase64) return errorResponse('VALIDATION_ERROR', 'Нужна аудиозапись');

  const session = await prisma.psySession.findUnique({
    where: { id },
    select: { id: true, caseId: true, audioKey: true },
  });
  if (!session) return errorResponse('NOT_FOUND', 'Сессия не найдена', 404);

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, session.caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  if (!isStorageConfigured()) return errorResponse('INTERNAL_ERROR', 'Хранилище не настроено', 500);

  try {
    const { buffer, contentType } = dataUrlToBuffer(audioBase64);
    const key = await putObject(`cases/${session.caseId}/audio/${id}-${Date.now()}.webm`, buffer, contentType);
    if (session.audioKey) {
      try { await removeObject(session.audioKey); } catch (e) { console.error('psy audio: не удалось удалить старый объект (осиротел)', session.audioKey, e); }
    }
    await prisma.psySession.update({ where: { id }, data: { audioKey: key, audioSetAt: new Date() } });
    return successResponse({ audioKey: key }, 201);
  } catch (e) {
    console.error('POST psy/sessions/[id]/audio error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить аудио', 500);
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const session = await prisma.psySession.findUnique({
    where: { id },
    select: { caseId: true, audioKey: true },
  });
  if (!session) return errorResponse('NOT_FOUND', 'Сессия не найдена', 404);

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, session.caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }
  if (!session.audioKey) return errorResponse('NOT_FOUND', 'Аудио не найдено', 404);

  try {
    const url = await presignedGet(session.audioKey, 600);
    return successResponse({ url });
  } catch (e) {
    console.error('GET psy/sessions/[id]/audio error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить аудио', 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const session = await prisma.psySession.findUnique({
    where: { id },
    select: { caseId: true, audioKey: true },
  });
  if (!session) return errorResponse('NOT_FOUND', 'Сессия не найдена', 404);

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, session.caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  try {
    if (session.audioKey) {
      await removeObject(session.audioKey);
      await prisma.psySession.update({ where: { id }, data: { audioKey: null, audioSetAt: null } });
    }
    return successResponse({ id });
  } catch (e) {
    console.error('DELETE psy/sessions/[id]/audio error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить аудио', 500);
  }
}
