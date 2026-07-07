export function gradeBandGrades(band: string): number[] {
  if (band === '1-4') return [1, 2, 3, 4];
  if (band === '5-9') return [5, 6, 7, 8, 9];
  if (band === '10-11') return [10, 11];
  return [];
}

export const GRADE_BANDS = ['1-4', '5-9', '10-11'];
