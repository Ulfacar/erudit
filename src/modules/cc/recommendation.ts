import { type Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

function payloadDocumentId(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

export async function closeRecommendationTask(documentId: string, byUserId: string) {
  const openItems = await prisma.agentItem.findMany({
    where: {
      ruleKey: 'cc-recommendation-requested',
      status: { in: ['new', 'in_progress', 'approved'] },
    },
    select: { id: true, payload: true },
  });
  const item = openItems.find((candidate) => payloadDocumentId(candidate.payload) === documentId);
  if (!item) return;

  await prisma.agentItem.update({
    where: { id: item.id },
    data: { status: 'done', resolvedAt: new Date(), resolvedBy: byUserId },
  });
  await prisma.agentActionLog.create({
    data: { itemId: item.id, action: 'done', byUserId, detail: { documentId } },
  });
}
