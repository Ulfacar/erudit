import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { dataUrlToBuffer, isStorageConfigured, presignedGet, putObject, removeObject } from '@/shared/lib/storage/minio';

const ROLES = ['uniform_manager', 'super_admin'] as const;

function extensionFromContentType(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'bin';
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) return errorResponse('INTERNAL_ERROR', 'Хранилище не настроено', 500);

  const { id } = await ctx.params;
  const item = await prisma.uniformItem.findUnique({ where: { id }, select: { id: true, imageKey: true } });
  if (!item) return errorResponse('NOT_FOUND', 'Товар не найден', 404);

  const { imageBase64 } = (await request.json().catch(() => ({}))) as { imageBase64?: string };
  if (!imageBase64) return errorResponse('VALIDATION_ERROR', 'Нужно изображение');

  try {
    const { buffer, contentType } = dataUrlToBuffer(imageBase64);
    if (!contentType.startsWith('image/')) {
      return errorResponse('VALIDATION_ERROR', 'Можно загружать только изображения');
    }

    const ext = extensionFromContentType(contentType);
    const imageKey = await putObject(`uniform/${id}/${Date.now()}.${ext}`, buffer, contentType);
    const updated = await prisma.uniformItem.update({
      where: { id },
      data: { imageKey },
      select: { id: true, imageKey: true },
    });
    if (item.imageKey) {
      try {
        await removeObject(item.imageKey);
      } catch (e) {
        console.error('uniform photo: старый объект осиротел', item.imageKey, e);
      }
    }

    return successResponse(updated, 201);
  } catch (error) {
    console.error('POST /api/v1/uniform/items/[id]/photo error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить фото товара', 500);
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) return errorResponse('INTERNAL_ERROR', 'Хранилище не настроено', 500);

  const { id } = await ctx.params;
  const item = await prisma.uniformItem.findUnique({ where: { id }, select: { imageKey: true } });
  if (!item) return errorResponse('NOT_FOUND', 'Товар не найден', 404);
  if (!item.imageKey) return errorResponse('NOT_FOUND', 'Фото не найдено', 404);

  try {
    const url = await presignedGet(item.imageKey, 600);
    return successResponse({ url });
  } catch (error) {
    console.error('GET /api/v1/uniform/items/[id]/photo error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить фото товара', 500);
  }
}
