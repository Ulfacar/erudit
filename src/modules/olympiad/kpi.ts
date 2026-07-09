export type KpiWeights = { w1: number; w2: number; w3: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computeKpi(
  input: {
    tasksSolved: number;
    tasksTotal: number;
    attendedDays: number;
    totalDays: number;
    awardPoints: number | null;
  },
  weights: KpiWeights,
): number {
  const solveRatio = input.tasksTotal > 0 ? input.tasksSolved / input.tasksTotal : 0;
  const attendRatio = input.totalDays > 0 ? input.attendedDays / input.totalDays : 0;
  const resultRatio = input.awardPoints != null ? clamp(input.awardPoints / 100, 0, 1) : null;

  if (resultRatio == null) {
    const sum = weights.w1 + weights.w2;
    const kpi01 = sum > 0 ? (weights.w1 / sum) * solveRatio + (weights.w2 / sum) * attendRatio : 0;
    return clamp(Math.round(kpi01 * 100), 0, 100);
  }

  const kpi01 = weights.w1 * solveRatio + weights.w2 * attendRatio + weights.w3 * resultRatio;
  return clamp(Math.round(kpi01 * 100), 0, 100);
}

export function kpiColor(kpi: number): 'green' | 'yellow' | 'red' {
  if (kpi >= 80) return 'green';
  if (kpi >= 50) return 'yellow';
  return 'red';
}
