import { type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';
import { awardLabelFromScheme } from '@/modules/olympiad/portfolio';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;

type RouteParams = { params: Promise<{ id: string }> };

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateRange(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const allowed = await canAccessStudent(auth.session.user.role, auth.session.user.id, id, auth.session.user.branchId);
    if (!allowed) return errorResponse('NOT_FOUND', 'Not found', 404);

    const from = parseDate(request.nextUrl.searchParams.get('from'));
    const to = parseDate(request.nextUrl.searchParams.get('to'), true);
    const range = dateRange(from, to);

    const [student, metrics, awards, enrollments] = await Promise.all([
      prisma.student.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          class: { select: { grade: true, letter: true } },
        },
      }),
      prisma.studentMetrics.findMany({
        where: { studentId: id, ...(range ? { updatedAt: range } : {}) },
        include: { intensive: { select: { id: true, name: true, startDate: true, olympiadId: true } } },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.achievement.findMany({
        where: { studentId: id, olympiadId: { not: null }, ...(range ? { date: range } : {}) },
        select: { title: true, place: true, level: true, date: true, olympiadId: true },
        orderBy: { date: 'desc' },
      }),
      prisma.olympiadParticipation.findMany({
        where: {
          studentId: id,
          ...(range ? { OR: [{ enrolledAt: range }, { createdAt: range }] } : {}),
        },
        include: {
          olympiad: {
            select: {
              id: true,
              name: true,
              awardScheme: { select: { values: true } },
            },
          },
        },
        orderBy: [{ enrolledAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    if (!student) return errorResponse('NOT_FOUND', 'Not found', 404);

    const latestMetric = [...metrics].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    return successResponse({
      student: { id: student.id, fio: fio(student), className: className(student.class) },
      currentKpi: latestMetric?.kpi ?? null,
      kpiSeries: metrics
        .filter((metric) => metric.kpi != null)
        .map((metric) => ({
          label: metric.intensive.name,
          date: iso(metric.intensive.startDate),
          kpi: metric.kpi,
        })),
      intensives: metrics.map((metric) => ({
        intensiveId: metric.intensiveId,
        olympiadId: metric.intensive.olympiadId,
        name: metric.intensive.name,
        kpi: metric.kpi,
        attendedDays: metric.attendedDays ?? 0,
        totalDays: metric.totalDays ?? 0,
        tasksSolved: metric.tasksSolved ?? 0,
        tasksTotal: metric.tasksTotal ?? 0,
        date: iso(metric.intensive.startDate),
      })),
      awards: awards.map((award) => ({
        title: award.title,
        place: award.place,
        level: award.level,
        date: iso(award.date),
        olympiadId: award.olympiadId,
      })),
      enrollments: enrollments.map((row) => ({
        olympiadId: row.olympiadId,
        olympiadName: row.olympiad.name,
        tour: row.tour,
        status: row.status,
        awardValue: row.awardValue,
        awardLabel: awardLabelFromScheme(row.olympiad.awardScheme?.values, row.awardValue) ?? row.awardValue,
        date: iso(row.enrolledAt ?? row.createdAt),
      })),
    });
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/students/[id]/summary error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to load student summary', 500);
  }
}
