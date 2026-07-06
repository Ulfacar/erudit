import { type NextRequest } from 'next/server';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';
import { sendWebPush } from '@/shared/lib/agent/webpush';
import { getOverallGpa } from '@/modules/cc/services/gpa';
import { computeConflict } from '@/modules/cc/services/conflict';
import { CC_ROLES } from '@/modules/cc/roles';
import { CC_EXAM_TYPE_LABELS } from '@/modules/cc/labels';

const PROFILE_FIELDS = [
  'studentCountries',
  'studentMajor',
  'studentMotivation',
  'parentCountries',
  'parentBudgetUsd',
  'parentMajor',
  'parentSafety',
  'parentExpectations',
  'riskFlagCleared',
  'counselorComment',
  'strategyAssigned',
] as const;

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

function bestScore(exams: { examType: string; scoreCurrent: number | null; verified: boolean; testDate: Date | null }[], type: string) {
  const filtered = exams.filter((exam) => exam.examType === type && exam.scoreCurrent != null);
  const verified = filtered.filter((exam) => exam.verified).sort((a, b) => Number(b.testDate ?? 0) - Number(a.testDate ?? 0))[0];
  return verified?.scoreCurrent ?? filtered.reduce<number | null>((max, exam) => (max == null || Number(exam.scoreCurrent) > max ? Number(exam.scoreCurrent) : max), null);
}

async function canAccessProfileBranch(user: { id: string; role: string; branchId?: string | null }, profileBranchId: string | null) {
  if (user.role === 'super_admin') return true;
  const scope = await getBranchScope(user.id, user.role as Role, user.branchId);
  return !scope.closed && !!scope.branchId && scope.branchId === profileBranchId;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const profile = await prisma.ccProfile.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            class: true,
            parentLinks: { include: { parent: true } },
          },
        },
        exams: { orderBy: { testDate: 'asc' } },
        applications: { orderBy: { deadlineDate: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        meetings: { orderBy: { meetingDate: 'desc' }, take: 12 },
      },
    });
    if (!profile) return errorResponse('NOT_FOUND', 'CC-профиль не найден', 404);

    if (!(await canAccessProfileBranch(auth.session.user, profile.branchId))) {
      return errorResponse('FORBIDDEN', 'Forbidden', 403);
    }

    const now = Date.now();
    const deadlines = [
      ...profile.applications
        .filter((app) => app.deadlineDate)
        .map((app) => ({
          id: app.id,
          date: app.deadlineDate!.toISOString(),
          title: app.universityName,
          type: 'application',
          status: app.admissionStatus,
          daysLeft: Math.ceil((Number(app.deadlineDate) - now) / 86400000),
        })),
      ...profile.exams
        .filter((exam) => exam.testDate)
        .map((exam) => ({
          id: exam.id,
          date: exam.testDate!.toISOString(),
          title: CC_EXAM_TYPE_LABELS[exam.examType],
          type: 'exam',
          status: exam.verified ? 'verified' : 'planned',
          daysLeft: Math.ceil((Number(exam.testDate) - now) / 86400000),
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return successResponse({
      ...profile,
      student: {
        ...profile.student,
        fio: fio(profile.student),
        className: className(profile.student.class),
        parents: profile.student.parentLinks.map((link) => ({
          id: link.parent.id,
          fio: fio(link.parent),
          phone: link.parent.phone,
          relation: link.relation,
        })),
      },
      gpa: await getOverallGpa(profile.studentId),
      deadlines,
      bestScores: {
        sat: bestScore(profile.exams, 'sat'),
        ielts: bestScore(profile.exams, 'ielts'),
      },
    });
  } catch (error) {
    console.error('GET /api/v1/cc/profiles/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить карточку CC', 500);
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const body = await request.json();

    const existing = await prisma.ccProfile.findUnique({ where: { id } });
    if (!existing) return errorResponse('NOT_FOUND', 'CC-профиль не найден', 404);

    if (!(await canAccessProfileBranch(auth.session.user, existing.branchId))) {
      return errorResponse('FORBIDDEN', 'Forbidden', 403);
    }

    const data: Prisma.CcProfileUpdateInput = {};
    for (const field of PROFILE_FIELDS) {
      if (body[field] !== undefined) {
        (data as Record<string, unknown>)[field] = field === 'parentBudgetUsd' && body[field] !== null && body[field] !== ''
          ? Number(body[field])
          : body[field];
      }
    }

    const next = {
      studentCountries: (data.studentCountries as string[] | undefined) ?? existing.studentCountries,
      studentMajor: (data.studentMajor as string | null | undefined) ?? existing.studentMajor,
      parentCountries: (data.parentCountries as string[] | undefined) ?? existing.parentCountries,
      parentBudgetUsd: (data.parentBudgetUsd as number | null | undefined) ?? existing.parentBudgetUsd,
      parentMajor: (data.parentMajor as string | null | undefined) ?? existing.parentMajor,
    };
    data.conflictStatus = computeConflict(next);
    data.conflictComputedAt = new Date();

    const updated = await prisma.ccProfile.update({
      where: { id },
      data,
      include: { student: { select: { firstName: true, lastName: true, middleName: true } } },
    });
    if (existing.conflictStatus !== 'red' && updated.conflictStatus === 'red' && !updated.riskFlagCleared && updated.counselorId) {
      const student = fio(updated.student);
      await sendWebPush(
        updated.counselorId,
        'Критический конфликт целей',
        `${student}: цель ученика и родителей расходятся`,
        `/cc/${updated.id}`,
      );
    }
    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/cc/profiles/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить CC-профиль', 500);
  }
}
