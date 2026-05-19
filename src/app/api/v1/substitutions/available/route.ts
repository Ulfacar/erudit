import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    const slotId = searchParams.get('slotId');

    if (!date || !slotId) {
      return errorResponse('VALIDATION_ERROR', 'Параметры date и slotId обязательны');
    }

    const d = new Date(date);
    const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Get all teachers
    const allTeachers = await prisma.teacher.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        position: true,
        photo: true,
        subjects: {
          include: { subject: true },
        },
      },
    });

    // Get teachers who have schedule entries at this day+slot
    const busyBySchedule = await prisma.scheduleEntry.findMany({
      where: {
        slotId,
        dayOfWeek,
        periodStart: { lte: d },
        periodEnd: { gte: d },
      },
      select: { teacherId: true },
    });

    const busyScheduleIds = new Set(busyBySchedule.map((e) => e.teacherId));

    // Get teachers who already have substitutions at this date+slot
    const busyBySubstitution = await prisma.substitution.findMany({
      where: {
        slotId,
        date: { gte: start, lt: end },
      },
      select: { substituteTeacherId: true },
    });

    const busySubstitutionIds = new Set(busyBySubstitution.map((s) => s.substituteTeacherId));

    // Get teachers who are absent on this date (they are originalTeacher in some substitution)
    const absentTeachers = await prisma.substitution.findMany({
      where: {
        date: { gte: start, lt: end },
      },
      select: { originalTeacherId: true },
    });

    const absentIds = new Set(absentTeachers.map((s) => s.originalTeacherId));

    // Available = not busy by schedule, not busy by substitution, not absent
    const available = allTeachers.filter(
      (t) => !busyScheduleIds.has(t.id) && !busySubstitutionIds.has(t.id) && !absentIds.has(t.id)
    );

    const data = available.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      middleName: t.middleName,
      position: t.position,
      photo: t.photo,
      subjects: [...new Map(t.subjects.map((ts) => [ts.subjectId, ts.subject])).values()],
    }));

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/substitutions/available error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить свободных педагогов', 500);
  }
}
