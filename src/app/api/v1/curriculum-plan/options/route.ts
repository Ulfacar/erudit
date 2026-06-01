import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

/**
 * Опции для редактора КТП: пары «предмет × класс», которые ведёт учитель
 * (для админа/завуча — все назначения), и список учебных периодов.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const scope = await getTeacherScope(auth.session.user.id);
    const isAdmin = role === 'super_admin' || role === 'analyst' || role === 'zavuch';

    const ts = await prisma.teacherSubject.findMany({
      where: isAdmin ? {} : scope ? { teacherId: scope.teacherId } : { teacherId: '__none__' },
      include: { subject: { select: { id: true, name: true, color: true } } },
    });

    const classIds = Array.from(new Set(ts.map((t) => t.classId)));
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, grade: true, letter: true },
    });
    const classNameById = new Map(classes.map((c) => [c.id, `${c.grade}${c.letter}`]));

    const seen = new Set<string>();
    const pairs = ts
      .map((t) => ({
        subjectId: t.subjectId,
        subjectName: t.subject.name,
        subjectColor: t.subject.color,
        classId: t.classId,
        className: classNameById.get(t.classId) ?? '—',
      }))
      .filter((p) => {
        const k = `${p.subjectId}:${p.classId}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName));

    const periods = await prisma.academicPeriod.findMany({
      where: { type: 'trimester' },
      select: { id: true, name: true, isActive: true },
      orderBy: { startDate: 'asc' },
    });

    return successResponse({ pairs, periods, teacherId: scope?.teacherId ?? null });
  } catch (error) {
    console.error('GET /api/v1/curriculum-plan/options error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить опции КТП', 500);
  }
}
