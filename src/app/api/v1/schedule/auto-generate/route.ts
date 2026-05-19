import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

interface GeneratedEntry {
  classId: string;
  teacherId: string;
  subjectId: string;
  slotId: string;
  dayOfWeek: number;
  periodStart: string;
  periodEnd: string;
  teacher: { id: string; firstName: string; lastName: string; middleName?: string | null };
  subject: { id: string; name: string; color?: string | null };
  slot: { id: string; slotNumber: number; startTime: string; endTime: string };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { classId, periodStart, periodEnd } = body;
    const save = request.nextUrl.searchParams.get('save') === 'true';

    if (!classId || !periodStart || !periodEnd) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Обязательные поля: classId, periodStart, periodEnd',
      );
    }

    // 1. Get all TeacherSubject entries for this class
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classId },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, middleName: true },
        },
        subject: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (teacherSubjects.length === 0) {
      return errorResponse(
        'NOT_FOUND',
        'Нет назначений учителей для данного класса. Сначала задайте нагрузку.',
        404,
      );
    }

    // 2. Get BellSchedule (only lesson slots)
    const bellSlots = await prisma.bellSchedule.findMany({
      where: { type: 'lesson' },
      orderBy: { slotNumber: 'asc' },
    });

    if (bellSlots.length === 0) {
      return errorResponse(
        'NOT_FOUND',
        'Расписание звонков не настроено. Сначала создайте слоты уроков.',
        404,
      );
    }

    // 3. Get existing schedule entries to check for teacher conflicts
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);

    const existingEntries = await prisma.scheduleEntry.findMany({
      where: {
        periodStart: { lte: pEnd },
        periodEnd: { gte: pStart },
      },
      select: {
        teacherId: true,
        dayOfWeek: true,
        slotId: true,
      },
    });

    // Build a set of occupied teacher slots: "teacherId:dayOfWeek:slotId"
    const occupiedSlots = new Set(
      existingEntries.map((e) => `${e.teacherId}:${e.dayOfWeek}:${e.slotId}`),
    );

    // 4. Generate schedule
    const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
    const maxSlotsPerDay = bellSlots.length;
    const generated: GeneratedEntry[] = [];

    // Track class slots that are already filled: "dayOfWeek:slotId"
    const classOccupied = new Set<string>();

    // For each teacher-subject, distribute hours across weekdays
    for (const ts of teacherSubjects) {
      const hoursToPlace = ts.hoursPerWeek;
      if (hoursToPlace <= 0) continue;

      let placed = 0;

      // Try to distribute evenly across weekdays
      // Sort weekdays by how many lessons are already placed on that day (ascending)
      const dayLoadCount = weekdays.map((day) => ({
        day,
        count: generated.filter((g) => g.dayOfWeek === day).length,
      }));

      dayLoadCount.sort((a, b) => a.count - b.count);

      for (const { day } of dayLoadCount) {
        if (placed >= hoursToPlace) break;

        for (const slot of bellSlots) {
          if (placed >= hoursToPlace) break;

          const classKey = `${day}:${slot.id}`;
          const teacherKey = `${ts.teacherId}:${day}:${slot.id}`;

          // Check class slot is free and teacher is not occupied
          if (classOccupied.has(classKey)) continue;
          if (occupiedSlots.has(teacherKey)) continue;

          // Place this lesson
          const entry: GeneratedEntry = {
            classId,
            teacherId: ts.teacherId,
            subjectId: ts.subjectId,
            slotId: slot.id,
            dayOfWeek: day,
            periodStart,
            periodEnd,
            teacher: ts.teacher,
            subject: ts.subject,
            slot: {
              id: slot.id,
              slotNumber: slot.slotNumber,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          };

          generated.push(entry);
          classOccupied.add(classKey);
          occupiedSlots.add(teacherKey);
          placed++;
        }
      }
    }

    // 5. Optionally save to DB
    if (save && generated.length > 0) {
      await prisma.scheduleEntry.createMany({
        data: generated.map((g) => ({
          classId: g.classId,
          teacherId: g.teacherId,
          subjectId: g.subjectId,
          slotId: g.slotId,
          dayOfWeek: g.dayOfWeek,
          periodStart: new Date(g.periodStart),
          periodEnd: new Date(g.periodEnd),
        })),
      });
    }

    return successResponse({
      generated,
      totalPlaced: generated.length,
      saved: save,
    });
  } catch (error) {
    console.error('POST /api/v1/schedule/auto-generate error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка при генерации расписания', 500);
  }
}
