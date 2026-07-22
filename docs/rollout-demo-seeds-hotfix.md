# Rollout — demo-seeds security hotfix (PR #7)

Ветка `security/disable-demo-seeds-by-default`. Закрывает release-blocker: на обычном
production-рестарте всегда запускаемые сиды создавали/реактивировали демо-пользователей и
ставили статический пароль. Никакого merge/deploy до прохождения этого чек-листа человеком.

## Что меняется в поведении

**Default path (обычный production-рестарт: `SEED_DEMO` отсутствует или `=0`):**
- Запускаются только base seeds: `backfill-branches`, `seed-psy-templates`,
  `backfill-debtor-contracts`, `backfill-psy-codes`, `seed-roles`.
- **Ни один из них не создаёт пользователей, не активирует, не меняет пароль/роль.**
- `seed-roles` теперь сидирует ТОЛЬКО справочники (схемы наград).
- Единственная user-мутация в base path — `backfill-branches`: проставляет `branchId`
  сотрудникам, у кого он `NULL` (convergent, NULL-only, не перетирает заданный админом филиал,
  не трогает пароль/isActive/role). Нужен, чтобы `psy_users_without_branch` оставался 0 для PR #5.

**Demo path (только `SEED_DEMO=1`):**
- Дополнительно: `seed-demo-users`, `seed-demo-intake`, `seed-demo-media`, `seed-demo-cc`.
- `seed-demo-users` (перенесённые из `seed-roles` демо-аккаунты ролей) и `seed-demo-cc`
  (демо-college-counselor) берут пароль ТОЛЬКО из `SEED_DEMO_PASSWORD`, без fallback,
  и падают ДО любой записи в БД, если переменной нет (без частичного seed). Пароль не логируется.

## Переменные окружения

| Переменная | Prod (реальная школа) | Demo-стенд |
|---|---|---|
| `SEED_DEMO` | не задавать или `0` | `1` |
| `SEED_DEMO_PASSWORD` | не нужна | обязательна (иначе демо-сиды падают до мутаций) |

Defense-in-depth: перед деплоем прод явно выставить `SEED_DEMO=0`, хотя код безопасен и при
отсутствующей переменной.

## Pre-deploy чек-лист (человек)

- [ ] Прод/Coolify: `SEED_DEMO=0` (или переменная отсутствует), `SEED_DEMO_PASSWORD` НЕ задана.
- [ ] Подтвердить: `backfill-branches` branchId-бэкфилл приемлем (он единственный трогает User в base path).
- [ ] Порядок merge: этот PR (#7) → PR #5 → ребейз PR #6 → re-CI PR #6 → merge PR #6 → один финальный main SHA → один deploy через Руслана.
- [ ] Все три PR (#7/#5/#6) меняют `ci.yml` — мержить строго по порядку, пересобирая CI.
- [ ] После деплоя: убедиться, что демо-аккаунты (`counselor`, `event1`, `senior_psy`, …) НЕ появились/НЕ реактивировались в проде.

## Остаточный tech-debt (вне этого PR)

- `predeploy` безусловно гоняет `prisma db push` на старте — HIGH, отдельный тикет.
- `scripts/seed-demo.ts` (CI/dev-only, НЕ в predeploy) всё ещё хардкодит `erudit2025` — это не
  production seed path; чистится отдельно вместе с login-чипами/e2e-хелперами.
