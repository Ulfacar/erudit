import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { isStorageConfigured, putObject } from '@/shared/lib/storage/minio';

const MAX_RESUME_SIZE = 8 * 1024 * 1024;
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type ApplicationPayload = {
  fullName?: string;
  phone?: string;
  email?: string;
  position?: string;
  vacancyId?: string;
  message?: string;
};

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
  const fallback = 'resume';
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

function isAllowedResume(file: File) {
  const extension = getExtension(file.name);
  return ALLOWED_EXTENSIONS.has(extension) && (!file.type || ALLOWED_MIME_TYPES.has(file.type));
}

async function readPayload(request: NextRequest): Promise<{ payload: ApplicationPayload; resume: File | null }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const resumeValue = form.get('resume');
    return {
      payload: {
        fullName: cleanString(form.get('fullName')),
        phone: cleanString(form.get('phone')),
        email: cleanString(form.get('email')),
        position: cleanString(form.get('position')),
        vacancyId: cleanString(form.get('vacancyId')),
        message: cleanString(form.get('message')),
      },
      resume: resumeValue instanceof File && resumeValue.size > 0 ? resumeValue : null,
    };
  }

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    return {
      payload: {
        fullName: cleanString(body.fullName),
        phone: cleanString(body.phone),
        email: cleanString(body.email),
        position: cleanString(body.position),
        vacancyId: cleanString(body.vacancyId),
        message: cleanString(body.message),
      },
      resume: null,
    };
  }

  throw new Error('UNSUPPORTED_CONTENT_TYPE');
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { payload, resume } = await readPayload(request);
    const fullName = cleanString(payload.fullName);
    const phone = cleanString(payload.phone);

    if (!fullName || !phone) {
      return withCors(errorResponse('VALIDATION_ERROR', 'Поля fullName и phone обязательны', 400));
    }

    if (resume) {
      if (resume.size > MAX_RESUME_SIZE) {
        return withCors(errorResponse('VALIDATION_ERROR', 'Файл резюме должен быть не больше 8 МБ', 400));
      }
      if (!isAllowedResume(resume)) {
        return withCors(errorResponse('VALIDATION_ERROR', 'Разрешены только PDF, DOC, DOCX и изображения', 400));
      }
    }

    let position = cleanString(payload.position);
    const vacancyId = cleanString(payload.vacancyId) || null;

    if (!position && vacancyId) {
      const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { title: true } });
      position = vacancy?.title ?? '';
    }

    let resumeKey: string | undefined;
    if (resume && isStorageConfigured()) {
      const buffer = Buffer.from(await resume.arrayBuffer());
      const key = `candidates/${Date.now()}-${safeFileName(resume.name)}`;
      resumeKey = await putObject(key, buffer, resume.type || 'application/octet-stream');
    }

    const candidate = await prisma.candidate.create({
      data: {
        fullName,
        phone,
        email: cleanString(payload.email) || null,
        position: position || 'Не указана',
        vacancyId,
        status: 'reserve',
        resumeKey,
        note: cleanString(payload.message) || null,
      },
      select: { id: true },
    });

    return withCors(successResponse({ ok: true, id: candidate.id }, 201));
  } catch (error) {
    if (error instanceof Error && error.message === 'UNSUPPORTED_CONTENT_TYPE') {
      return withCors(errorResponse('VALIDATION_ERROR', 'Ожидается multipart/form-data или application/json', 400));
    }
    console.error('POST /api/v1/public/applications error:', error);
    return withCors(errorResponse('INTERNAL_ERROR', 'Не удалось отправить отклик', 500));
  }
}
