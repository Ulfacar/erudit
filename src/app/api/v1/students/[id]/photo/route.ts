import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { isStorageConfigured, presignedGet, putObject } from '@/shared/lib/storage/minio';

const WRITE_ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return errorResponse('STORAGE_UNAVAILABLE', 'Хранилище файлов не настроено', 503);
  }

  const { id } = await ctx.params;

  try {
    const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return errorResponse('VALIDATION_ERROR', 'Нужен файл photo в поле file');
    }

    if (!file.type.startsWith('image/')) {
      return errorResponse('VALIDATION_ERROR', 'Можно загружать только изображения');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, '_') || 'photo';
    const key = `students/${id}/photo-${Date.now()}-${safeName}`;

    await putObject(key, buffer, file.type || 'application/octet-stream');
    await prisma.student.update({
      where: { id },
      data: { photo: key },
    });

    return successResponse({ photo: key });
  } catch (error) {
    console.error('POST /api/v1/students/[id]/photo error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить фото ученика', 500);
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;

  const { id } = await ctx.params;

  try {
    const student = await prisma.student.findUnique({ where: { id }, select: { photo: true } });
    if (!student?.photo) {
      return errorResponse('NOT_FOUND', 'Фото не найдено', 404);
    }

    const url = await presignedGet(student.photo, 600);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('GET /api/v1/students/[id]/photo error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить фото ученика', 500);
  }
}
