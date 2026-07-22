-- Read-only диагностика psy-аномалий перед релизом. НЕ выполняет UPDATE/DELETE.
-- Не выводит ФИО, тексты сессий, reason алертов — только opaque-идентификаторы и счётчики.
-- studentId/ownerId захешированы (md5), чтобы отчёт нельзя было сопоставить с конкретным
-- ребёнком/психологом вне закрытого контура. caseId оставлен как ключ поиска в кабинете.
--
-- Запуск (пример): psql "$DATABASE_URL" -f docs/psy-anomalies-readonly.sql
-- Решение по каждой строке принимает психолог/psy_coordinator ВРУЧНУЮ, не скрипт.

SELECT
  c.id                                             AS case_id,          -- opaque cuid (ключ в кабинете)
  md5(c."studentId")                               AS student_hash,     -- NULL если кейс без ученика
  md5(c."ownerId")                                 AS owner_hash,
  c."subjectType"                                  AS subject_type,     -- student|parent|teacher|group
  c.status                                         AS status,
  c."isIntake"                                     AS is_intake,
  c."riskLevel"                                    AS risk_level,
  c."createdAt"                                    AS created_at,
  c."updatedAt"                                    AS updated_at,
  (SELECT COUNT(*) FROM "PsySession"     s WHERE s."caseId" = c.id)                          AS sessions,       -- «встречи»
  (SELECT COUNT(*) FROM "PsyIps"         i WHERE i."caseId" = c.id)                          AS ips,            -- ИППС
  (SELECT COUNT(*) FROM "PsyMeasurement" m WHERE m."caseId" = c.id)                          AS measurements,   -- «оценки»/замеры
  (SELECT COUNT(*) FROM "PsyTestResult"  t WHERE t."caseId" = c.id)                          AS test_results,
  (SELECT COUNT(*) FROM "PsySession"     s WHERE s."caseId" = c.id AND s."audioKey" IS NOT NULL) AS attachments, -- «вложения» (аудио)
  -- Есть ли вообще реальная работа в кейсе (для решения grandfather / закрыть / оставить):
  (
    EXISTS (SELECT 1 FROM "PsySession"     s WHERE s."caseId" = c.id) OR
    EXISTS (SELECT 1 FROM "PsyIps"         i WHERE i."caseId" = c.id) OR
    EXISTS (SELECT 1 FROM "PsyMeasurement" m WHERE m."caseId" = c.id) OR
    EXISTS (SELECT 1 FROM "PsyTestResult"  t WHERE t."caseId" = c.id)
  )                                                AS has_real_work
FROM "PsyCase" c
ORDER BY
  (c."studentId" IS NULL) DESC,   -- сначала cases_without_student
  c."subjectType",
  c."studentId" NULLS FIRST,      -- сгруппировать дубли по одному ученику рядом
  c."createdAt";
