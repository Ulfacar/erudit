import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { roleMatches } from '@/shared/lib/role-access';

/**
 * GET /api/v1/grading/moderation
 * List grades pending moderation (default: submitted+moderated).
 * Filterable by classId, subjectId, status.
 * Accessible to zavuch, analyst, super_admin.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['zavuch', 'analyst', 'super_admin'] });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const statusParam = searchParams.get('status');
    // Default: показываем оба активных состояния модерации
    const status = statusParam
      ? statusParam
      : { in: ['submitted', 'moderated'] };

    const where: Record<string, unknown> = {
      status,
    };

    if (subjectId) where.subjectId = subjectId;
    if (classId) where.student = { classId };

    const grades = await prisma.grade.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            classId: true,
            class: {
              select: { id: true, grade: true, letter: true },
            },
          },
        },
        subject: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true, weight: true },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        period: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return successResponse(grades);
  } catch (error) {
    console.error('GET /api/v1/grading/moderation error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить оценки для модерации', 500);
  }
}

/**
 * PUT /api/v1/grading/moderation
 *
 * Двухуровневая цепочка модерации по ТЗ:
 *   submitted  --(zavuch)-------> moderated   (первичная модерация, ТЗ: «Завуч могут изменить оценки по необходимости»)
 *   moderated  --(analyst)------> published   (ТЗ: «Аналитик одобряет итоги модерации»)
 *
 * ТЗ в одном месте говорит «после одобрения суперадмином», в другом — «Аналитик одобряет».
 * Принимаем эти два понятия как синонимы финального утверждения: и `analyst`, и `super_admin`
 * могут переводить moderated → published.
 *
 * Reject (любая роль из allowed): любой статус → draft.
 *
 * Body: { gradeIds: string[], action: 'approve' | 'reject', comment?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['zavuch', 'analyst', 'super_admin'] });
    if (auth.response) return auth.response;
    const userRole = auth.session.user.role;

    const body = await request.json();
    const { gradeIds, action, comment } = body as {
      gradeIds?: string[];
      action?: 'approve' | 'reject';
      comment?: string;
    };

    if (!gradeIds || !Array.isArray(gradeIds) || gradeIds.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'Необходимо указать gradeIds');
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('VALIDATION_ERROR', 'Действие должно быть approve или reject');
    }

    const grades = await prisma.grade.findMany({
      where: { id: { in: gradeIds } },
    });

    if (grades.length !== gradeIds.length) {
      return errorResponse('NOT_FOUND', 'Некоторые оценки не найдены', 404);
    }

    const results: Array<{ gradeId: string; newStatus?: string; error?: string }> = [];

    for (const grade of grades) {
      let newStatus: 'draft' | 'submitted' | 'moderated' | 'published' | null = null;
      let denyReason: string | null = null;

      if (action === 'reject') {
        newStatus = 'draft';
      } else {
        // approve — роль определяет какой переход разрешён
        if (grade.status === 'submitted') {
          if (roleMatches(['zavuch', 'super_admin'], userRole)) {
            newStatus = 'moderated';
          } else {
            denyReason = 'Первичная модерация — только завуч или суперадмин';
          }
        } else if (grade.status === 'moderated') {
          if (userRole === 'analyst' || userRole === 'super_admin') {
            newStatus = 'published';
          } else {
            denyReason = 'Финальное утверждение — только аналитик или суперадмин';
          }
        } else {
          denyReason = `Невозможно одобрить оценку со статусом "${grade.status}"`;
        }
      }

      if (denyReason || newStatus === null) {
        results.push({
          gradeId: grade.id,
          error: denyReason ?? 'Не определён переход статуса',
        });
        continue;
      }

      const updated = await prisma.grade.update({
        where: { id: grade.id },
        data: { status: newStatus },
      });

      await prisma.gradeAuditLog.create({
        data: {
          gradeId: grade.id,
          userId: auth.session.user.id,
          oldValue: grade.value,
          newValue: grade.value,
          action: action === 'reject'
            ? `rejected${comment ? `: ${comment}` : ''}`
            : `status_changed: ${grade.status} -> ${newStatus} (by ${userRole})`,
        },
      });

      results.push({ gradeId: grade.id, newStatus: updated.status });
    }

    return successResponse(results);
  } catch (error) {
    console.error('PUT /api/v1/grading/moderation error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить статус модерации', 500);
  }
}
