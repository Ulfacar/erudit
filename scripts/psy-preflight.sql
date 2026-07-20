-- Production preflight for the psychology privacy hotfix.
-- Read-only: this script contains SELECT statements only and exposes aggregate counts, never PII.
-- Run manually on production by the DBA before deployment.

WITH metrics(ord, metric, value) AS (
  SELECT 1, 'active_cases'::text, COUNT(*)::bigint FROM "PsyCase" WHERE status <> 'closed'
  UNION ALL
  SELECT 2, 'closed_cases', COUNT(*)::bigint FROM "PsyCase" WHERE status = 'closed'
  UNION ALL
  SELECT 3, 'students_with_multiple_active_cases', COUNT(*)::bigint
  FROM (SELECT "studentId" FROM "PsyCase" WHERE "subjectType" = 'student' AND "studentId" IS NOT NULL AND "isIntake" = false AND status <> 'closed' GROUP BY "studentId" HAVING COUNT(*) > 1) duplicates
  UNION ALL
  SELECT 4, 'duplicate_active_cases_total', COALESCE(SUM(cnt - 1), 0)::bigint
  FROM (SELECT COUNT(*)::bigint AS cnt FROM "PsyCase" WHERE "subjectType" = 'student' AND "studentId" IS NOT NULL AND "isIntake" = false AND status <> 'closed' GROUP BY "studentId" HAVING COUNT(*) > 1) duplicates
  UNION ALL
  SELECT 5, 'cases_without_student', COUNT(*)::bigint FROM "PsyCase" WHERE "studentId" IS NULL
  UNION ALL
  SELECT 6, 'cases_by_subject_type_student', COUNT(*)::bigint FROM "PsyCase" WHERE "subjectType" = 'student'
  UNION ALL
  SELECT 7, 'cases_by_subject_type_parent', COUNT(*)::bigint FROM "PsyCase" WHERE "subjectType" = 'parent'
  UNION ALL
  SELECT 8, 'cases_by_subject_type_teacher', COUNT(*)::bigint FROM "PsyCase" WHERE "subjectType" = 'teacher'
  UNION ALL
  SELECT 9, 'cases_by_subject_type_group', COUNT(*)::bigint FROM "PsyCase" WHERE "subjectType" = 'group'
  UNION ALL
  SELECT 10, 'intake_cases', COUNT(*)::bigint FROM "PsyCase" WHERE "isIntake" = true
  UNION ALL
  SELECT 11, 'cases_with_reopened_ips', COUNT(DISTINCT "caseId")::bigint FROM "PsyIps" WHERE version > 1 OR "parentIpsId" IS NOT NULL
  UNION ALL
  SELECT 12, 'students_without_branch', COUNT(*)::bigint FROM "Student" WHERE "branchId" IS NULL
  UNION ALL
  SELECT 13, 'psy_users_without_branch', COUNT(*)::bigint FROM "User" WHERE role IN ('psychologist', 'senior_psychologist', 'psy_coordinator', 'specialist') AND "branchId" IS NULL
  UNION ALL
  SELECT 14, 'screening_results_total', COUNT(*)::bigint FROM "PsyScreeningResult"
  UNION ALL
  SELECT 15, 'screening_results_with_score', COUNT(*)::bigint FROM "PsyScreeningResult" WHERE score IS NOT NULL
)
SELECT metric, value
FROM metrics
ORDER BY ord;
