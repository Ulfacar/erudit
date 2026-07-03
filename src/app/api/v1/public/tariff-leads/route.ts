import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { prisma } from '@/shared/lib/prisma';
import {
  ADDON_MODULES,
  MONTHLY_MULTIPLIER,
  PRESETS,
  PRICING_VERSION,
  REQUIRED_ADDON_IDS,
  SCHOOL_SIZES,
  USD_RATE,
  YEAR_ONE_MULTIPLIER,
  computeTariff,
  getModuleById,
  resolveModuleIds,
  type PresetId,
  type PricingMode,
  type SchoolSizeId,
} from '@/shared/lib/tariff-config';

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
  schoolSize?: unknown;
  pricingMode?: unknown;
  presetId?: unknown;
  addonIds?: unknown;
  aiInterest?: unknown;
  website?: unknown;
};

const sizeIds = new Set(SCHOOL_SIZES.map((size) => size.id));
const publicPresetIds = new Set(PRESETS.filter((preset) => !preset.hidden).map((preset) => preset.id));
const addonIdSet = new Set(ADDON_MODULES.map((module) => module.id));

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

    if (typeof payload.schoolSize !== 'string' || !sizeIds.has(payload.schoolSize as SchoolSizeId)) {
      return withCors(errorResponse('VALIDATION_ERROR', 'Некорректный размер школы', 400));
    }

    if (payload.pricingMode !== 'preset' && payload.pricingMode !== 'custom') {
      return withCors(errorResponse('VALIDATION_ERROR', 'Некорректный режим расчёта', 400));
    }

    const schoolSize = payload.schoolSize as SchoolSizeId;
    const pricingMode = payload.pricingMode as PricingMode;
    let presetId: PresetId | null = null;
    let addonIds: string[] | null = null;

    if (pricingMode === 'preset') {
      if (typeof payload.presetId !== 'string' || !publicPresetIds.has(payload.presetId as PresetId)) {
        return withCors(errorResponse('VALIDATION_ERROR', 'Некорректный тариф', 400));
      }
      presetId = payload.presetId as PresetId;
    } else {
      addonIds = [
        ...new Set([
          ...REQUIRED_ADDON_IDS,
          ...(Array.isArray(payload.addonIds)
            ? payload.addonIds.filter((item): item is string => typeof item === 'string' && addonIdSet.has(item))
            : []),
        ]),
      ];
    }

    const contactSchool = cleanString(payload.contactSchool, 200);
    const comment = cleanString(payload.comment, 2000);
    const aiInterest = payload.aiInterest === true;
    const quote = computeTariff({
      schoolSize,
      mode: pricingMode,
      presetId: presetId ?? undefined,
      addonIds: addonIds ?? undefined,
    });
    const selectedModules = resolveModuleIds(pricingMode, presetId ?? undefined, addonIds ?? undefined);

    const lead = await prisma.tariffLead.create({
      data: {
        contactName,
        contactPhone,
        contactSchool: contactSchool || null,
        comment: comment || null,
        schoolSize,
        pricingMode,
        presetId,
        selectedModules,
        weightTotal: quote.weightTotal,
        unitPrice: quote.unitPrice,
        annualLicence: quote.annualLicence,
        yearOne: quote.yearOne,
        monthly: quote.monthly,
        aiInterest,
        pricingSnapshot: {
          version: PRICING_VERSION,
          usdRate: USD_RATE,
          unitPrice: quote.unitPrice,
          yearOneMultiplier: YEAR_ONE_MULTIPLIER,
          monthlyMultiplier: MONTHLY_MULTIPLIER,
          modules: selectedModules
            .map((id) => {
              const module = getModuleById(id);
              return module ? { id, label: module.label, weight: module.weight } : null;
            })
            .filter(Boolean),
        },
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
