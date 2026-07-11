import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';
import { roleMatches } from '@/shared/lib/role-access';
import type { Role } from '@prisma/client';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

function isAdmin(role: string) {
  return roleMatches(['super_admin', 'analyst', 'zavuch'], role as Role);
}

/**
 * Тематический план учителя (КТП).
 * GET  — мои планы (для админа — все), со сводкой по темам.
 * POST — создать план {subjectId, classId, periodId?, title}.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const scope = await getTeacherScope(auth.session.user.id);

    const where = isAdmin(role) ? {} : { teacherId: scope?.teacherId ?? '__none__' };
    const plans = await prisma.curriculumPlan.findMany({
      where,
      include: { topics: { select: { id: true, hours: true, done: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    // подтянуть названия предметов/классов
    const subjectIds = Array.from(new Set(plans.map((p) => p.subjectId)));
    const classIds = Array.from(new Set(plans.map((p) => p.classId)));
    const [subjects, classes] = await Promise.all([
      prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, color: true } }),
      prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, grade: true, letter: true } }),
    ]);
    const sById = new Map(subjects.map((s) => [s.id, s]));
    const cById = new Map(classes.map((c) => [c.id, `${c.grade}${c.letter}`]));

    const data = plans.map((p) => ({
      id: p.id,
      title: p.title,
      subjectId: p.subjectId,
      subjectName: sById.get(p.subjectId)?.name ?? '—',
      subjectColor: sById.get(p.subjectId)?.color ?? null,
      classId: p.classId,
      className: cById.get(p.classId) ?? '—',
      periodId: p.periodId,
      topicsCount: p.topics.length,
      topicsDone: p.topics.filter((t) => t.done).length,
      hoursTotal: p.topics.reduce((s, t) => s + t.hours, 0),
      updatedAt: p.updatedAt,
    }));
    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/curriculum-plan/plans error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить планы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const scope = await getTeacherScope(auth.session.user.id);

    const body = await request.json();
    const subjectId = String(body.subjectId ?? '').trim();
    const classId = String(body.classId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const periodId = body.periodId ? String(body.periodId) : null;
    if (!subjectId || !classId || title.length < 2) {
      return errorResponse('VALIDATION_ERROR', 'Нужны предмет, класс и название плана');
    }

    const plan = await prisma.curriculumPlan.create({
      data: { subjectId, classId, periodId, title, teacherId: scope?.teacherId ?? null },
    });
    return successResponse(plan, 201);
  } catch (error) {
    console.error('POST /api/v1/curriculum-plan/plans error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать план', 500);
  }
}
