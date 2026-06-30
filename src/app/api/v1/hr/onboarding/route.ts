import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'hr'];

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ROLES });
    if (auth.response) return auth.response;

    const list = await prisma.employeeOnboarding.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(list);
  } catch (error) {
    console.error('GET /api/v1/hr/onboarding error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить анкеты онбординга', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ROLES });
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const fullName = cleanString(body.fullName);

    if (!fullName) {
      return errorResponse('VALIDATION_ERROR', 'Поле fullName обязательно', 400);
    }

    const inviteToken = randomBytes(24).toString('hex');
    const created = await prisma.employeeOnboarding.create({
      data: {
        fullName,
        position: cleanString(body.position) || null,
        phone: cleanString(body.phone) || null,
        email: cleanString(body.email) || null,
        inviteToken,
        status: 'invited',
        createdById: auth.session.user.id,
      },
      select: { id: true, inviteToken: true },
    });

    return successResponse({ ...created, link: `/onboarding/${inviteToken}` }, 201);
  } catch (error) {
    console.error('POST /api/v1/hr/onboarding error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать приглашение', 500);
  }
}
