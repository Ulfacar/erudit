import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { prisma } from '@/shared/lib/prisma';
import { computeTotals, HEAVY_MODULES, STANDARD_MODULES } from '@/shared/lib/tariff-config';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type TariffLeadPayload = {
  contactName?: unknown;
  contactPhone?: unknown;
  contactSchool?: unknown;
  comment?: unknown;
  standardModules?: unknown;
  heavyModules?: unknown;
  website?: unknown;
};

const standardModuleSet = new Set<string>(STANDARD_MODULES);
const heavyModuleSet = new Set<string>(HEAVY_MODULES);

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function cleanString(value: unknown, maxLength?: number) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return typeof maxLength === 'number' ? cleaned.slice(0, maxLength) : cleaned;
}

function cleanModuleList(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && allowed.has(item)))];
}

async function readPayload(request: NextRequest): Promise<TariffLeadPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('UNSUPPORTED_CONTENT_TYPE');
  }
  return request.json().catch(() => ({}));
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await readPayload(request);
    const website = cleanString(payload.website);

    if (website) {
      return withCors(successResponse({ ok: true }));
    }

    const contactName = cleanString(payload.contactName, 200);
    const contactPhone = cleanString(payload.contactPhone, 50);

    if (!contactName || !contactPhone) {
      return withCors(errorResponse('VALIDATION_ERROR', 'Поля contactName и contactPhone обязательны', 400));
    }

    const contactSchool = cleanString(payload.contactSchool, 200);
    const comment = cleanString(payload.comment, 2000);
    const filteredStandard = cleanModuleList(payload.standardModules, standardModuleSet);
    const filteredHeavy = cleanModuleList(payload.heavyModules, heavyModuleSet);
    const { setupTotal, licenseTotal } = computeTotals(filteredStandard, filteredHeavy);

    const lead = await prisma.tariffLead.create({
      data: {
        contactName,
        contactPhone,
        contactSchool: contactSchool || null,
        comment: comment || null,
        standardModules: filteredStandard,
        heavyModules: filteredHeavy,
        setupTotal,
        licenseTotal,
        status: 'new',
        authorId: null,
        authorName: null,
      },
      select: { id: true },
    });

    return withCors(successResponse({ ok: true, id: lead.id }, 201));
  } catch (error) {
    if (error instanceof Error && error.message === 'UNSUPPORTED_CONTENT_TYPE') {
      return withCors(errorResponse('VALIDATION_ERROR', 'Ожидается application/json', 400));
    }
    console.error('POST /api/v1/public/tariff-leads error:', error);
    return withCors(errorResponse('INTERNAL_ERROR', 'Не удалось отправить заявку', 500));
  }
}
