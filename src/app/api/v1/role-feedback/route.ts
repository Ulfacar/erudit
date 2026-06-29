import { type NextRequest } from 'next/server';
import { type Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { createCrud } from '@/shared/lib/crud';
import { canAccessStudent } from '@/shared/lib/student-access';
import { roleMatches } from '@/shared/lib/role-access';

const WRITE_ROLES: Role[] = [
  'super_admin',
  'analyst',
  'zavuch',
  'curator',
  'teacher',
  'event_manager',
  'safeguarding_lead',
  'psychologist',
  'specialist',
];

const handlers = createCrud({
  model: 'roleFeedback',
  createFields: ['studentId', 'kind', 'audience', 'text'],
  injectUserId: 'authorId',
  writeRoles: WRITE_ROLES,
  orderBy: { createdAt: 'desc' },
  filterableParams: ['studentId', 'kind', 'audience'],
});

const KINDS = new Set(['recommendation', 'report']);
const AUDIENCES = new Set(['child', 'parent', 'staff']);

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const kind = searchParams.get('kind');
  const audience = searchParams.get('audience');
  const role = auth.session.user.role as Role;
  const userId = auth.session.user.id;

  if (studentId) {
    const allowed = await canAccessStudent(role, userId, studentId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к рекомендациям этого ученика', 403);
  } else if (!roleMatches(WRITE_ROLES, role)) {
    return errorResponse('FORBIDDEN', 'Нет доступа к общему списку рекомендаций', 403);
  }

  try {
    const where: {
      studentId?: string;
      kind?: string;
      audience?: string | { in: string[] };
    } = {};
    if (studentId) where.studentId = studentId;
    if (kind) where.kind = kind;
    if (audience) where.audience = audience;

    if ((role === 'student' || role === 'parent') && !audience) {
      where.audience = { in: role === 'student' ? ['child'] : ['parent', 'child'] };
    }

    const rows = await prisma.roleFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(rows);
  } catch (error) {
    console.error('GET roleFeedback error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить рекомендации', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: WRITE_ROLES });
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const kind = typeof body.kind === 'string' ? body.kind : '';
    const audience = typeof body.audience === 'string' ? body.audience : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!studentId || !KINDS.has(kind) || !AUDIENCES.has(audience) || !text) {
      return errorResponse('VALIDATION_ERROR', 'Укажите studentId, kind, audience и текст');
    }

    const allowed = await canAccessStudent(auth.session.user.role, auth.session.user.id, studentId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);

    const created = await prisma.roleFeedback.create({
      data: {
        studentId,
        kind,
        audience,
        text,
        authorId: auth.session.user.id,
        authorRole: auth.session.user.role,
      },
    });
    return successResponse(created, 201);
  } catch (error) {
    console.error('POST roleFeedback error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать рекомендацию', 500);
  }
}

export const { DELETE } = handlers;
