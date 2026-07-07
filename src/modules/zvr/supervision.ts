import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

const CONVERSATION_NOTE_TYPE = 'conversation';

type SupervisionPrisma = typeof prisma | Prisma.TransactionClient;

export async function countSessionsDone(
  client: SupervisionPrisma,
  studentId: string,
  openedAt: Date,
): Promise<number> {
  return client.studentNote.count({
    where: {
      studentId,
      type: CONVERSATION_NOTE_TYPE,
      createdAt: { gte: openedAt },
    },
  });
}

export async function hasIncompleteSupervisionCycle(
  client: SupervisionPrisma,
  incidentId: string,
): Promise<boolean> {
  const cases = await client.supervisionCase.findMany({
    where: {
      behaviorIncidentId: incidentId,
      closedAt: null,
    },
    select: {
      studentId: true,
      openedAt: true,
      sessionsPlanned: true,
    },
  });

  for (const supervisionCase of cases) {
    const done = await countSessionsDone(client, supervisionCase.studentId, supervisionCase.openedAt);
    if (done < supervisionCase.sessionsPlanned) return true;
  }

  return false;
}

export function monitoringDeadline(from = new Date()): Date {
  const deadline = new Date(from);
  deadline.setDate(deadline.getDate() + 30);
  return deadline;
}
