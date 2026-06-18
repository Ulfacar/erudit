import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { putObject, isStorageConfigured } from '@/shared/lib/storage/minio';
import type { DocumentOwnerType } from '@prisma/client';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr', 'psychologist', 'senior_psychologist', 'specialist'] as const;

/**
 * POST /api/v1/documents/upload — загрузка файла документа в MinIO + запись DocumentRecord.
 * multipart/form-data: file, ownerType, ownerId, kind?, title?
 * Ключ файла кладём в DocumentRecord.fileUrl; скачивание — через /documents/file/[id].
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return errorResponse('STORAGE_UNAVAILABLE', 'Хранилище файлов не настроено', 503);
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const ownerType = String(form.get('ownerType') ?? '') as DocumentOwnerType;
    const ownerId = String(form.get('ownerId') ?? '');
    const kind = String(form.get('kind') ?? 'документ');
    const title = String(form.get('title') ?? '');

    if (!(file instanceof File) || !ownerType || !ownerId) {
      return errorResponse('VALIDATION_ERROR', 'Нужны file, ownerType, ownerId');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const key = `documents/${ownerType}/${ownerId}/${Date.now()}-${safeName}`;
    await putObject(key, buffer, file.type || 'application/octet-stream');

    const doc = await prisma.documentRecord.create({
      data: {
        ownerType, ownerId, kind,
        title: title || file.name,
        fileUrl: key,
        fileName: file.name,
        authorId: auth.session.user.id,
      },
    });
    return successResponse(doc, 201);
  } catch (e) {
    console.error('POST documents/upload error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить документ', 500);
  }
}
