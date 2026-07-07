import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhereVia, getBranchScope } from '@/shared/lib/branch-scope';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(studentClass?: { grade: number; letter: string } | null) {
  return studentClass ? `${studentClass.grade}${studentClass.letter}` : null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const scope = await getBranchScope(
      auth.session.user.id,
      auth.session.user.role as Role,
      auth.session.user.branchId,
    );
    const scopedByStudent = branchWhereVia(scope, 'student') as Prisma.BehaviorIncidentWhereInput;

    const queueWhere: Prisma.BehaviorIncidentWhereInput = {
      status: 'pending',
      createdAt: { gte: since24h },
      ...scopedByStudent,
    };

    const incidentsWhere: Prisma.BehaviorIncidentWhereInput = {
      createdAt: { gte: since7d },
      ...scopedByStudent,
    };

    const [queueItems, weekIncidents] = await Promise.all([
      prisma.behaviorIncident.findMany({
        where: queueWhere,
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              class: { select: { id: true, grade: true, letter: true } },
            },
          },
        },
      }),
      prisma.behaviorIncident.findMany({
        where: incidentsWhere,
        select: {
          id: true,
          student: {
            select: {
              classId: true,
              class: { select: { id: true, grade: true, letter: true } },
            },
          },
        },
      }),
    ]);

    const disciplineByClass = new Map<string, { classId: string; className: string; incidents: number }>();
    for (const incident of weekIncidents) {
      const classId = incident.student.classId;
      const item = disciplineByClass.get(classId) ?? {
        classId,
        className: className(incident.student.class) ?? 'Без класса',
        incidents: 0,
      };
      item.incidents += 1;
      disciplineByClass.set(classId, item);
    }

    const disciplineTop = [...disciplineByClass.values()]
      .sort((a, b) => b.incidents - a.incidents || a.className.localeCompare(b.className, 'ru'))
      .slice(0, 3);

    const queue = queueItems.map((incident) => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      level: incident.level,
      status: incident.status,
      createdAt: incident.createdAt.toISOString(),
      student: {
        id: incident.student.id,
        fio: fio(incident.student),
        class: className(incident.student.class),
      },
    }));

    return successResponse({ queue, disciplineTop });
  } catch (error) {
    console.error('GET /api/v1/zvr/dashboard error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить дашборд ЗВР', 500);
  }
}
