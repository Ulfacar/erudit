import { GRADE_SCALE } from '@/shared/constants/grade-scales';

type FromScale = '5point';
type ToScale = '12point' | 'percentage' | 'gpa';

/**
 * Canonical scale key used across the journal UI.
 *  '5point' | '12point' | '100point' | 'af'
 *
 * Prisma stores raw values in the chosen scale (FIVE/TWELVE/HUNDRED/LETTER).
 * Use prismaScaleToKey() / keyToPrismaScale() to translate.
 */
export type CanonicalScale = '5point' | '12point' | '100point' | 'af';
export type PrismaScale = 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER';

const PRISMA_TO_KEY: Record<PrismaScale, CanonicalScale> = {
  FIVE: '5point',
  TWELVE: '12point',
  HUNDRED: '100point',
  LETTER: 'af',
};

export function prismaScaleToKey(scale: PrismaScale | undefined | null): CanonicalScale {
  if (!scale) return '5point';
  return PRISMA_TO_KEY[scale] ?? '5point';
}

const LETTER_TO_FIVE: Record<number, number> = {
  // value (0..14) → 5-point bucket
  14: 5, 13: 5, 12: 5, 11: 5,
  10: 4, 9: 4, 8: 4, 7: 4,
  6: 3, 5: 3, 4: 3,
  3: 2, 2: 2, 1: 2,
  0: 1,
};

const LETTER_LABELS = ['F-', 'F', 'F+', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

/**
 * Convert any source value to 5-point pivot (1..5).
 */
export function toFivePoint(value: number, sourceScale: CanonicalScale): number {
  switch (sourceScale) {
    case '5point':
      return Math.max(1, Math.min(5, Math.round(value)));
    case '12point': {
      const v = Math.max(0, Math.min(12, Math.round(value)));
      const row = GRADE_SCALE.find(
        (r) => v >= r.twelvePoint[0] && v <= r.twelvePoint[1],
      );
      return row?.fivePoint ?? Math.max(1, Math.round((v / 12) * 5));
    }
    case '100point': {
      const v = Math.max(0, Math.min(100, Math.round(value)));
      const row = GRADE_SCALE.find((r) => v >= r.percent[0] && v <= r.percent[1]);
      return row?.fivePoint ?? Math.max(1, Math.round((v / 100) * 5));
    }
    case 'af':
      return LETTER_TO_FIVE[Math.max(0, Math.min(14, Math.round(value)))] ?? 1;
    default:
      return 1;
  }
}

/**
 * Universal display: format a stored value in its source scale into any target scale.
 *   displayInScale(78, '100point', '5point') → '4'
 *   displayInScale(11, '12point', 'af')      → 'A'
 *   displayInScale(13, 'af', '100point')     → '90-100%' label fallback
 */
export function displayInScale(
  value: number,
  sourceScale: CanonicalScale,
  targetScale: CanonicalScale,
): string {
  if (sourceScale === targetScale) {
    if (targetScale === 'af') {
      return LETTER_LABELS[Math.max(0, Math.min(14, Math.round(value)))] ?? String(value);
    }
    return String(Math.round(value));
  }
  if (targetScale === '5point') {
    return String(toFivePoint(value, sourceScale));
  }
  // Pivot via 5-point
  const five = toFivePoint(value, sourceScale);
  if (targetScale === '12point') return convertGrade(five, '5point', '12point');
  if (targetScale === '100point') return convertGrade(five, '5point', 'percentage');
  if (targetScale === 'af') {
    const map: Record<number, string> = { 5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'F' };
    return map[five] ?? String(five);
  }
  return String(value);
}

/**
 * Convert a grade value from the 5-point scale to another scale.
 *
 * @param value - grade value (1-5)
 * @param fromScale - source scale (only '5point' supported)
 * @param toScale - target scale: '12point', 'percentage', or 'gpa'
 * @returns converted value as number or descriptive string
 *
 * Examples:
 *   convertGrade(5, '5point', '12point')    => '10-12'
 *   convertGrade(4, '5point', 'percentage') => '70-89%'
 *   convertGrade(3, '5point', 'gpa')        => '1.70-2.69'
 */
export function convertGrade(
  value: number,
  fromScale: FromScale,
  toScale: ToScale,
): string {
  if (fromScale !== '5point') {
    return String(value);
  }

  const row = GRADE_SCALE.find((r) => r.fivePoint === Math.round(value));
  if (!row) return String(value);

  switch (toScale) {
    case '12point': {
      const [lo, hi] = row.twelvePoint;
      return String(Math.round((lo + hi) / 2));
    }
    case 'percentage': {
      const [lo, hi] = row.percent;
      return `${Math.round((lo + hi) / 2)}%`;
    }
    case 'gpa': {
      const [lo, hi] = row.gpa;
      return ((lo + hi) / 2).toFixed(1);
    }
    default:
      return String(value);
  }
}

/**
 * Convert a numeric weighted average (e.g. 4.35) to a display string in the target scale.
 * For averages that aren't whole numbers, we find the closest 5-point row.
 */
export function convertAverage(
  average: number,
  toScale: ToScale | '5point',
): string {
  if (toScale === '5point' || average === 0) return average.toFixed(2);

  // Find the matching row by rounding
  const rounded = Math.round(average);
  const clamped = Math.max(1, Math.min(5, rounded));

  return convertGrade(clamped, '5point', toScale);
}

/**
 * Get human-readable label for a scale.
 */
export function getScaleLabel(scale: string): string {
  switch (scale) {
    case '5point':
      return '5-балльная';
    case '12point':
      return '12-балльная';
    case 'percentage':
      return 'Процентная';
    case 'gpa':
      return 'GPA';
    default:
      return scale;
  }
}
