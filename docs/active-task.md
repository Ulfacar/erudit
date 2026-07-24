# Миграции вместо `db push` (Prisma migrate deploy)

## Бизнес-цель
Убрать единственный живой риск прода: сейчас каждый старт контейнера гонит `prisma db push` («подгони схему как получится», без истории, может потерять/переписать данные или зациклить контейнер). На реальных данных детей Intellect это мина. Перейти на версионированные, откатываемые миграции (`migrate deploy`).

## Текущее состояние (проверено, не по памяти)
- `prisma/migrations` СУЩЕСТВУЕТ: **26 миграций** до `20260707130000_zvr_culture_cohesion`.
- `prisma.config.ts` уже настроен (`migrations.path = prisma/migrations`, seed `prisma/seed.ts`).
- НО: `predeploy.mjs:20` и `.github/workflows/ci.yml:63` используют `prisma db push --skip-generate`. То есть прод синхронизировали `db push`-ем, миграции в проде НЕ применялись (в `_prisma_migrations` их, скорее всего, нет).
- Возможен дрейф: `schema.prisma` мог уйти вперёд последней миграции (PR #5/#6/demo-seeds — проверить `migrate diff`).
- base: `erudit/main = c891ee90…`. Ветка: `infra/prisma-migrate-deploy`.

## Scope
1. Проверить дрейф `schema.prisma` ↔ 26 миграций (shadow-БД). При дрейфе — одна catch-up миграция.
2. `predeploy.mjs`: `db push` → `migrate deploy` (сохранить transient-backoff логику для Neon cold-start).
3. `ci.yml`: `db push --skip-generate` → `migrate deploy`.
4. Доказать на СВЕЖЕЙ БД (CI Postgres): `migrate deploy` → seeds → e2e зелёные; ноль дрейфа.
5. Deploy-runbook: существующие прод-БД забейзлайнить `migrate resolve --applied` (rehearsal на копии) — это ДЕПЛОЙ-шаг, не этот PR.

## Не входит в задачу
- Реальный деплой / `resolve` на живой прод-БД (только runbook + rehearsal-инструкция).
- Изменение самой схемы данных.
- Squash истории миграций (если дрейфа нет — не трогаем 26 файлов).
- Никаких изменений ENV/DATABASE_URL/пользователей/секретов.

## Инварианты (что нельзя сломать)
- Свежая БД + `migrate deploy` = схема 1:1 с `schema.prisma` (ноль дрейфа).
- Seeds (base + demo при SEED_DEMO=1) и e2e проходят на мигрированной БД.
- Transient-ошибки Neon (cold-start) по-прежнему ретраятся с backoff; детерминированные — не ретраятся.
- Прод НЕ трогается этим PR.

## Основные риски
- Существующая прод-БД (bilimos.kg) при `migrate deploy` без предварительного `resolve --applied` → «table already exists» → crashloop. → runbook + rehearsal на копии.
- Дрейф schema↔миграции → свежая БД получит неверную схему. → catch-up миграция + проверка нулевого дрейфа.
- Neon cold-start под `migrate deploy` (не `db push`) — сохранить backoff.

## Выбранный режим Venom
**BLACK** (migrations + prod-infra + data-safety). Владелец: Opus (я). Независимый review в конце — свежий Opus-субагент.

## План
1. Disposable Postgres (docker) → `migrate diff --from-migrations --to-schema-datamodel` → величина дрейфа.
2. Если дрейф: `migrate dev --name catchup_current` на disposable → catch-up миграция.
3. Правка `predeploy.mjs` + `ci.yml` на `migrate deploy`.
4. Локально: свежая БД → `migrate deploy` → диф пустой; smoke.
5. Push → CI (fresh Postgres докажет).
6. Независимый Opus-review (диф + evidence).
7. Отчёт → READY FOR MERGE. Merge/deploy — по слову Алана.

## Делегирование
### Codex
Не как прямой агент (готов work-order при желании Алана). §16 — реализую сам как Lead Engineer.
### Fable
Не подключается (нет UI).
### Opus
Один независимый review готового дифа перед вердиктом (свежий субагент).

## Acceptance criteria
- [ ] Свежая БД: `migrate deploy` применяет все миграции без ошибок.
- [ ] `migrate diff --from-migrations --to-schema-datamodel` = пусто (ноль дрейфа).
- [ ] `predeploy.mjs` и `ci.yml` больше не содержат `db push`; используют `migrate deploy`.
- [ ] CI зелёный (check + e2e RBAC на мигрированной БД).
- [ ] Deploy-runbook описывает baseline существующих БД (`resolve --applied`) + rehearsal.
- [ ] Прод не затронут; ENV/DB/пользователи/секреты не менялись.

## Изменённые файлы
- `scripts/predeploy.mjs` — `db push` → `migrate deploy` (backoff/детерминированная-логика сохранены).
- `.github/workflows/ci.yml` — `db push --skip-generate` → `migrate deploy` + drift-guard step.
- `prisma/migrations/20260724021926_catchup_db_push_drift/migration.sql` — NEW, catch-up дрейфа (56 CREATE TABLE, 13 enum, индексы; деструктива данных нет — только DROP CONSTRAINT/NOT NULL на LibraryLoan).
- `docs/ops/migrate-deploy-rollout.md` — NEW, deploy-runbook (baseline + rehearsal).
- `docs/active-task.md` — NEW.

## Тесты / evidence (локально, disposable Postgres)
- ✅ Дрейф `migrations → schema.prisma` = **0** (после catch-up).
- ✅ Свежая БД + `migrate deploy` = все 27 миграций применены, exit 0.
- ✅ Дрейф `свежая-развёрнутая-БД → schema.prisma` = **0** (миграции = схема 1:1).
- ✅ Catch-up без деструктива данных (нет DROP TABLE/COLUMN/DELETE/TRUNCATE).
- CI (pending push): drift-guard (`migrate diff --exit-code`) + `migrate deploy` на свежей БД + seeds + e2e RBAC.

## Текущее состояние выполнения
Код + catch-up + runbook готовы, локальные инварианты доказаны. Далее: commit → push → CI → независимый Opus-review → отчёт. Merge/deploy — по слову Алана.

## Решение, необходимое от Алана
Пока нет (техническое). Появится только на этапе deploy (разрешение + rehearsal на копии прод-БД).
