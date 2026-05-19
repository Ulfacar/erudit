/**
 * Filters student data based on the requesting user's star level.
 *
 * Star level access rules:
 * - Level 1: basic student info only (no medical, financial, family)
 * - Level 2: + behavior data (future, kept as-is for now)
 * - Level 3: + medicalData
 * - Level 4: + financialData, familyData (full access)
 */
export function filterByStarLevel(
  studentData: Record<string, unknown>,
  userStarLevel: number,
): Record<string, unknown> {
  const filtered = { ...studentData }

  if (userStarLevel < 3) {
    filtered.medicalData = null
  }

  if (userStarLevel < 4) {
    filtered.financialData = null
    filtered.familyData = null
  }

  return filtered
}
