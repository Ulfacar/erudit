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

    if (!date) {
      return errorResponse('VALIDATION_ERROR', 'Параметр date обязателен');
    }

    const d = new Date(date);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Teachers who have substitutions where they are the original (absent) teacher
    const substitutions = await prisma.substitution.findMany({
      where: {
        date: { gte: start, lt: end },
      },
      select: {
        originalTeacherId: true,
        reason: true,
      },
    });

    // Get unique absent teacher IDs with their reasons
    const absentMap = new Map<string, string | null>();
    for (const sub of substitutions) {
      if (!absentMap.has(sub.originalTeacherId)) {
        absentMap.set(sub.originalTeacherId, sub.reason);
      }
    }

    const teacherIds = Array.from(absentMap.keys());

    const teachers = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        position: true,
        photo: true,
      },
    });

    const data = teachers.map((t) => ({
      ...t,
      reason: absentMap.get(t.id) || null,
    }));

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/substitutions/absent error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить отсутствующих педагогов', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, date, reason } = body;

    if (!teacherId || !date) {
      return errorResponse('VALIDATION_ERROR', 'Поля teacherId и date обязательны');
    }

    const d = new Date(date);
    const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon ... 7=Sun
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Find all schedule entries for this teacher on this day of week
    const scheduleEntries = await prisma.scheduleEntry.findMany({
      where: {
        teacherId,
        dayOfWeek,
        periodStart: { lte: d },
        periodEnd: { gte: d },
      },
      include: {
        class: true,
        subject: true,
        slot: true,
      },
    });

    // Check which slots already have substitutions
    const existingSubstitutions = await prisma.substitution.findMany({
      where: {
        originalTeacherId: teacherId,
        date: { gte: start, lt: end },
      },
      select: { slotId: true },
    });

    const existingSlotIds = new Set(existingSubstitutions.map((s) => s.slotId));

    // Create substitutions for schedule entries that don't have one yet
    // Leave substituteTeacherId empty — will be assigned later
    // Since Prisma requires substituteTeacherId, we create placeholder entries
    const newEntries = scheduleEntries.filter((se) => !existingSlotIds.has(se.slotId));

    // Return the entries that need substitutes
    return successResponse({
      teacherId,
      date,
      reason: reason || null,
      entriesNeedingSubstitute: newEntries.map((se) => ({
        classId: se.classId,
        subjectId: se.subjectId,
        slotId: se.slotId,
        class: se.class,
        subject: se.subject,
        slot: se.slot,
      })),
      alreadyCoveredSlots: existingSubstitutions.length,
    });
  } catch (error) {
    console.error('POST /api/v1/substitutions/absent error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обработать отсутствие педагога', 500);
  }
}
