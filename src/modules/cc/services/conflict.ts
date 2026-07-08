import type { CcConflictStatus } from '@prisma/client';

export interface CcConflictProfileInput {
  studentCountries: string[];
  studentMajor: string | null;
  parentCountries: string[];
  parentBudgetUsd: number | null;
  budgetThresholdUsd: number | null;
  parentMajor: string | null;
}

function norm(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function normList(values: string[]) {
  return values.map(norm).filter(Boolean);
}

function hasIntersection(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

export function computeConflict(profile: CcConflictProfileInput): CcConflictStatus {
  const studentCountries = normList(profile.studentCountries);
  const parentCountries = normList(profile.parentCountries);
  const studentMajor = norm(profile.studentMajor);
  const parentMajor = norm(profile.parentMajor);

  const countriesOverlap = hasIntersection(studentCountries, parentCountries);
  const countriesComparable = studentCountries.length > 0 && parentCountries.length > 0;
  const countriesDiffer = countriesComparable && !countriesOverlap;
  const majorsComparable = Boolean(studentMajor && parentMajor);
  const majorsMatch = majorsComparable && studentMajor === parentMajor;
  const majorsDiffer = majorsComparable && studentMajor !== parentMajor;
  const hasStudentGoals = studentCountries.length > 0 || Boolean(studentMajor);
  const budget = profile.parentBudgetUsd;
  const budgetOk = budget == null || budget > 0;
  const threshold = profile.budgetThresholdUsd;
  const budgetEdge = budget != null && budget > 0 && threshold != null && budget <= threshold;
  const hasComparableSignal = countriesComparable || majorsComparable || budget != null;

  if (!hasComparableSignal) {
    return 'green';
  }

  if ((budget === 0 && hasStudentGoals) || (countriesDiffer && majorsDiffer)) {
    return 'red';
  }

  if ((countriesDiffer && majorsMatch) || budgetEdge) {
    return 'yellow';
  }

  if (countriesOverlap && budgetOk) {
    return 'green';
  }

  return 'yellow';
}

/*
Examples from the CC spec:
- studentCountries: [], studentMajor: null, parentCountries: [], parentMajor: null, parentBudgetUsd: null -> green
- studentCountries: ['USA'], studentMajor: 'Art', parentCountries: ['Germany'], parentMajor: 'Business', parentBudgetUsd: null -> red
- studentCountries: ['USA'], studentMajor: 'Business', parentCountries: ['Germany'], parentMajor: 'Business', parentBudgetUsd: null -> yellow
- studentCountries: ['USA'], studentMajor: null, parentCountries: [], parentMajor: null, parentBudgetUsd: 0 -> red
*/
