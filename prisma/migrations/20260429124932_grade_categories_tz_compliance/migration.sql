-- 1) Add new columns
ALTER TABLE "GradeCategory" ADD COLUMN     "enabledForTeachers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isAssessment"       BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresModeration" BOOLEAN NOT NULL DEFAULT false;

-- 2) Move existing rows out of the [1..26] order range so we can repaint them
UPDATE "GradeCategory" SET "order" = "order" + 1000;

-- 3) Repaint each row with the ТЗ taxonomy: name, weight, order, isAssessment, requiresModeration.
UPDATE "GradeCategory" gc
SET "name" = tz.new_name,
    "weight" = tz.new_weight,
    "order" = tz.new_order,
    "isAssessment" = tz.new_assessment,
    "requiresModeration" = tz.new_moderation
FROM (VALUES
  ('Правила (терминология)',              2, 1,  false, false),
  ('Пятиминутка',                          2, 2,  false, false),
  ('Разноуровневые задания',               3, 3,  false, false),
  ('Домашнее задание',                     1, 4,  false, false),
  ('Устный ответ/работа у доски',          3, 5,  false, false),
  ('Письменные работы',                    3, 6,  true,  false),
  ('Диктант',                              5, 7,  true,  false),
  ('Словарный диктант',                    5, 8,  true,  false),
  ('Тест',                                 4, 9,  true,  false),
  ('Аудирование',                          3, 10, false, false),
  ('Грамматика',                           3, 11, false, false),
  ('Чтение и понимание',                   3, 12, false, false),
  ('Контрольное списывание',               3, 13, true,  false),
  ('Эссе',                                 4, 14, true,  false),
  ('Лабораторная работа',                  4, 15, true,  false),
  ('Проект',                               3, 16, false, false),
  ('Презентация',                          3, 17, false, false),
  ('Творческие работы',                    2, 18, false, false),
  ('Самооценивание',                       1, 19, false, false),
  ('Работа в группах (коммуникация)',      2, 20, false, false),
  ('Олимпиадные задания',                  5, 21, false, false),
  ('Контрольная работа',                   5, 22, true,  true),
  ('Зачёт',                                5, 23, true,  true),
  ('Триместровая работа',                  5, 24, true,  true),
  ('Итоговая работа',                      5, 25, true,  true),
  ('Экзамен',                              5, 26, true,  true)
) AS tz(new_name, new_weight, new_order, new_assessment, new_moderation)
WHERE gc."order" = 1000 + tz.new_order;

-- 4) Insert any TZ categories that didn't have a slot (in case fewer than 26 existed)
INSERT INTO "GradeCategory" ("id", "name", "weight", "order", "isAssessment", "requiresModeration", "enabledForTeachers")
SELECT
  'tz_cat_' || tz.new_order::text,
  tz.new_name,
  tz.new_weight,
  tz.new_order,
  tz.new_assessment,
  tz.new_moderation,
  false
FROM (VALUES
  ('Правила (терминология)',              2, 1,  false, false),
  ('Пятиминутка',                          2, 2,  false, false),
  ('Разноуровневые задания',               3, 3,  false, false),
  ('Домашнее задание',                     1, 4,  false, false),
  ('Устный ответ/работа у доски',          3, 5,  false, false),
  ('Письменные работы',                    3, 6,  true,  false),
  ('Диктант',                              5, 7,  true,  false),
  ('Словарный диктант',                    5, 8,  true,  false),
  ('Тест',                                 4, 9,  true,  false),
  ('Аудирование',                          3, 10, false, false),
  ('Грамматика',                           3, 11, false, false),
  ('Чтение и понимание',                   3, 12, false, false),
  ('Контрольное списывание',               3, 13, true,  false),
  ('Эссе',                                 4, 14, true,  false),
  ('Лабораторная работа',                  4, 15, true,  false),
  ('Проект',                               3, 16, false, false),
  ('Презентация',                          3, 17, false, false),
  ('Творческие работы',                    2, 18, false, false),
  ('Самооценивание',                       1, 19, false, false),
  ('Работа в группах (коммуникация)',      2, 20, false, false),
  ('Олимпиадные задания',                  5, 21, false, false),
  ('Контрольная работа',                   5, 22, true,  true),
  ('Зачёт',                                5, 23, true,  true),
  ('Триместровая работа',                  5, 24, true,  true),
  ('Итоговая работа',                      5, 25, true,  true),
  ('Экзамен',                              5, 26, true,  true)
) AS tz(new_name, new_weight, new_order, new_assessment, new_moderation)
WHERE NOT EXISTS (
  SELECT 1 FROM "GradeCategory" gc WHERE gc."order" = tz.new_order AND gc."order" < 1000
);

-- 5) Any leftover old rows (>= 1000 still) — push beyond TZ list (100+) to keep them readable but separate
UPDATE "GradeCategory" SET "order" = "order" - 1000 + 100 WHERE "order" >= 1000;
