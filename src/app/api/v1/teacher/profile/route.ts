import { NextRequest } from 'next/server';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { withAuth } from '@/shared/lib/api-auth';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { getTeacherScope } from '@/shared/lib/teacher-scope';
import { isStorageConfigured, putObject } from '@/shared/lib/storage/minio';

const SELF_ROLES: Role[] = ['teacher', 'curator'];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp']);

const teacherSelect = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  position: true,
  data: true,
} satisfies Prisma.TeacherSelect;

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeFileName(name: string) {
  const fallback = 'document';
  const sanitized = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return sanitized || fallback;
}

function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) ?? '' : '';
}

function isAllowedFile(file: File) {
  const extension = getExtension(file.name);
  return ALLOWED_EXTENSIONS.has(extension) && (!file.type || ALLOWED_MIME_TYPES.has(file.type));
}

async function getSelfTeacherId(userId: string) {
  const scope = await getTeacherScope(userId);
  return scope?.teacherId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: SELF_ROLES });
    if (auth.response) return auth.response;

    const teacherId = await getSelfTeacherId(auth.session.user.id);
    if (!teacherId) return errorResponse('NOT_FOUND', 'Профиль педагога не найден', 404);

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: teacherSelect,
    });
    if (!teacher) return errorResponse('NOT_FOUND', 'Профиль педагога не найден', 404);

    const documents = await prisma.documentRecord.findMany({
      where: { ownerType: 'teacher', ownerId: teacherId },
      select: { id: true, title: true, fileName: true, kind: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ teacher, documents });
  } catch (error) {
    console.error('GET /api/v1/teacher/profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить анкету', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: SELF_ROLES });
    if (auth.response) return auth.response;

    const teacherId = await getSelfTeacherId(auth.session.user.id);
    if (!teacherId) return errorResponse('NOT_FOUND', 'Профиль педагога не найден', 404);

    const body = await request.json().catch(() => ({}));
    const profileData =
      body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};

    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { data: profileData },
      select: teacherSelect,
    });

    return successResponse(teacher);
  } catch (error) {
    console.error('PATCH /api/v1/teacher/profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить анкету', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: SELF_ROLES });
    if (auth.response) return auth.response;

    const teacherId = await getSelfTeacherId(auth.session.user.id);
    if (!teacherId) return errorResponse('NOT_FOUND', 'Профиль педагога не найден', 404);

    if (!isStorageConfigured()) {
      return errorResponse('STORAGE_UNAVAILABLE', 'Хранилище файлов не настроено', 503);
    }

    const form = await request.formData();
    const fileValue = form.get('file');
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    if (!file) return errorResponse('VALIDATION_ERROR', 'Файл обязателен', 400);

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('VALIDATION_ERROR', 'Файл должен быть не больше 8 МБ', 400);
    }
    if (!isAllowedFile(file)) {
      return errorResponse('VALIDATION_ERROR', 'Разрешены только PDF, DOC, DOCX и изображения', 400);
    }

    const key = `documents/teacher/${teacherId}/${Date.now()}-${safeFileName(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, file.type || 'application/octet-stream');

    const doc = await prisma.documentRecord.create({
      data: {
        ownerType: 'teacher',
        ownerId: teacherId,
        kind: cleanString(form.get('kind')) || 'Скан (анкета)',
        title: file.name.slice(0, 200),
        fileUrl: key,
        fileName: file.name.slice(0, 200),
        authorId: auth.session.user.id,
      },
      select: { id: true, title: true, fileName: true, kind: true, createdAt: true },
    });

    return successResponse(doc, 201);
  } catch (error) {
    console.error('POST /api/v1/teacher/profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить документ', 500);
  }
}
