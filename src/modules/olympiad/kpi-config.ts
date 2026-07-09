import { prisma } from '@/shared/lib/prisma';
import type { KpiWeights } from '@/modules/olympiad/kpi';

export const DEFAULT_KPI_CONFIG = { w1: 0.5, w2: 0.3, w3: 0.2, version: 1 } satisfies KpiWeights & { version: number };

export async function getKpiConfig(branchId: string | null) {
  const config = await prisma.kpiConfig.findFirst({
    where: { branchId },
    select: { id: true, branchId: true, w1: true, w2: true, w3: true, version: true, updatedById: true, updatedAt: true },
  });
  return config ?? { id: null, branchId, updatedById: null, updatedAt: null, ...DEFAULT_KPI_CONFIG };
}

export async function saveKpiConfig(branchId: string | null, weights: KpiWeights, updatedById: string) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.kpiConfig.findFirst({ where: { branchId }, select: { id: true, version: true } });
    if (old) {
      return tx.kpiConfig.update({
        where: { id: old.id },
        data: { ...weights, version: old.version + 1, updatedById },
      });
    }
    return tx.kpiConfig.create({ data: { branchId, ...weights, version: 1, updatedById } });
  });
}
