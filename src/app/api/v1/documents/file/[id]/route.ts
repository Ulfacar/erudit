import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { presignedGet } from '@/shared/lib/storage/minio';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

const STAFF_ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary', 'hr', 'psychologist', 'senior_psychologist', 'specialist'] as const;
const SELF_ROLES = ['teacher', 'curator'] as const;

/** GET /api/v1/documents/file/[id] — редирект на presigned-ссылку файла документа. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...STAFF_ROLES, ...SELF_ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const doc = await prisma.documentRecord.findUnique({ where: { id }, select: { fileUrl: true, ownerType: true, ownerId: true } });
    if (!doc?.fileUrl) return errorResponse('NOT_FOUND', 'Файл не найден', 404);

    // Учитель/куратор видят только свои документы (анкета), staff-роли — все.
    const role = auth.session.user.role;
    if (role === 'teacher' || role === 'curator') {
      const scope = await getTeacherScope(auth.session.user.id);
      const ownsDoc = doc.ownerType === 'teacher' && !!scope && doc.ownerId === scope.teacherId;
      if (!ownsDoc) return errorResponse('FORBIDDEN', 'Доступ запрещён', 403);
    }

    const url = await presignedGet(doc.fileUrl, 600);
    return NextResponse.redirect(url);
  } catch (e) {
    console.error('GET documents/file/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить файл', 500);
  }
}
