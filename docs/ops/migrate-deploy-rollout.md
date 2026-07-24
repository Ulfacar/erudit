# Rollout: переход с `db push` на `prisma migrate deploy`

Этот PR переводит применение схемы с `prisma db push` на версионированные миграции
(`prisma migrate deploy`) в `scripts/predeploy.mjs` и в CI. Добавлена одна catch-up
миграция `20260724021926_catchup_db_push_drift`, которая захватывает весь дрейф схемы,
накопленный через `db push` (psy-модуль, HR, контракты, CC-экзамены и т.д.). После неё
`migrate diff(миграции → schema.prisma) = 0` (доказано локально и guard'ом в CI).

## Как это работает по типам БД

- **Свежая БД (новый инстанс Intellect, CI):** ничего особого. `migrate deploy` применяет
  все 27 миграций с нуля → схема 1:1 с `schema.prisma`. Проверено: exit 0, дрейф 0.
- **Существующая БД, синхронизированная `db push` (bilimos.kg demo):** её схема УЖЕ равна
  текущей, но миграции в `_prisma_migrations` не затрекано. Такую БД нужно **забейзлайнить**
  ОДИН раз — пометить все 27 миграций как applied, не выполняя их.

## Safe-by-default

`predeploy.mjs` различает transient/детерминированные ошибки. Если задеплоить этот код на
ещё-не-забейзлайненную bilimos-БД, `migrate deploy` попытается применить `0000…init`
(CREATE TABLE) → «уже существует» → **детерминированная** ошибка → predeploy **логирует
громко и стартует апп на текущей (корректной) схеме**, НЕ уходит в crashloop. То есть даже
деплой «не по порядку» не роняет прод — но миграции не затрекаются, пока не сделан baseline.
Поэтому baseline — обязательный шаг для чистого состояния, но не «или прод упадёт».

## Процедура baseline существующей БД (bilimos.kg) — с разрешения Алана

**Сначала rehearsal на КОПИИ, не на живой БД.**

1. **Копия:** Neon branch (секунды) ИЛИ `pg_dump` prod → restore в scratch-БД.
2. **ОБЯЗАТЕЛЬНЫЙ ГЕЙТ корректности baseline (review MAJOR-2): доказать, что схема живой БД
   РАВНА `schema.prisma` ДО того как метить миграции applied.** На копии:
   ```bash
   npx prisma migrate diff \
     --from-url "$DATABASE_URL_COPY" \
     --to-schema-datamodel prisma/schema.prisma --exit-code   # ДОЛЖНО быть exit 0
   ```
   - **exit 0** → схема копии == `schema.prisma`, baseline корректен, идём к шагу 3.
   - **exit 2 (есть дифф)** → живой bilimos РАСХОДИТСЯ со `schema.prisma` (накопленный db-push
     дрейф / ручной хотфикс). **НЕ бейзлайнить вслепую** — иначе `resolve --applied` зафиксирует
     ложь и следующая настоящая миграция упадёт на проде. Сначала примирить: изучить дифф,
     привести схему (аккуратный `db push`/новая миграция с review), повторить гейт до exit 0.
3. Пометить все миграции applied (только когда шаг 2 = exit 0):
   ```bash
   for m in $(ls prisma/migrations | grep -v migration_lock); do
     npx prisma migrate resolve --applied "$m"
   done
   ```
   `resolve --applied` пишет ТОЛЬКО строку в `_prisma_migrations`, данные/схему не трогает.
4. Проверка на копии:
   - `npx prisma migrate status` → «Database schema is up to date».
   - `npx prisma migrate deploy` → «No pending migrations».
5. Если копия чистая — **повторить шаги 2-4 на реальной bilimos-БД** (resolve безопасен, но уже
   отрепетирован; гейт шага 2 повторить и на живой БД).
6. Только теперь деплоить код этого PR на bilimos — `migrate deploy` увидит всё applied → чисто.

> **Safe-by-default в коде (review MAJOR-1):** если этот PR всё же доедет до bilimos ДО baseline,
> `predeploy.mjs` детектит состояние «схема есть, истории миграций нет» (прямой запрос:
> есть `"User"`, но `_prisma_migrations` пуст) и **пропускает `migrate deploy` с громким warn** —
> НЕ создаёт failed-миграцию и не залипает в P3009. Апп стартует на текущей схеме. Baseline всё
> равно обязателен, но порядок «деплой раньше baseline» больше не отравляет БД.

## Порядок для нового инстанса Intellect

Baseline НЕ нужен. Пустая БД → `migrate deploy` применит все 27 миграций честно. Это происходит
автоматически в `predeploy.mjs` при первом старте. Убедиться после: `migrate status` = up to date.

## Rollback

Миграции НЕ считаются автоматически откатываемыми. Откат = forward-fix новой миграцией,
проверенный manual SQL, или restore из бэкапа (снять бэкап ДО baseline/деплоя).

## Проверки после деплоя (любой инстанс)

- `npx prisma migrate status` → up to date.
- HTTP health + /login 200, контейнер running, restarts=0.
- В логах старта: `[predeploy] ✓ миграции применены` (или, для незабейзлайненной БД до baseline —
  громкий детерминированный лог + старт на текущей схеме).
