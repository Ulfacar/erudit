import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';
import { getOverallGpa } from '@/modules/cc/services/gpa';
import { computeConflict } from '@/modules/cc/services/conflict';
import { CC_ROLES } from '@/modules/cc/roles';

const CLOSED_STATUSES = ['accepted_final', 'rejected'] as const;

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const where: Prisma.CcProfileWhereInput = {};
    const classFilter = searchParams.get('className')?.trim();
    const country = searchParams.get('country')?.trim();
    const conflictStatus = searchParams.get('conflictStatus')?.trim();
    const strategyAssigned = searchParams.get('strategyAssigned');
    const search = searchParams.get('search')?.trim();

    if (conflictStatus) where.conflictStatus = conflictStatus as Prisma.EnumCcConflictStatusFilter['equals'];
    if (strategyAssigned === 'true' || strategyAssigned === 'false') {
      where.strategyAssigned = strategyAssigned === 'true';
    }
    if (country) {
      where.applications = { some: { country: { equals: country, mode: 'insensitive' } } };
    }
    const studentAnd: Prisma.StudentWhereInput[] = [];

    if (classFilter) {
      const match = classFilter.match(/^(\d+)\s*([A-Za-zА-Яа-я])?$/);
      if (match) {
        studentAnd.push({
          class: {
            grade: Number(match[1]),
            ...(match[2] ? { letter: { equals: match[2], mode: 'insensitive' } } : {}),
          },
        });
      }
    }
    if (search) {
      studentAnd.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { middleName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (studentAnd.length > 0) {
      where.student = { AND: studentAnd };
    }

    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
      Object.assign(where, branchWhere(scope));
    }

    const profiles = await prisma.ccProfile.findMany({
      where,
      include: {
        student: {
          include: { class: true },
        },
        applications: true,
        meetings: { orderBy: { meetingDate: 'desc' }, take: 1 },
        _count: { select: { applications: true } },
      },
    });

    const rows = await Promise.all(
      profiles.map(async (profile) => {
        const openApps = profile.applications.filter((app) => !CLOSED_STATUSES.includes(app.admissionStatus as typeof CLOSED_STATUSES[number]));
        const nearest = openApps
          .filter((app) => app.deadlineDate)
          .sort((a, b) => Number(a.deadlineDate) - Number(b.deadlineDate))[0];
        const lastMeeting = profile.meetings[0];

        return {
          id: profile.id,
          studentId: profile.studentId,
          fio: fio(profile.student),
          className: className(profile.student.class),
          studentMajor: profile.studentMajor,
          studentCountries: profile.studentCountries,
          conflictStatus: profile.conflictStatus,
          riskFlagCleared: profile.riskFlagCleared,
          gpa: await getOverallGpa(profile.studentId),
          nearestDeadline: nearest?.deadlineDate?.toISOString() ?? null,
          lastContact: lastMeeting?.meetingDate.toISOString() ?? null,
          nextStep: lastMeeting?.actionItems || null,
          applicationsCount: profile._count.applications,
          strategyAssigned: profile.strategyAssigned,
        };
      }),
    );

    rows.sort((a, b) => {
      const risk = Number(b.conflictStatus === 'red') - Number(a.conflictStatus === 'red');
      if (risk !== 0) return risk;
      if (a.nearestDeadline && b.nearestDeadline) return a.nearestDeadline.localeCompare(b.nearestDeadline);
      if (a.nearestDeadline) return -1;
      if (b.nearestDeadline) return 1;
      return a.fio.localeCompare(b.fio);
    });

    return successResponse(rows);
  } catch (error) {
    console.error('GET /api/v1/cc/profiles error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить CC-профили', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const studentId = String(body.studentId || '').trim();
    if (!studentId) return errorResponse('VALIDATION_ERROR', 'studentId обязателен');

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, branchId: true } });
    if (!student) return errorResponse('NOT_FOUND', 'Ученик не найден', 404);

    const existing = await prisma.ccProfile.findUnique({ where: { studentId }, select: { id: true } });
    if (existing) return errorResponse('CONFLICT', 'CC-профиль этого ученика уже существует', 409);

    const input = {
      studentCountries: Array.isArray(body.studentCountries) ? body.studentCountries : [],
      studentMajor: body.studentMajor || null,
      parentCountries: Array.isArray(body.parentCountries) ? body.parentCountries : [],
      parentBudgetUsd: body.parentBudgetUsd == null || body.parentBudgetUsd === '' ? null : Number(body.parentBudgetUsd),
      parentMajor: body.parentMajor || null,
    };
    const conflictStatus = computeConflict(input);

    const created = await prisma.ccProfile.create({
      data: {
        studentId,
        counselorId: auth.session.user.id,
        branchId: student.branchId ?? auth.session.user.branchId ?? null,
        ...input,
        conflictStatus,
        conflictComputedAt: new Date(),
      },
    });

    return successResponse(created, 201);
  } catch (error) {
    console.error('POST /api/v1/cc/profiles error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать CC-профиль', 500);
  }
}
