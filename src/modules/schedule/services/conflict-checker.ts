import { prisma } from '@/shared/lib/prisma';

export interface ConflictEntry {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  slotId: string;
  dayOfWeek: number;
  periodStart: Date;
  periodEnd: Date;
  class: { id: string; grade: number; letter: string };
  teacher: { id: string; firstName: string; lastName: string };
  subject: { id: string; name: string };
  slot: { id: string; slotNumber: number; startTime: string; endTime: string };
}

/**
 * Check if a teacher already has a schedule entry that conflicts with the given slot.
 * A conflict exists when:
 *   - same teacherId
 *   - same dayOfWeek
 *   - same slotId
 *   - overlapping period (periodStart/periodEnd)
 *
 * @param excludeEntryId — optional id to exclude (used when updating an existing entry)
 */
export async function checkConflicts(
  teacherId: string,
  dayOfWeek: number,
  slotId: string,
  periodStart: Date,
  periodEnd: Date,
  excludeEntryId?: string,
): Promise<ConflictEntry[]> {
  const conflicts = await prisma.scheduleEntry.findMany({
    where: {
      teacherId,
      dayOfWeek,
      slotId,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    include: {
      class: { select: { id: true, grade: true, letter: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true } },
      slot: { select: { id: true, slotNumber: true, startTime: true, endTime: true } },
    },
  });

  return conflicts as ConflictEntry[];
}
