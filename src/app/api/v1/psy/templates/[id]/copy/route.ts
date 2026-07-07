import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/** POST /api/v1/psy/templates/[id]/copy - create an editable copy owned by the current user. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const user = auth.session.user;
    const src = await prisma.psyDiagnosticTemplate.findUnique({ where: { id } });
    if (!src) return errorResponse('NOT_FOUND', 'Методика не найдена', 404);

    const isVisible = src.isBase || src.isPublished || src.authorId === user.id;
    if (!isVisible) return errorResponse('FORBIDDEN', 'Недостаточно прав', 403);

    const copy = await prisma.psyDiagnosticTemplate.create({
      data: {
        name: `${src.name} (копия)`,
        version: 1,
        authorId: user.id,
        schema: src.schema as Prisma.InputJsonValue,
        scaleConfig: src.scaleConfig == null ? undefined : (src.scaleConfig as Prisma.InputJsonValue),
        gradeBand: src.gradeBand ?? null,
        direction: src.direction ?? null,
        isBase: false,
        isPublished: false,
        isActive: true,
      },
    });

    return successResponse(copy, 201);
  } catch (e) {
    console.error('POST psy/templates/copy error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось скопировать методику', 500);
  }
}
