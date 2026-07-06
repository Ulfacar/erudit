import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { withAuth } from '@/shared/lib/api-auth';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';
import { getOverallGpa } from '@/modules/cc/services/gpa';

const REPORT_ROLES = ['founder', 'super_admin', 'college_counselor'] as const;

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : 'Без класса';
}

function scholarshipValue(value?: string | null) {
  if (!value) return 0;
  const n = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...REPORT_ROLES] });
    if (auth.response) return auth.response;

    const where: Prisma.CcProfileWhereInput = {};
    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
      Object.assign(where, branchWhere(scope));
    }

    const profiles = await prisma.ccProfile.findMany({
      where,
      include: {
        student: { include: { class: true } },
        applications: true,
        exams: true,
        meetings: { orderBy: { meetingDate: 'desc' }, take: 1 },
      },
    });

    const stageCounts: Record<string, number> = {};
    for (const profile of profiles) {
      const stages = new Set(profile.applications.map((app) => app.admissionStatus));
      for (const stage of stages) stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }

    const upcomingDeadlines = profiles
      .flatMap((profile) =>
        profile.applications
          .filter((app) => app.deadlineDate && !['accepted_final', 'rejected'].includes(app.admissionStatus))
          .map((app) => ({
            applicationId: app.id,
            profileId: profile.id,
            student: fio(profile.student),
            className: className(profile.student.class),
            universityName: app.universityName,
            country: app.country,
            deadlineDate: app.deadlineDate!.toISOString(),
            daysLeft: Math.ceil((app.deadlineDate!.getTime() - Date.now()) / 86400000),
          })),
      )
      .sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate))
      .slice(0, 10);

    const riskStudents = [];
    for (const profile of profiles) {
      const gpa = await getOverallGpa(profile.studentId);
      const overdue = profile.applications.some((app) => app.deadlineDate && app.deadlineDate.getTime() < Date.now() && !['accepted_final', 'rejected'].includes(app.admissionStatus));
      const risks = [
        gpa != null && gpa < 3 ? 'Низкий GPA' : null,
        profile.studentCountries.length === 0 ? 'Нет цели' : null,
        profile.meetings.length === 0 ? 'Нет контакта' : null,
        overdue ? 'Просроченный дедлайн' : null,
        profile.exams.length === 0 ? 'Нет экзаменов' : null,
      ].filter(Boolean) as string[];
      if (risks.length > 0) {
        riskStudents.push({
          profileId: profile.id,
          student: fio(profile.student),
          className: className(profile.student.class),
          gpa,
          risks,
        });
      }
    }

    const classes: Record<string, { className: string; total: number; withCountry: number; withMajor: number; withExams: number; withApplications: number }> = {};
    for (const profile of profiles) {
      const key = className(profile.student.class);
      classes[key] ??= { className: key, total: 0, withCountry: 0, withMajor: 0, withExams: 0, withApplications: 0 };
      classes[key].total += 1;
      if (profile.studentCountries.length > 0) classes[key].withCountry += 1;
      if (profile.studentMajor) classes[key].withMajor += 1;
      if (profile.exams.length > 0) classes[key].withExams += 1;
      if (profile.applications.length > 0) classes[key].withApplications += 1;
    }

    const acceptedProfiles = new Set(
      profiles.filter((profile) => profile.applications.some((app) => app.admissionStatus === 'accepted_final')).map((profile) => profile.id),
    );
    const scholarshipTotal = profiles.reduce(
      (sum, profile) => sum + profile.applications.reduce((inner, app) => inner + scholarshipValue(app.scholarshipAmount), 0),
      0,
    );

    return successResponse({
      totals: {
        profiles: profiles.length,
        acceptedPercent: profiles.length ? Math.round((acceptedProfiles.size / profiles.length) * 100) : 0,
        scholarshipTotal,
      },
      stageCounts,
      upcomingDeadlines,
      riskStudents: riskStudents.slice(0, 12),
      classReport: Object.values(classes).sort((a, b) => a.className.localeCompare(b.className)),
    });
  } catch (error) {
    console.error('GET /api/v1/cc/reports error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить CC-отчёт', 500);
  }
}
