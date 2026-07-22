export function gradeBandGrades(band: string): number[] {
  if (band === '1-4') return [1, 2, 3, 4];
  if (band === '5-9') return [5, 6, 7, 8, 9];
  if (band === '10-11') return [10, 11];
  return [];
}

export const GRADE_BANDS = ['1-4', '5-9', '10-11'];

/** Серверный подсчёт балла скрининга. Клиентскому score не доверяем. */
export function computeScreeningScore(
  rawScores: unknown,
  scaleConfig: unknown,
  schema?: unknown,
): { score: number | null; invalid: boolean } {
  let entries: [string, unknown][];
  if (Array.isArray(rawScores)) {
    entries = rawScores.map((value, index) => [String(index), value]);
  } else if (typeof rawScores === 'object' && rawScores !== null) {
    const scores = rawScores as Record<string, unknown>;
    if (Array.isArray(scores.answers)) {
      entries = scores.answers.map((value, index) => [String(index), value]);
    } else if (typeof scores.answers === 'object' && scores.answers !== null) {
      entries = Object.entries(scores.answers);
    } else if (Object.values(scores).every((value) => typeof value === 'number')) {
      entries = Object.entries(scores);
    } else {
      return { score: null, invalid: true };
    }
  } else {
    return { score: null, invalid: true };
  }

  const schemaConfig = typeof schema === 'object' && schema !== null ? schema as Record<string, unknown> : null;
  let scaleMin = typeof schemaConfig?.scaleMin === 'number' ? schemaConfig.scaleMin : 0;
  let scaleMax = typeof schemaConfig?.scaleMax === 'number' ? schemaConfig.scaleMax : 10;
  if (scaleMax <= scaleMin) {
    scaleMin = 0;
    scaleMax = 10;
  }

  if (entries.length === 0 || entries.some(([, value]) =>
    typeof value !== 'number' || !Number.isFinite(value) || value < scaleMin || value > scaleMax
  )) {
    return { score: null, invalid: true };
  }

  const config = typeof scaleConfig === 'object' && scaleConfig !== null ? scaleConfig as Record<string, unknown> : null;
  const weights = config?.weights;
  const validWeights = Array.isArray(weights)
    ? weights.every((weight) => typeof weight === 'number' && Number.isFinite(weight))
    : typeof weights === 'object' && weights !== null && Object.values(weights).every((weight) => typeof weight === 'number' && Number.isFinite(weight));

  const score = entries.reduce((sum, [key, value], index) => {
    if (!validWeights) return sum + (value as number);
    const weight = Array.isArray(weights)
      ? weights[index]
      : (weights as Record<string, number>)[key];
    return sum + (value as number) * (weight ?? 1);
  }, 0);
  return { score: Math.round(score), invalid: false };
}
