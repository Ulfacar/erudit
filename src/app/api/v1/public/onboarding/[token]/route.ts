import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { checkPublicRateLimit } from '@/shared/lib/rate-limit';
import { isStorageConfigured, putObject } from '@/shared/lib/storage/minio';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Context = { params: Promise<{ token: string }> };

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const { token } = await ctx.params;
    const record = await prisma.employeeOnboarding.findUnique({
      where: { inviteToken: token },
      select: { fullName: true, position: true, status: true },
    });

    if (!record) {
      return withCors(errorResponse('NOT_FOUND', 'Приглашение не найдено', 404));
    }

    return withCors(successResponse(record));
  } catch (error) {
    console.error('GET /api/v1/public/onboarding/[token] error:', error);
    return withCors(errorResponse('INTERNAL_ERROR', 'Не удалось загрузить приглашение', 500));
  }
}

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const rl = checkPublicRateLimit(request, 'onboarding-submit', 10, 60 * 60 * 1000);
    if (rl.limited) {
      const res = errorResponse('RATE_LIMITED', 'Слишком много отправок. Попробуйте позже.', 429);
      res.headers.set('Retry-After', String(rl.retryAfterSec));
      return withCors(res);
    }

    const { token } = await ctx.params;
    const record = await prisma.employeeOnboarding.findUnique({ where: { inviteToken: token } });

    if (!record) {
      return withCors(errorResponse('NOT_FOUND', 'Приглашение не найдено', 404));
    }

    const form = await request.formData();
    const data = {
      fullName: cleanString(form.get('fullName')),
      position: cleanString(form.get('position')),
      phone: cleanString(form.get('phone')),
      email: cleanString(form.get('email')),
      education: cleanString(form.get('education')),
      experience: cleanString(form.get('experience')),
    };
    const files = form.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return withCors(errorResponse('VALIDATION_ERROR', 'Файл должен быть не больше 8 МБ', 400));
      }
      if (!isAllowedFile(file)) {
        return withCors(errorResponse('VALIDATION_ERROR', 'Разрешены только PDF, DOC, DOCX и изображения', 400));
      }
    }

    if (isStorageConfigured()) {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const key = `onboarding/${record.id}/${Date.now()}-${safeFileName(file.name)}`;
        await putObject(key, buffer, file.type || 'application/octet-stream');
        await prisma.documentRecord.create({
          data: {
            ownerType: 'staff',
            ownerId: record.id,
            kind: 'Скан (онбординг)',
            title: file.name.slice(0, 200),
            fileUrl: key,
            fileName: file.name.slice(0, 200),
            authorId: record.createdById,
          },
        });
      }
    }

    await prisma.employeeOnboarding.update({
      where: { id: record.id },
      data: {
        data,
        status: 'submitted',
        ...(data.fullName ? { fullName: data.fullName } : {}),
        ...(data.position ? { position: data.position } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.email ? { email: data.email } : {}),
      },
    });

    return withCors(successResponse({ ok: true }));
  } catch (error) {
    console.error('POST /api/v1/public/onboarding/[token] error:', error);
    return withCors(errorResponse('INTERNAL_ERROR', 'Не удалось отправить анкету', 500));
  }
}
