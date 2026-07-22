# Анализ psy-аномалий перед релизом (read-only)

Основано на схеме `prisma/schema.prisma` и коде `src/shared/lib/psy-scope.ts`,
роутов `psy/cases`, `psy/subject-card`. **Продовые данные не изменялись.**
Диагностический скрипт: [`psy-anomalies-readonly.sql`](./psy-anomalies-readonly.sql).

Прод-preflight на `7dab3cc`: active=11, closed=2, dup_active=2 (1 ученик с 2 активными),
cases_without_student=2, intake=6, screening_results=0, students/psy_users без филиала=0.

## 1. Могут ли 2 `cases_without_student` быть intake/legacy

Да, и это ожидаемо по схеме. `PsyCase.studentId` — **nullable** и заполняется только при
`subjectType='student'` (см. коммент в схеме: «для student дублирует studentId»). Поэтому
`studentId IS NULL` штатно у кейсов `subjectType IN ('parent','teacher','group')` — это НЕ
повреждение. Отличить можно по колонке `subject_type` в скрипте:

- `subject_type <> 'student'` → **легитимный** кейс по родителю/учителю/группе, ничего чинить не нужно.
- `subject_type = 'student'` **и** `student_hash IS NULL` → аномалия (legacy/битый кейс, созданный
  до появления обязательного studentId). Требует ручного решения психолога.

`is_intake=true` дополнительно помечает PRE-тесты приёмки (их в проде 6) — часть из них могла
закрыться со `status='closed'` и остаться без живого studentId, если ученик так и не зачислен.

## 2. Сломает ли PR #5 чтение этих записей

**Нет.** PR #5 (`0406c815`) **не трогает** `psy-scope.ts`; `caseWhereForScope` фильтрует кейсы
только по `ownerId`/`collaborators`, без обращения к `studentId`. Значит владелец продолжает
видеть свой кейс даже при `studentId IS NULL`. Отрисовка тоже безопасна: список делает
`c.studentId ? initials(c.studentId) : '—'`.

Ветки PR #5, где появляется зависимость от студента/филиала, — это **создание** и субъект-карта,
не чтение существующих кейсов владельцем:
- `POST /psy/cases` → `canAccessStudent` нужен только на создании нового кейса.
- `GET /psy/subject-card` → гейт по subjectId/parentId/teacherId, а не по «плавающим» кейсам.

Единственный побочный риск PR #5 не про эти 2 кейса, а про **психологов с `branchId IS NULL`**:
после хотфикса `getBranchScope` для них `closed:true` → 403 на создание кейса и субъект-карту.
Прод-preflight показывает `psy_users_without_branch = 0`, значит этот риск сейчас **не активен**.
Держать инвариант до деплоя (не заводить психолога без филиала / не выдавать `psy_cross_branch`).

## 3. Почему у одного ученика два активных кейса

`dup_active=2`, `students_with_multiple_active_cases=1` — один ученик, два `status<>'closed'`,
`isIntake=false`, `subjectType='student'` кейса. Схема этого **не запрещает** (нет уникального
индекса на `(studentId, active)`), поэтому дубль мог появиться штатно:

- два разных `ownerId` завели кейс на одного ребёнка (разные поводы/раунды), либо
- один и тот же психолог создал второй кейс новым `courseRound` вместо продолжения старого.

Скрипт кладёт такие строки рядом (сортировка по `student_hash`), с `owner_hash`, `created_at`,
`risk_level` и счётчиками — этого достаточно, чтобы отличить «дубль-пустышку» от «двух реальных».

## 4. Как определить, в каком кейсе реальная работа

Колонки скрипта на кейс: `sessions` (встречи), `ips` (ИППС), `measurements` (замеры),
`test_results`, `attachments` (аудио-вложения), `owner_hash`, `created_at`/`updated_at`, и
сводный флаг `has_real_work`. Правило разбора дубля:

- `has_real_work = false`, `sessions=0`, `ips=0` → пустой кейс-черновик → кандидат на закрытие.
- `has_real_work = true` с бОльшими счётчиками и свежим `updated_at` → **основной** кейс.
- Если оба непустые — это **не** технический дубль; решение только у психолога.

## Безопасная рекомендация (без авто-правок)

- **Требуют ручного решения психолога/`psy_coordinator`:** дубль активных кейсов у 1 ученика и
  любой `subject_type='student'` c пустым `student_hash`. Не объединять и не закрывать автоматически —
  можно потерять клиническую историю.
- **Можно grandfather (оставить как есть):** `cases_without_student` с `subject_type<>'student'`
  (родитель/учитель/группа) и закрытые intake-кейсы — это валидные состояния схемы.
- **Нельзя автоматически:** UPDATE/DELETE/merge психологических кейсов скриптом. Только read-only
  диагностика + ручное решение в закрытом контуре. Данных ФИО в отчёте нет by design.
