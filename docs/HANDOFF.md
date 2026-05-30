# Bilim OS — HANDOFF (расклад для продолжения с другого ПК)

> Дата: 2026-05-30. Этот файл = вся обстановка, чтобы не поднимать контекст с нуля.
> Спеки рядом: `docs/edupage-teardown.md` (инвентарь EduPage → план), `docs/teacher-roadmap.md` (взгляд учителя).

## Что это
Bilim OS — школьная ERP (Next.js 16 App Router + Prisma + Postgres + Mantine 7, NextAuth, 9 ролей).
Прод: **https://bilimos.kg** (Coolify друга `c.asystem.ai`, БД — Neon). Репо: `github.com/Ulfacar/erudit` (remote `erudit`) + зеркало `github.com/Sijjia/school-erudit` (remote `origin`). Ветка `main`.

## Решение по продукту (от основателя)
Строим к **функциональному паритету с EduPage** (их фичи как идея/спека + НАШ красивый UI, не копируем их код/контент). **Исключаем:** платёжные шлюзы/банки, Face ID/биометрию/турникеты. Главное — EduPage-простота для учителя (он «терялся» в нашем меню).

## Что СДЕЛАНО (всё в `main`, протестировано end-to-end)
- **Учительский cockpit `/today`** — уроки на сегодня → клик → инлайн-грид баллов 0–100 с весами категорий → итог (взвеш. среднее); Enter ставит и прыгает; тема урока.
- **Оценивание как EduPage** — модерация ВЫКЛ (`GradeCategory.requiresModeration=false` у всех), учитель ставит сразу `published`. Веса берутся из категории, `weighted-average.ts`.
- **Меню по ролям** — учитель видит ~10 essentials; садится на `/today` (login redirect); дашборд-API для teacher → 403. Логика наборов в `src/shared/lib/nav-config.ts` (`ADMIN_SECRETARY`, `NON_TEACHING_AUTH`).
- **Privacy учителя server-side** — `src/shared/lib/teacher-scope.ts` (`getTeacherScope`): свои классы/замены, чужой classId → 403.
- **Модули EduPage:** заявления/записка об отсутствии (`/applications`), опросы (`/surveys`), заказ столовой (`/meals`), согласия родителей (`/consents`), бюро находок (`/lost-found`), ДЗ «выполнено» + подпись оценки (в `/diary`), **тесты с автопроверкой (`/tests`, Модуль 8)**.
- Раньше (тот же день): 15 бывших ComingSoon-страниц превращены в реальные модули.

## Что ОСТАЛОСЬ / идеи (см. teardown)
- Подтянуть тему урока из КТП одним кликом (сейчас free-text).
- Push-уведомления родителям; групповая рассылка классу.
- Тесты: открытые вопросы (text) сейчас авто-0 — ручная проверка учителем (UI не сделан).
- Автосоставление расписания (полуавтомат: ручное + валидатор) — R&D.
- PWA/мобилка, OCR скан тетрадей — «видение».

## КАК ПОДНЯТЬ ЛОКАЛКУ (важно — есть грабли)
1. **ГЛАВНАЯ ГРАБЛЯ:** `.env.local` и `.env.production` (выгружены `vercel env pull`) ПЕРЕБИВАЮТ `.env` и тянут DATABASE_URL на ПРОД-Neon + пустой NEXTAUTH. Для локалки они переименованы в `.env.local.bak` / `.env.production.bak` — НЕ возвращай их при локальной разработке. Если их нет — Next и Prisma берут `.env` (localhost:5433).
2. `docker compose up -d` (Postgres :5433 / Redis / MinIO).
3. `npm install`
4. `npx prisma migrate deploy` (применить миграции) + `npx prisma db seed` (основной seed, demo-данные, пароль `erudit2025`).
5. `npx tsx prisma/seed-modules.ts` (данные новых модулей) + `npx tsx prisma/seed-teacher-demo.ts` (учитель математики + демо-тест + модерация off).
6. `npm run dev` — **dev в webpack-режиме** (`next dev --webpack`, т.к. кириллица в пути ломает Turbopack jest-worker). Порт авто (часто 3001, если 3000 занят).
   - **Гоча Prisma+Windows:** `prisma generate` падает EPERM, если dev держит DLL. Перед миграцией останови dev (порт-кикалка в команде ниже), потом регенерируй.

```powershell
# остановить dev (порт 3001):
Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
```

## Демо-аккаунты (пароль у всех `erudit2025`)
- Школа/админ: `admin` · Завуч: `kozlova` · **Учитель (cockpit): `matematik`** (Айгуль Асанова, математика, уроки на сегодня + демо-тест) · Родитель: `parent1` · Ученик: `student1`/`student90` (90 — в классе демо-теста).

## АРХИТЕКТУРА (где что)
- **Generic-инфра (переиспользуй для новых CRUD-модулей):**
  - `src/shared/lib/crud.ts` → `createCrud({model,writeRoles,createFields,...})` отдаёт GET/POST/DELETE(?id=).
  - `src/shared/components/ui/ResourcePage.tsx` → таблица+модалка по конфигу (fields/columns/lookups/transformPayload).
  - `src/shared/components/ui/resource-helpers.ts` → studentField/classField/subjectField + lookups + fmtDate/fmtMoney.
- **Cockpit:** `src/app/(dashboard)/today/page.tsx` + API `src/app/api/v1/schedule/teacher-today/route.ts`.
- **RBAC:** `withAuth(req,{roles})` (`src/shared/lib/api-auth.ts`); `<RoleGate>`; nav `filterNavByRole`; teacherId из сессии — НЕ из query (см. teacher-scope).
- **Навигация/иконки:** `src/shared/lib/nav-config.ts` (роли) + `src/app/(dashboard)/layout.tsx` SIDEBAR_ICONS. **ГОЧА:** иконку в SIDEBAR_ICONS брать ТОЛЬКО из уже импортированных в layout — иначе ReferenceError роняет ВЕСЬ layout (все страницы 500). Дважды на этом ловились (IconBox, IconChecklist).
- API новых модулей: `src/app/api/v1/{applications,surveys,meal-orders,consents,lost-found,lesson-topics,tests,...}/`.

## ДЕПЛОЙ НА ПРОД (Coolify друга + Neon)
1. `git push erudit main` (и `origin main`).
2. Миграции на Neon (URL в `.env.production.bak` → `DATABASE_URL_UNPOOLED`):
   `DATABASE_URL="<neon-unpooled>" npx prisma migrate deploy`
3. (опц.) seed на Neon (pooled URL): `DATABASE_URL="<neon-pooled>" npx tsx prisma/seed-teacher-demo.ts`
4. Редеплой Coolify (API `c.asystem.ai`, app uuid `vqjsp8033jekwr4vnxgxrdyd`):
   `GET https://c.asystem.ai/api/v1/deploy?uuid=vqjsp8033jekwr4vnxgxrdyd&force=true` с `Authorization: Bearer <token>` (токен у Алана).
   - **ГОЧА:** на Coolify-приложении `NEXTAUTH_SECRET` должен быть НЕ пустой, иначе `/api/auth/*` → 500 «server configuration». (Чинили через `PATCH /applications/{uuid}/envs`.)
5. Проверка: `https://bilimos.kg/login` → вход `matematik`/`erudit2025` → `/today`.

> Приложение `bilim-os` живёт в Coolify-аккаунте ДРУГА (рядом с aios.kg/fiatex.kg/japan и т.д.). В своём Coolify Алан его не видит — это нормально. SSL/Traefik там тоже у друга.

## Статус прода на момент handoff
Modules 1–7 + cockpit уже на проде (коммит 3e1b5d0). **Модуль 8 (тесты) запушен в GitHub этим коммитом**; задеплоить на Coolify/Neon по шагам выше (если ещё не сделано в этой сессии — см. финальное сообщение).
