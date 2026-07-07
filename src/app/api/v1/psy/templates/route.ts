import { NextRequest } from 'next/server';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES, getPsyScope, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

const MANAGE_ROLES = ['senior_psychologist', 'super_admin'] as const;
const FULL = ['senior_psychologist', 'psy_coordinator', 'super_admin'] as const;

function isSeniorOrSuper(role: Role): boolean {
  return MANAGE_ROLES.includes(role as (typeof MANAGE_ROLES)[number]);
}

/** GET /api/v1/psy/templates - list visible templates. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  try {
    const user = auth.session.user;
    const scope = getPsyScope(user.id, user.role as Role);
    const templates = await prisma.psyDiagnosticTemplate.findMany({
      where: FULL.includes(scope.role as (typeof FULL)[number])
        ? undefined
        : { OR: [{ isBase: true }, { isPublished: true }, { authorId: user.id }] },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
    return successResponse(templates);
  } catch (e) {
    console.error('GET psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить методики', 500);
  }
}

/** POST /api/v1/psy/templates - create a private user-owned template. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { name, metric, scaleMin, scaleMax, questions } = body as Record<string, unknown>;
  if (!name || !String(name).trim()) return errorResponse('VALIDATION_ERROR', 'Нужно название методики');

  try {
    const created = await prisma.psyDiagnosticTemplate.create({
      data: {
        name: String(name).trim(),
        version: 1,
        authorId: auth.session.user.id,
        isPublished: false,
        isBase: false,
        schema: {
          metric: metric ? String(metric) : 'балл',
          scaleMin: Number(scaleMin ?? 1),
          scaleMax: Number(scaleMax ?? 10),
          questions: Array.isArray(questions) ? questions : [],
        },
        isActive: true,
      },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать методику', 500);
  }
}

/** PATCH /api/v1/psy/templates - edit or publish a template. */
export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { id, name, schema, publish } = body as {
    id?: unknown;
    name?: unknown;
    schema?: unknown;
    publish?: unknown;
  };
  if (!id || !String(id).trim()) return errorResponse('VALIDATION_ERROR', 'Параметр id обязателен');

  try {
    const user = auth.session.user;
    const role = user.role as Role;
    const tpl = await prisma.psyDiagnosticTemplate.findUnique({
      where: { id: String(id) },
      select: { authorId: true, isBase: true, isPublished: true },
    });
    if (!tpl) return errorResponse('NOT_FOUND', 'Методика не найдена', 404);

    if (publish === true) {
      if (!isSeniorOrSuper(role)) return errorResponse('FORBIDDEN', 'Недостаточно прав', 403);
      const updated = await prisma.psyDiagnosticTemplate.update({
        where: { id: String(id) },
        data: { isPublished: true },
      });
      return successResponse(updated);
    }

    if (tpl.isBase) {
      return errorResponse('VALIDATION_ERROR', 'Базовые методики нередактируемы — скопируйте');
    }

    const canEdit = tpl.authorId === user.id || isSeniorOrSuper(role);
    if (!canEdit) return errorResponse('FORBIDDEN', 'Недостаточно прав', 403);

    const data: Prisma.PsyDiagnosticTemplateUpdateInput = {};
    if (name !== undefined) {
      if (!String(name).trim()) return errorResponse('VALIDATION_ERROR', 'Нужно название методики');
      data.name = String(name).trim();
    }
    if (schema !== undefined) {
      data.schema = schema as Prisma.InputJsonValue;
    }

    const updated = await prisma.psyDiagnosticTemplate.update({
      where: { id: String(id) },
      data,
    });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить методику', 500);
  }
}

/** DELETE /api/v1/psy/templates?id= - delete an allowed template. */
export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return errorResponse('VALIDATION_ERROR', 'Параметр id обязателен');

  try {
    const user = auth.session.user;
    const role = user.role as Role;
    const tpl = await prisma.psyDiagnosticTemplate.findUnique({
      where: { id },
      select: { authorId: true, isBase: true, isPublished: true },
    });
    if (!tpl) return errorResponse('NOT_FOUND', 'Методика не найдена', 404);

    const canDelete = isSeniorOrSuper(role) || (tpl.authorId === user.id && !tpl.isBase && !tpl.isPublished);
    if (!canDelete) return errorResponse('FORBIDDEN', 'Недостаточно прав', 403);

    await prisma.psyDiagnosticTemplate.delete({ where: { id } });
    return successResponse({ id });
  } catch (e) {
    console.error('DELETE psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить', 500);
  }
}
