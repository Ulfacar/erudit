import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { PSY_CABINET_ROLES, getPsyScope, canSeeFio } from '@/shared/lib/psy-scope';

/**
 * GET /api/v1/psy/student-card/[id] — анкета ученика для кабинета психолога.
 * Собирает: профиль + персональный номер, родители, siblings в школе,
 * даты сопровождения (по PsyCase), список кейсов, документы, встречи с родителем.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true, middleName: true, photo: true,
        psyCode: true, dateOfBirth: true, enrolledAt: true,
        class: { select: { grade: true, letter: true } },
        parentLinks: {
          select: {
            relation: true,
            parent: {
              select: {
                id: true, firstName: true, lastName: true, phone: true,
                children: {
                  select: {
                    student: {
                      select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!student) return errorResponse('NOT_FOUND', 'Ученик не найден', 404);

    // siblings: дети тех же родителей, кроме самого ученика (без дублей)
    const siblingMap = new Map<string, { id: string; name: string; className: string }>();
    for (const pl of student.parentLinks) {
      for (const ch of pl.parent.children) {
        const s = ch.student;
        if (s.id === student.id || siblingMap.has(s.id)) continue;
        siblingMap.set(s.id, {
          id: s.id,
          name: `${s.lastName} ${s.firstName}`,
          className: s.class ? `${s.class.grade}${s.class.letter}` : '—',
        });
      }
    }

    // кейсы ученика → даты сопровождения + встречи с родителем
    const cases = await prisma.psyCase.findMany({
      where: { studentId: id },
      orderBy: { openedAt: 'desc' },
      select: { id: true, title: true, riskLevel: true, status: true, openedAt: true, closedAt: true, ownerId: true },
    });
    const role = auth.session.user.role;
    const scope = getPsyScope(auth.session.user.id, role);
    const ownsAny = scope.full || cases.some((c) => c.ownerId === auth.session.user.id);
    if (!scope.full && !ownsAny) {
      return errorResponse('FORBIDDEN', 'Нет доступа к карточке этого ученика', 403);
    }
    const showFio = scope.role === 'psy_coordinator' || scope.role === 'super_admin' ? true
                  : scope.role === 'senior_psychologist' ? false
                  : cases.some((c) => canSeeFio(scope, c.ownerId));
    const supportStart = cases.length ? cases.reduce((m, c) => (c.openedAt < m ? c.openedAt : m), cases[0].openedAt) : null;
    const allClosed = cases.length > 0 && cases.every((c) => c.status === 'closed' && c.closedAt);
    const supportEnd = allClosed
      ? cases.reduce<Date | null>((m, c) => (c.closedAt && (!m || c.closedAt > m) ? c.closedAt : m), null)
      : null;

    const caseIds = cases.map((c) => c.id);
    const parentMeetings = caseIds.length
      ? await prisma.psySession.findMany({
          where: { caseId: { in: caseIds }, type: { in: ['parent_meeting'] } },
          orderBy: { date: 'desc' },
          select: { id: true, date: true, type: true, qualNote: true },
        })
      : [];

    const documents = await prisma.documentRecord.findMany({
      where: { ownerType: 'student', ownerId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, title: true, fileName: true, fileUrl: true, createdAt: true },
    });

    const responseCases = cases.map(({ ownerId, ...c }) => c);

    return successResponse({
      profile: {
        id: student.id,
        name: showFio ? `${student.lastName} ${student.firstName}${student.middleName ? ' ' + student.middleName : ''}` : student.psyCode ?? 'код скрыт',
        className: student.class ? `${student.class.grade}${student.class.letter}` : '—',
        photo: showFio ? student.photo : null,
        psyCode: student.psyCode,
        dateOfBirth: showFio ? student.dateOfBirth : null,
        enrolledAt: student.enrolledAt,
        supportStart,
        supportEnd,
      },
      parents: showFio ? student.parentLinks.map((pl) => ({
        id: pl.parent.id,
        name: `${pl.parent.lastName} ${pl.parent.firstName}`,
        phone: pl.parent.phone,
        relation: pl.relation,
      })) : [],
      siblings: showFio ? [...siblingMap.values()] : [],
      cases: responseCases,
      parentMeetings,
      documents: showFio ? documents : [],
    });
  } catch (e) {
    console.error('GET psy/student-card/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить анкету', 500);
  }
}
