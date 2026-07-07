import { type NextRequest } from 'next/server';
import { createCrud } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';
import { prisma } from '@/shared/lib/prisma';
import { withAuth } from '@/shared/lib/api-auth';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';
import { emitEvent } from '@/shared/lib/agent/engine';
import { validateDeadline } from '@/modules/cc/deadline';
import type { Prisma, Role } from '@prisma/client';

const crud = createCrud({
  model: 'ccDocument',
  listRoles: [...CC_ROLES],
  writeRoles: [...CC_ROLES],
  createFields: ['docType', 'status', 'fileUrl', 'teacherId', 'requestedDeadline', 'requiredCount', 'comment', 'profileId'],
  dateFields: ['requestedDeadline'],
  intFields: ['requiredCount'],
  filterableParams: ['profileId', 'docType', 'status'],
  branchScope: 'profile',
  orderBy: { createdAt: 'desc' },
});

export const GET = crud.GET;
export const DELETE = crud.DELETE;

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => ({}));
    const profileId = String(body.profileId || '').trim();
    if (body.requestedDeadline) {
      const deadlineError = validateDeadline(String(body.requestedDeadline));
      if (deadlineError) return errorResponse('VALIDATION_ERROR', deadlineError);
    }
    if (!profileId || !body.docType) return errorResponse('VALIDATION_ERROR', 'profileId и docType обязательны');

    const where: Prisma.CcProfileWhereInput = { id: profileId };
    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
      Object.assign(where, branchWhere(scope));
    }
    const profile = await prisma.ccProfile.findFirst({
      where,
      include: { student: { select: { firstName: true, lastName: true, middleName: true } } },
    });
    if (!profile) return errorResponse('NOT_FOUND', 'CC-профиль не найден', 404);

    const created = await prisma.ccDocument.create({
      data: {
        profileId,
        docType: body.docType,
        status: body.status ?? 'not_started',
        fileUrl: body.fileUrl || null,
        teacherId: body.teacherId || null,
        requestedDeadline: body.requestedDeadline ? new Date(String(body.requestedDeadline)) : null,
        requiredCount: body.requiredCount !== undefined && body.requiredCount !== null && body.requiredCount !== '' ? parseInt(String(body.requiredCount), 10) : null,
        comment: body.comment || null,
      },
    });

    if (created.docType === 'recommendation' && created.teacherId && created.requestedDeadline) {
      const teacher = await prisma.teacher.findUnique({ where: { id: created.teacherId }, select: { userId: true } });
      if (teacher?.userId) {
        const studentName = [profile.student.lastName, profile.student.firstName, profile.student.middleName].filter(Boolean).join(' ');
        await emitEvent('cc.recommendation.requested', {
          actorUserId: auth.session.user.id,
          studentId: profile.studentId,
          payload: {
            documentId: created.id,
            teacherUserId: teacher.userId,
            requestedDeadline: created.requestedDeadline.toISOString(),
            studentName,
          },
        });
      }
    }

    return successResponse(created, 201);
  } catch (error) {
    console.error('POST /api/v1/cc/documents error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать CC-документ', 500);
  }
}
