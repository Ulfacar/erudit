import { type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, type BranchScope } from '@/shared/lib/branch-scope';
import { computeKpi } from '@/modules/olympiad/kpi';
import { getKpiConfig } from '@/modules/olympiad/kpi-config';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;

type RouteParams = { params: Promise<{ id: string }> };
type MetricRow = { studentId: string; tasksTotal: number; tasksSolved: number };

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function canAccessBranch(branchId: string | null, scope: BranchScope) {
  if (scope.closed) return false;
  if (scope.branchId) return branchId === scope.branchId;
  return scope.canSeeAll;
}

async function findAccessibleIntensive(id: string, scope: BranchScope) {
  const intensive = await prisma.intensive.findUnique({
    where: { id },
    select: { id: true, branchId: true, olympiadId: true, olympiad: { select: { awardScheme: { select: { values: true } } } } },
  });
  if (!intensive || !canAccessBranch(intensive.branchId, scope)) return null;
  return intensive;
}

async function participantsWithStudents(intensiveId: string) {
  const participants = await prisma.intensiveParticipant.findMany({
    where: { intensiveId },
    orderBy: { addedAt: 'asc' },
  });
  const students = await prisma.student.findMany({
    where: { id: { in: participants.map((participant) => participant.studentId) } },
    include: { class: true },
  });
  const studentById = new Map(students.map((student) => [student.id, student]));

  return participants.map((participant) => {
    const student = studentById.get(participant.studentId);
    return {
      studentId: participant.studentId,
      fio: student ? fio(student) : participant.studentId,
      className: student ? className(student.class) : '',
    };
  });
}

function attendanceMap(rows: { studentId: string; _count: { studentId: number } }[]) {
  return Object.fromEntries(rows.map((row) => [row.studentId, row._count.studentId]));
}

async function metricsPayload(intensiveId: string, branchId: string | null) {
  const [participants, metrics, totalDays, attendanceRows, config] = await Promise.all([
    participantsWithStudents(intensiveId),
    prisma.studentMetrics.findMany({ where: { intensiveId }, orderBy: { updatedAt: 'desc' } }),
    prisma.intensiveDay.count({ where: { intensiveId } }),
    prisma.intensiveAttendance.groupBy({
      by: ['studentId'],
      where: { intensiveId, status: 'present' },
      _count: { studentId: true },
    }),
    getKpiConfig(branchId),
  ]);

  return { participants, metrics, config, totalDays, attendanceByStudent: attendanceMap(attendanceRows) };
}

function parseRows(value: unknown): MetricRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const source = item as Record<string, unknown>;
    const studentId = String(source.studentId || '').trim();
    const tasksTotal = Number(source.tasksTotal);
    const tasksSolved = Number(source.tasksSolved);
    if (!studentId || !Number.isInteger(tasksTotal) || !Number.isInteger(tasksSolved)) return null;
    if (tasksTotal < 0 || tasksSolved < 0 || tasksSolved > tasksTotal) return null;
    return { studentId, tasksTotal, tasksSolved };
  });
  return rows.some((row) => !row) ? null : (rows as MetricRow[]);
}

function awardPoints(values: Prisma.JsonValue | undefined, awardValue: string | null | undefined) {
  if (!Array.isArray(values) || !awardValue) return null;
  const match = values.find((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    return String((item as Record<string, Prisma.JsonValue>).value) === awardValue;
  });
  if (!match || typeof match !== 'object' || Array.isArray(match)) return null;
  const weight = Number((match as Record<string, Prisma.JsonValue>).weight);
  return Number.isFinite(weight) ? Math.min(100, Math.max(0, weight)) : null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Not found', 404);

    return successResponse(await metricsPayload(id, scope.branchId));
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/intensives/[id]/metrics error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to load metrics', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const rows = parseRows(body.rows);
    if (!rows) return errorResponse('VALIDATION_ERROR', 'Invalid metric rows');

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Not found', 404);

    const [participants, totalDays, attendanceRows, config, participations] = await Promise.all([
      prisma.intensiveParticipant.findMany({ where: { intensiveId: id }, select: { studentId: true } }),
      prisma.intensiveDay.count({ where: { intensiveId: id } }),
      prisma.intensiveAttendance.groupBy({
        by: ['studentId'],
        where: { intensiveId: id, status: 'present' },
        _count: { studentId: true },
      }),
      getKpiConfig(scope.branchId),
      intensive.olympiadId
        ? prisma.olympiadParticipation.findMany({
            where: { olympiadId: intensive.olympiadId, status: 'participated', studentId: { in: rows.map((row) => row.studentId) } },
            select: { studentId: true, awardValue: true },
          })
        : Promise.resolve([]),
    ]);

    const allowedStudents = new Set(participants.map((participant) => participant.studentId));
    if (rows.some((row) => !allowedStudents.has(row.studentId))) {
      return errorResponse('VALIDATION_ERROR', 'Student is not an intensive participant');
    }

    const attendedByStudent = new Map(attendanceRows.map((row) => [row.studentId, row._count.studentId]));
    const awardByStudent = new Map(participations.map((participation) => [participation.studentId, participation.awardValue]));
    const schemeValues = intensive.olympiad?.awardScheme?.values;

    await prisma.$transaction(
      rows.map((row) => {
        const attendedDays = attendedByStudent.get(row.studentId) ?? 0;
        const points = awardPoints(schemeValues, awardByStudent.get(row.studentId));
        const kpi = computeKpi({ ...row, attendedDays, totalDays, awardPoints: points }, config);
        return prisma.studentMetrics.upsert({
          where: { intensiveId_studentId: { intensiveId: id, studentId: row.studentId } },
          create: { intensiveId: id, studentId: row.studentId, tasksTotal: row.tasksTotal, tasksSolved: row.tasksSolved, attendedDays, totalDays, kpi, kpiConfigVersion: config.version },
          update: { tasksTotal: row.tasksTotal, tasksSolved: row.tasksSolved, attendedDays, totalDays, kpi, kpiConfigVersion: config.version },
        });
      }),
    );

    return successResponse(await metricsPayload(id, scope.branchId));
  } catch (error) {
    console.error('POST /api/v1/olympiad-center/intensives/[id]/metrics error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to save metrics', 500);
  }
}
