import { type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhereVia, getBranchScope } from '@/shared/lib/branch-scope';

function localMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function teacherName(teacher: { firstName: string; lastName: string; middleName: string | null }) {
  return [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ');
}

/**
 * GET /api/v1/reports/journal-fill
 *
 * Reports missing journal topics by expanding schedule entries over dates.
 * TODO: Substitution v1 keeps lessons under the original teacher; v2 should move them to the substitute teacher.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch'] });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const fromParam = parseLocalDate(searchParams.get('from'));
    const toParam = parseLocalDate(searchParams.get('to'));
    const periodId = searchParams.get('periodId');
    const today = localMidnight(new Date());

    let from = fromParam;
    let to = toParam;
    let periodName: string | undefined;

    if (!from || !to) {
      const period = periodId
        ? await prisma.academicPeriod.findUnique({
            where: { id: periodId },
            select: { name: true, startDate: true, endDate: true },
          })
        : await prisma.academicPeriod.findFirst({
            where: { type: 'trimester', isActive: true },
            select: { name: true, startDate: true, endDate: true },
            orderBy: { startDate: 'desc' },
          });

      if (period) {
        from = fromParam ?? localMidnight(period.startDate);
        to = toParam ?? localMidnight(period.endDate);
        periodName = period.name;
      } else {
        to = toParam ?? today;
        from = fromParam ?? addDays(to, -29);
      }
    }

    to = localMidnight(to > today ? today : to);
    from = localMidnight(from);

    if (from > to) {
      return successResponse({ from: dateKey(from), to: dateKey(to), periodName, rows: [] });
    }

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role);
    const classBranchWhere = branchWhereVia(scope, 'class');
    const nextTo = addDays(to, 1);

    const [holidays, entries, topics, grades] = await Promise.all([
      prisma.academicPeriod.findMany({
        where: {
          type: { in: ['holiday', 'quarantine'] },
          startDate: { lte: to },
          endDate: { gte: from },
        },
        select: { startDate: true, endDate: true },
      }),
      prisma.scheduleEntry.findMany({
        where: {
          periodStart: { lte: to },
          periodEnd: { gte: from },
          ...classBranchWhere,
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          class: { select: { id: true, grade: true, letter: true } },
          subject: { select: { id: true, name: true } },
        },
      }),
      prisma.lessonTopic.findMany({
        where: { date: { gte: from, lte: to } },
        select: { classId: true, subjectId: true, date: true },
      }),
      prisma.grade.findMany({
        where: {
          date: { gte: from, lt: nextTo },
          ...(scope.branchId ? { student: { class: { branchId: scope.branchId } } } : {}),
        },
        select: {
          teacherId: true,
          subjectId: true,
          date: true,
          student: { select: { classId: true } },
        },
      }),
    ]);

    const holidayRanges = holidays.map((h) => ({
      start: localMidnight(h.startDate),
      end: localMidnight(h.endDate),
    }));
    const isHoliday = (date: Date) => holidayRanges.some((h) => h.start <= date && h.end >= date);

    const groups = new Map<
      string,
      {
        teacherId: string;
        teacherName: string;
        classId: string;
        className: string;
        subjectId: string;
        subjectName: string;
        lessonDates: Set<string>;
      }
    >();

    for (let day = from; day <= to; day = addDays(day, 1)) {
      if (isHoliday(day)) continue;
      const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
      const keyDate = dateKey(day);

      for (const entry of entries) {
        if (entry.dayOfWeek !== dayOfWeek) continue;
        if (localMidnight(entry.periodStart) > day || localMidnight(entry.periodEnd) < day) continue;

        const key = `${entry.teacherId}|${entry.classId}|${entry.subjectId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            teacherId: entry.teacherId,
            teacherName: teacherName(entry.teacher),
            classId: entry.classId,
            className: `${entry.class.grade}${entry.class.letter}`,
            subjectId: entry.subjectId,
            subjectName: entry.subject.name,
            lessonDates: new Set(),
          });
        }
        groups.get(key)!.lessonDates.add(keyDate);
      }
    }

    const topicSet = new Set(topics.map((topic) => `${topic.classId}|${topic.subjectId}|${dateKey(topic.date)}`));
    const gradeDates = new Map<string, Set<string>>();
    const gradesTotal = new Map<string, number>();

    for (const grade of grades) {
      const key = `${grade.teacherId}|${grade.student.classId}|${grade.subjectId}`;
      const keyDate = dateKey(grade.date);
      if (!gradeDates.has(key)) gradeDates.set(key, new Set());
      gradeDates.get(key)!.add(keyDate);
      gradesTotal.set(key, (gradesTotal.get(key) ?? 0) + 1);
    }

    const rows = Array.from(groups.entries())
      .map(([key, group]) => {
        const expected = group.lessonDates.size;
        let topicsFilled = 0;
        let gradedDays = 0;

        for (const lessonDate of group.lessonDates) {
          if (topicSet.has(`${group.classId}|${group.subjectId}|${lessonDate}`)) topicsFilled++;
          if (gradeDates.get(key)?.has(lessonDate)) gradedDays++;
        }

        const fillPct = expected ? Math.round((topicsFilled / expected) * 100) : 100;

        return {
          teacherId: group.teacherId,
          teacherName: group.teacherName,
          classId: group.classId,
          className: group.className,
          subjectId: group.subjectId,
          subjectName: group.subjectName,
          expected,
          topicsFilled,
          gradedDays,
          gradesCount: gradesTotal.get(key) ?? 0,
          fillPct,
          gaps: expected - topicsFilled,
        };
      })
      .sort((a, b) => a.fillPct - b.fillPct || a.teacherName.localeCompare(b.teacherName, 'ru'));

    return successResponse({ from: dateKey(from), to: dateKey(to), periodName, rows });
  } catch (error) {
    console.error('GET /api/v1/reports/journal-fill error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить отчёт по журналу', 500);
  }
}
