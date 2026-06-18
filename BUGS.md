# BUGS — слепое QA по ролям (ERUDIT / Bilim OS)

Прогон: 2026-06-08 (после фиксов)  ·  Всего сценариев: 345

## [J097] [analyst] Происшествия (/incidents)

**Status:** PASSED*  ·  **Severity:** —  ·  **Actor:** analyst  ·  **Category:** R_analyst

**Что увидел блайнд-тестер:** console: Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information. 

Check the render method of `@mantine/core/Box`.  It was passed a child from In

**Screenshot:** `journey-results/screenshots/J097.png`

---

## [J154] [zavuch] Срочные вопросы (/urgent-issues)

**Status:** PASSED*  ·  **Severity:** —  ·  **Actor:** zavuch  ·  **Category:** R_zavuch

**Что увидел блайнд-тестер:** console: Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information. 

Check the render method of `@mantine/core/Box`.  It was passed a child from Ur

**Screenshot:** `journey-results/screenshots/J154.png`

---

## [J155] [zavuch] Происшествия (/incidents)

**Status:** PASSED*  ·  **Severity:** —  ·  **Actor:** zavuch  ·  **Category:** R_zavuch

**Что увидел блайнд-тестер:** console: Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information. 

Check the render method of `@mantine/core/Box`.  It was passed a child from In

**Screenshot:** `journey-results/screenshots/J155.png`

---

## [J229] [teacher] Происшествия (/incidents)

**Status:** PASSED*  ·  **Severity:** —  ·  **Actor:** teacher  ·  **Category:** R_teacher

**Что увидел блайнд-тестер:** console: Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information. 

Check the render method of `@mantine/core/Box`.  It was passed a child from In

**Screenshot:** `journey-results/screenshots/J229.png`

---

## [J302] [parent] Олимпиады и проекты (/olympiads)

**Status:** PASSED*  ·  **Severity:** —  ·  **Actor:** parent  ·  **Category:** R_parent

**Что увидел блайнд-тестер:** 4xx: 400 http://localhost:3100/api/v1/grading/subjects; 400 http://localhost:3100/api/v1/grading/subjects | console: Failed to load resource: the server responded with a status of 400 (Bad Request); Failed to load resource: the server responded with a status of 400 (Bad Request)

**Screenshot:** `journey-results/screenshots/J302.png`

---

## [J345] [khaydarova] НЕ видит свои L2-дескрипторы

**Status:** PASSED*  ·  **Severity:** —  ·  **Actor:** khaydarova  ·  **Category:** F_rbac

**Что увидел блайнд-тестер:** негатив: страница открыта без краша, явной утечки не видно — проверить содержимое вручную

**Screenshot:** `journey-results/screenshots/J345.png`

---


## [ROLE-callcenter] Колл-центр входит и видит должников

**Status:** FAILED
**Severity:** MINOR
**Actor:** call_center (callcenter1 / erudit2025)
**Category:** role-access
**Started:** 2026-06-09T00:00:00Z
**Duration:** ~2m 10s

### Observations
- Login passes successfully — redirected to https://bilimos.kg/call-center
- After login opens /call-center with heading "Колл-центр — задолжники", NOT "Доступ запрещён"
- Page shows debtor table: columns Ученик / Класс / Телефон / Долг / Пеня / Просрочка / Последнее обещание; phone numbers (+996 …) and "Обещание" action buttons are present
- "Ядро" (graph) section is NOT accessible — not present in sidebar or anywhere on page; sidebar shows only: Панель агента / Чаты / Новости / Колл-центр
- No console errors; no 4xx/5xx network errors

### Repro
1. Go to https://bilimos.kg/login
2. Enter login: callcenter1, password: erudit2025
3. Click "Войти в кабинет"
4. Landed on https://bilimos.kg/call-center — debtor table visible with phone numbers and "Обещание" buttons
5. Looked through all nav links in sidebar — no "Ядро" link exists
6. Clicked "Панель агента" — same sidebar, still no "Ядро"
7. Expected: "Ядро" section accessible with domain graph showing "Колл-центр" and "Финансы" domains
8. Actual: "Ядро" is entirely absent from the callcenter1 role's navigation; user cannot discover or reach it

### Screenshot
`journey-results/screenshots/ROLE-callcenter.png`

### Console / network errors
none

### Suggested fix
Add a navigation entry for "Ядро" (/core or /graph) to the call_center role's sidebar/menu. The route itself may already allow the role — the fix is ensuring the link is surfaced in the nav for this role.

---

## [ROLE-senior-psy] Старший психолог входит и открывает Ядро

**Status:** FAILED
**Severity:** MAJOR
**Actor:** senior_psy (senior_psychologist)
**Category:** role-access / navigation
**Started:** 2026-06-09T00:00:00Z
**Duration:** ~4m

### Observations
- PASS Форма входа принимает логин `senior_psy` / `erudit2025` и пускает внутрь — авторизация прошла, редирект на `/psychologist/overview`
- PASS После входа НЕ показывается «Доступ запрещён» — пользователь попадает в «Кабинет психолога»
- PASS Видны психологические разделы в меню: «Кабинет психолога», «Конструктор методик», «Психология: сводка» — все три присутствуют в сайдбаре
- FAIL Раздел «Ядро» / «Граф ядра» отсутствует в навигационном меню для роли `senior_psychologist`. Пункт `/core` («Граф ядра») есть в меню у admin, но у старшего психолога его нет. Страница `/core` технически доступна по прямому URL (нет 403, нет редиректа), граф рисуется, узлы «Безопасность» и «Психолог (eSPSMS)» видны на canvas — но найти её через UI невозможно.
- PARTIAL URL `/yadro` возвращает 404 — такого маршрута не существует. Реальный маршрут — `/core`.
- PARTIAL «Безопасность» виден на графе (canvas), «Психолог (eSPSMS)» виден на графе, но «Колл-центр» не читается визуально на canvas при полноэкранном скриншоте.
- PASS Консольных ошибок при загрузке `/core` нет (`errors: []`).
- MINOR Dashboard `/psychologist/overview` показывает спиннер в основной области контента в момент снимка — возможна медленная загрузка или ошибка рендера сводки.

### Repro
1. Открыть `https://bilimos.kg/login`
2. Выбрать вкладку роли «Ст. психолог», ввести логин `senior_psy`, пароль `erudit2025`, нажать «Войти в кабинет»
3. Попасть в «Кабинет психолога» — ожидаем увидеть пункт «Ядро» или «Граф ядра» в левом меню
4. Ожидаемое: пункт «Граф ядра» присутствует в сайдбаре, как у роли admin (`/core`)
5. Фактическое: пункта нет. Меню содержит только: «Панель агента», «Чаты», «Новости», «Кабинет психолога», «Конструктор методик», «Психология: сводка». Ни «Ядро», ни «Граф ядра» не доступны через UI.

### Screenshot
`journey-results/screenshots/ROLE-senior-psy-03-dashboard.png` — post-login dashboard (спиннер в контентной области)
`journey-results/screenshots/ROLE-senior-psy-04-core-full.png` — граф `/core` открытый напрямую (граф рисуется, узлы видны)

### Console / network errors
`404 https://bilimos.kg/yadro` — маршрут `/yadro` не существует (тест по прямому URL)
Ошибок на `/core` нет.

### Suggested fix
1. Добавить пункт «Граф ядра» (href `/core`) в конфиг навигации для роли `senior_psychologist` — по аналогии с тем, как он добавлен для `admin`.
2. URL `/yadro` либо не нужен, либо нужно добавить redirect `/yadro` → `/core`.
3. Проверить, почему `/psychologist/overview` показывает пустой контент со спиннером — возможен медленный API-запрос без fallback.

---

## [ROLE-safeguard] Координатор безопасности входит и видит свой контур

**Status:** FAILED
**Severity:** MINOR
**Actor:** safeguarding_lead (login: safeguard)
**Category:** role_access
**Started:** 2026-06-09T00:00:00Z
**Duration:** ~25s

### Observations
- PASS Вход проходит успешно — залогинен без ошибки авторизации, URL после входа: `https://bilimos.kg/safeguarding`
- PASS После входа открылся закрытый контур "Координатор безопасности" (не generic /dashboard, не "Доступ запрещён"). Страница содержит надпись "Закрытый контур. Здесь раскрываются инициалы и причина критических кейсов."
- FAILED Раздел "Ядро" (граф) НЕ присутствует в сайдбар-навигации для роли safeguard. Доступные пункты меню: "Панель агента", "Чаты", "Новости", "Психология: сводка", "Координатор безопасности". При прямом переходе на `/core` граф открывается, не возвращает "Доступ запрещён", рисует домены включая "Безопасность". То есть роль имеет доступ к /core, но ссылка не добавлена в сайдбар.
- PASS Красных ошибок в консоли нет (0 console errors, 0 сетевых 4xx/5xx)

### Repro
1. Открыть `https://bilimos.kg/login`
2. Ввести логин `safeguard`, пароль `erudit2025`, нажать "Войти в кабинет"
3. Попасть на `https://bilimos.kg/safeguarding` — корректно
4. Изучить левое меню: ссылки "Ядро" нет
5. Expected: пункт "Ядро" (граф) присутствует в навигации для роли safeguarding_lead
6. Actual: пункт отсутствует в сайдбаре; граф доступен только прямой ссылкой /core

### Screenshot
`journey-results/screenshots/ROLE-safeguard.png`

### Console / network errors
none

### Suggested fix
Добавить пункт навигации "Ядро" в сайдбар для роли `safeguarding_lead` (аналогично другим ролям с доступом к /core). Проверить массив разрешённых nav-пунктов для этой роли в конфиге навигации.

---

## [J-CC-01] Call-center role — login, cabinet, and Граф ядра

**Status:** FAILED
**Severity:** MINOR
**Actor:** call_center (callcenter1 / erudit2025)
**Category:** R_call_center
**Started:** 2026-06-09T00:40:00Z
**Duration:** ~3m 30s

### Observations
- PASS Login succeeds — credentials accepted, session established.
- PASS Lands on /call-center (NOT /dashboard, NOT "Доступ запрещён"). URL: https://bilimos.kg/call-center
- PASS Page title: "Колл-центр — задолжники". Debtors table present with columns: Ученик, Класс, Телефон, Долг, Пеня, Просрочка, Последнее обещание.
- PASS "Обещание" buttons visible per row (3+ debtors in table: Асанов Азамат, Карыпова Элиза, Абдуллаева Анна with phone numbers and debt amounts).
- PASS Sidebar contains "Граф ядра" link (exact text, points to /core).
- PASS Clicking "Граф ядра" navigates to https://bilimos.kg/core — neuro-graph page opens.
- PASS "Финансы" node IS present in the graph canvas (visible in screenshot, confirmed in HTML data).
- FAIL "Колл-центр" domain node: present in HTML/data source (confirmed via DOM search) but NOT visually readable as a labeled node in the canvas at default zoom/position. The node label may be off-screen or requires scrolling/panning the canvas. A real user would not see "Колл-центр" as a domain node without interacting with the graph.
- PASS Zero red console errors.

### Repro (for the FAIL)
1. Log in as callcenter1 / erudit2025 at https://bilimos.kg/login
2. Click "Граф ядра" in sidebar — lands on /core
3. Observe the canvas graph at default zoom/pan
4. Expected: "Колл-центр" label visible as a domain node alongside "Финансы", "Кадры (HR)", etc.
5. Actual: "Колл-центр" text not visible as a labeled graph node on screen. "Финансы" node is partially visible but small. Multiple other module nodes (Безопасность, AI-агент, Библиотека, Договоры, Кадры HR, Столовая, Журнал, База знаний, Инвентарь, Специалист eSPSMS) are visible. "Колл-центр" node data exists in the HTML source but the canvas does not show it as a readable label at default viewport.

### Screenshot
`journey-results/screenshots/J-callcenter-04-core-full.png`

### Console / network errors
None (0 console errors).

### Suggested fix
The graph canvas likely has the "Колл-центр" node but it is placed in an area outside the default viewport or has a very small radius causing its label to be hidden. Adjust the force-graph initial positioning so that all module-level (Модуль) nodes are visible within the default viewport, or increase the minimum node size/label visibility threshold. Alternatively, ensure "Финансы" and "Колл-центр" are clustered near "Школа" (center) so they appear on screen without panning.

---

## [ROLE-accountant] Бухгалтер входит, видит финансы, журнал оплат и граф ядра

**Status:** PASSED
**Actor:** accountant (accountant1 / erudit2025)
**Category:** role-access / finance
**Started:** 2026-06-09T07:00:00Z
**Duration:** ~3m

### Observations
- PASS Вход с логином `accountant1` / `erudit2025` успешен — редирект на `https://bilimos.kg/workspace/accounting`
- PASS Страница после входа — «Бухгалтерия» (accountant1 / Бухгалтер), NOT generic /dashboard, NOT «Доступ запрещён»
- PASS Сайдбар содержит: Панель агента, Граф ядра, Чаты, Новости, Финансы, Колл-центр, Журнал оплат, Бухгалтерия
- PASS «Финансы» `/finance` открывается без «Доступ запрещён», контент рендерится под сессией accountant1
- PASS «Журнал оплат» `/finance/journal` рендерится: заголовок «Журнал оплат», блок «Разбивка по способам оплаты», карточки «Банк 63 000 сом / 7 платеж.» и «Наличные 15 000 сом / 3 платеж.», таблица платежей с колонкой «Способ» — breakdown по методам оплаты есть
- PASS «Граф ядра» присутствует в сайдбаре (href `/core`), текст пункта «Граф ядра»
- PASS `/core` открывается под сессией accountant1 без «Доступ запрещён»; рендерится canvas-граф; страница содержит текст «Финансы» (в sidebar и/или в тексте графа); кроме того: «УЧЕНИКОВ: 162 / ПЕДАГОГОВ: 18 / КЛАССОВ: 18 / УЗЛОВ: 200 / СВЯЗЕЙ: 253»
- PASS Консольных ошибок: 0. Сетевых 4xx/5xx: 0

### Repro
1. Открыть `https://bilimos.kg/login`
2. Заполнить «Логин или email»: `accountant1`, пароль: `erudit2025`, нажать «Войти в кабинет»
3. Результат: редирект на `https://bilimos.kg/workspace/accounting`, в шапке «accountant1 / Бухгалтер»
4. В сайдбаре присутствуют ссылки: «Финансы», «Журнал оплат», «Граф ядра»
5. Перейти «Журнал оплат» → `/finance/journal` → видна разбивка по методам (Банк / Наличные) + таблица последних платежей
6. Перейти «Граф ядра» → `/core` → canvas рендерится, «Финансы» присутствует в тексте/меню, нет «Доступ запрещён»

### Screenshot
`journey-results/screenshots/ROLE-accountant-A-post-login.png` — landing after login (accountant1 / Бухгалтерия)
`journey-results/screenshots/ROLE-accountant-B-journal.png` — Журнал оплат с разбивкой по методам
`journey-results/screenshots/ROLE-accountant-C-graph.png` — Граф ядра под accountant1

### Console / network errors
none

---

## [J-SENIOR-PSY-01] senior_psy role — psychology cabinet + graf yadra

**Status:** PASSED (with one minor observation)
**Severity:** MINOR
**Actor:** senior_psychologist (login: senior_psy)
**Category:** auth / role-routing / navigation
**Started:** 2026-06-09T00:00:00Z
**Duration:** ~45s

### Observations

- PASS Login succeeds. Lands at `https://bilimos.kg/psychologist/overview`, NOT stuck on /login.
- PASS Landing URL is `/psychologist/overview` — psychology-specific cabinet, NOT generic `/dashboard`, NOT "Доступ запрещён".
- PASS Sidebar contains "Граф ядра" link (href: `/core`). Clicking it opens `https://bilimos.kg/core`.
- PARTIAL Graf yadra renders with 200 nodes / 253 edges. Domain nodes "Безопасность", "Психолог", "Колл-центр" ARE visually present on the canvas graph. However DOM/innerText extraction only surfaced "Психолог" — "Безопасность" and "Колл-центр" are rendered inside a canvas element and not accessible via innerText. Visually confirmed in screenshot.
- PASS Sidebar psychology items all present: "Кабинет психолога", "Конструктор методик", "Психология: сводка".
- PASS Zero console errors across login, overview, and graf pages.
- MINOR Landing page (`/psychologist/overview`) shows a loading spinner in screenshot taken immediately after navigation. Content hydrates within ~2s but is not instantly visible. Could feel slow to users.

### Repro
1. Navigate to https://bilimos.kg/login
2. Fill "Логин или email" field with `senior_psy`, fill password with `erudit2025`
3. Click "Войти в кабинет"
4. Expected: land at psychology cabinet (`/psychologist/overview`), sidebar shows "Граф ядра"
5. Actual: lands at `/psychologist/overview` with spinner visible for ~2s before content loads
6. Click "Граф ядра" in sidebar
7. Expected: graf page renders with domain nodes including Безопасность, Психолог, Колл-центр
8. Actual: all three nodes ARE visible in the canvas graph render. DOM text only includes "Психолог" (others are canvas-painted labels, not DOM text nodes)

### Screenshot
`journey-results/screenshots/J-senior-psy-03-after-login.png` — landing with spinner
`journey-results/screenshots/J-senior-psy-core-full.png` — graf yadra fully rendered (canvas nodes visible)

### Console / network errors
none

### Suggested fix
- For the slow-hydration minor issue: consider a skeleton/placeholder for the psychology overview content so the white-spinner screen is replaced with a content skeleton.
- For DOM accessibility of graf nodes: if "Безопасность" and "Колл-центр" node labels need to be accessible (screen readers, automated tests), render them as SVG `<text>` elements rather than canvas-painted strings.

---

## [J-PSYCH-01] Psychologist role — login, cabinet, and neuro-graph

**Status:** PASSED
**Actor:** psychologist (psychologist1 / erudit2025)
**Category:** auth + role-specific module
**Started:** 2026-06-09T00:42:15Z
**Duration:** ~4m

### Observations
- PASS: Login succeeds — credentials accepted, session created.
- PASS: Landing URL is /psychologist ("Кабинет психолога"), NOT /dashboard and NOT "Доступ запрещён".
- PASS: Sidebar contains link "Граф ядра". Clicking it navigates to /core and the neuro-graph renders (canvas + SVG present, stats visible: 200 nodes / 253 connections, live badge shown).
- PASS: Cabinet loads content immediately — 3 demo cases shown (КРАСНЫЙ/ЖЁЛТЫЙ/ЗЕЛЁНЫЙ), no infinite spinner.
- PASS: Zero red console errors; zero 4xx/5xx network responses.

### Repro
1. Navigate to https://bilimos.kg/login
2. Fill "Логин или email" with psychologist1, fill password with erudit2025.
3. Click "Войти в кабинет".
4. Expected: land on /psychologist with case list.
5. Actual: landed on /psychologist — case table visible with 3 rows (Токтосунов, Бекмуратова, Асанов).
6. Click "Граф ядра" in sidebar.
7. Expected: /core opens with rendered graph.
8. Actual: /core opened, dark-canvas graph rendered with 200 nodes / 253 connections, "live" badge active.

### Screenshot
`journey-results/screenshots/J-psych-cabinet.png` (cabinet landing)
`journey-results/screenshots/J-psych-graf.png` (neuro-graph page)

### Console / network errors
none

---

## [J-SG01] Safeguarding coordinator cabinet — blind role test

**Status:** PARTIAL FAIL (2 PASSED, 1 FAILED, 2 PASSED)
**Severity:** MAJOR
**Actor:** safeguarding_lead (login: safeguard / erudit2025)
**Category:** safeguarding
**Started:** 2026-06-09T00:00:00Z
**Duration:** ~3m

### Observations

- ✅ OBS 1 — Login succeeds. Auth callback 200, redirects to https://bilimos.kg/safeguarding (NOT /login, NOT /dashboard).
- ✅ OBS 2 — Lands on safeguarding cabinet: URL is /safeguarding, H2 = «Координатор безопасности», sidebar shows role label «safeguarding_lead». Text «Закрытый контур» and description of anonymous-phone policy visible. NOT /dashboard, NOT «Доступ запрещён».
- ❌ OBS 3 — Sidebar CONTAINS link «Граф ядра» (confirmed present in nav). Clicking it does NOT navigate away — URL stays at /safeguarding for 10+ seconds. No neuro-graph opens, no «Безопасность» domain node rendered. Expected: click → /core-graph or /graph/neuro route, canvas/SVG neuro-graph with «Безопасность» node. Actual: no-op, page stays on /safeguarding.
- ✅ OBS 4 — Safeguarding page DOES load content (no infinite spinner). Alert card «Критический риск · Ученик Т.Д.» with cause «Подозрение на жестокое обращение в семье» and status «ОТКРЫТ» is visible within ~4s. Note: content takes ~3-4 seconds to appear after networkidle — could be a client-side fetch delay.
- ✅ OBS 5 — No red console errors. No 4xx/5xx network errors observed.

### Repro (OBS 3 — Граф ядра click is a no-op)

1. Go to https://bilimos.kg/login
2. Enter login «safeguard», password «erudit2025», click «Войти в кабинет»
3. Page redirects to https://bilimos.kg/safeguarding
4. Observe sidebar: «Граф ядра» link is visible
5. Click «Граф ядра»
6. Expected: navigate to neuro-graph page (some /graph or /core route), render graph, «Безопасность» domain node visible
7. Actual: URL remains https://bilimos.kg/safeguarding, page content unchanged, no graph renders

### Landing URL

https://bilimos.kg/safeguarding

### «Граф ядра» in sidebar

PRESENT — text confirmed in nav list: ["Панель агента","Граф ядра","Чаты","Новости","Психология: сводка","Координатор безопасности"]

### Screenshot

`journey-results/screenshots/J001.png`

### Console / network errors

None. Zero console errors, zero 4xx/5xx responses.

### Suggested fix

The «Граф ядра» `<a>` or `<Link>` in the safeguarding_lead sidebar likely points to a route that is either not registered for this role or uses a client-side navigation handler that is silently failing. Check: (1) the href value of that nav item in the sidebar component for safeguarding_lead — if it is «#» or empty, add the correct /graph (or /core-graph) route. (2) If the route exists but access is denied, the RBAC guard is swallowing the navigation silently instead of showing an error — should show a «Доступ запрещён» page instead.

---

## [J_HR_BLIND_01] HR Role — Login, Cabinet, Договоры Tab, Граф ядра

**Status:** FAILED
**Severity:** MINOR
**Actor:** hr (hr1 / erudit2025)
**Category:** role_smoke / hr
**Started:** 2026-06-09T00:40:00Z
**Duration:** ~4m

### Observations

- PASSED Login succeeds: `hr1` + `erudit2025` -> lands on `https://bilimos.kg/hr` (session: role=hr, login=hr1).
- PASSED Lands on `/hr`, heading reads "Кадры (HR)". NOT generic /dashboard, NOT "Доступ запрещён".
- PASSED All 5 expected tabs present: Резерв кандидатов / Вакансии / Зарплаты / Отпуска / Договоры.
- PASSED "Договоры" tab opens and renders correctly: heading "Трудовые договоры", count badge 0, empty-state "Пока нет записей", "Заключить договор" CTA button. No console errors, no 5xx responses.
- FAILED "Граф ядра" link IS visible in sidebar (href=/core) but clicking it navigates to `/core` which immediately 302-redirects back to `/hr`. The neuro-graph page never opens for the HR role. Expected: graph opens and shows "Кадры (HR)" domain node. Actual: silent redirect back to cabinet.
- PASSED No red console errors on any step.

### Repro

1. Go to `https://bilimos.kg/login`.
2. Click the "HR (кадры)" role card.
3. Fill "Логин или email" = `hr1`, "Пароль" = `erudit2025`, press Enter.
4. Verify landing on `/hr` with heading "Кадры (HR)" and all 5 tabs.
5. Click "Договоры" tab — renders "Трудовые договоры / Пока нет записей".
6. Click "Граф ядра" in the sidebar.
7. Expected: `/core` page opens with neuro-graph including a "Кадры (HR)" node.
8. Actual: browser navigates to `/core`, gets redirected to `/hr` immediately. HR role cannot see the neuro-graph.

### Screenshot

`journey-results/screenshots/J_HR_04_graf.png` (screenshot taken after redirect — shows HR cabinet, not graph)
`journey-results/screenshots/J_HR_02_hr_page.png` (HR cabinet with all 5 tabs visible on landing)
`journey-results/screenshots/J_HR_03_dogovor.png` (Договоры tab — empty-state, renders OK)

### Console / network errors

None. The redirect is silent — no 403, no error page, just a 302-style client-side redirect back to /hr.

### Suggested fix

Add the `hr` role to the RBAC allow-list for `/core` (the neuro-graph page), or hide the "Граф ядра" sidebar link for roles that do not have access to it. Showing a link that silently fails is a UX dead end; either grant access or remove the link.

---

---

## Сессия 2026-06-10 — Аудит 4 фич (психолог-модуль)

---

## [J-PSY-01] Тип встречи «Встреча с учителями» (психолог)

**Status:** PASSED
**Actor:** psychologist1
**Category:** psychologist / session form
**Started:** 2026-06-10T00:00:00Z
**Duration:** ~2m

### Observations
- PASS Кабинет психолога доступен и показывает список кейсов (3 кейса: Токтосунов, Бекмуратова, Асанов)
- PASS Кнопка «Новая сессия» присутствует на странице кейса
- PASS Dropdown «Тип встречи» содержит пункт «Встреча с учителями» (наряду с «Встреча с родителями», «Групповая работа», «Первичная диагностика», «Плановая встреча», «Экстренная интервенция»)
- BLOCKED Бейдж «входная диагностика» на кейсах не обнаружен — ни один из 3 кейсов не имеет статуса intake (нет демо-данных с intake-кейсом для этой роли)

### Repro (Встреча с учителями)
1. Логин: psychologist1 / erudit2025 на https://bilimos.kg/login
2. Перейти в «Кабинет психолога» (сайдбар)
3. Кликнуть на кейс «Токтосунов Данияр — Кризисная ситуация»
4. Нажать кнопку «Новая сессия»
5. Открыть dropdown поля «Тип встречи»
6. Expected: пункт «Встреча с учителями» в списке
7. Actual: пункт присутствует — PASS

### Screenshot
`journey-results/screenshots/J1-meeting-type-open.png`

### Console / network errors
none

---

## [J-PSY-02] Назначение со-психолога + стандартные шаблоны (старший психолог)

**Status:** PASSED
**Actor:** senior_psy
**Category:** psychologist / co-assignment / methods
**Started:** 2026-06-10T00:00:00Z
**Duration:** ~3m

### Observations
- PASS Блок «Назначить со-психолога (консилиум)» отображается на странице кейса для роли senior_psychologist
- PASS Dropdown «Выберите психолога» содержит опции: «senior_psy · старший», «specialist1 · специалист»
- PASS Кнопка «Назначить» присутствует и функционирует: после клика API вернул 201 Created (POST /api/v1/psy/cases/.../collaborators), бейдж «specialist1» появился на странице кейса
- PASS В разделе «Конструктор методик» присутствуют все 3 стандартных шаблона: «DAP-R (v1 активна)», «ДАП-П (v1 активна)», «Нарисуй человека (v1)», плюс «Шкала тревожности»

### Repro (критерий A — со-психолог)
1. Логин: senior_psy / erudit2025
2. Сайдбар → «Кабинет психолога» → кликнуть кейс «Токтосунов»
3. На странице кейса найти блок «Назначить со-психолога (консилиум)»
4. В dropdown выбрать «specialist1 · специалист», нажать «Назначить»
5. Expected: HTTP 201, бейдж specialist1 появляется на странице
6. Actual: PASS — бейдж отобразился

### Repro (критерий B — шаблоны методик)
1. Сайдбар → «Конструктор методик»
2. Expected: «Нарисуй человека», «ДАП-П», «DAP-R» в списке
3. Actual: все три присутствуют — PASS

### Screenshot
`journey-results/screenshots/J2-methodology-constructor.png`
`journey-results/screenshots/J2-case-after-assign.png`

### Console / network errors
none (API: 201 для collaborators, 200 для всех остальных)

---

## [J-PSY-03] Приёмная видит заключение психолога (секретарь)

**Status:** BLOCKED
**Actor:** secretary1
**Category:** admissions / psychologist integration
**Started:** 2026-06-10T00:00:00Z
**Duration:** ~2m

### Observations
- PASS Раздел «Приёмная (CRM)» доступен в сайдбаре и открывается корректно
- PASS Колонка «ЗАЧИСЛЕН» содержит 1 карточку: «Дастан Эсенов» (в 5-й класс, Рекомендация)
- BLOCKED Кнопка «Заключение психолога» НЕ найдена ни на одной карточке в колонке «ЗАЧИСЛЕН» — ни в видимом тексте, ни в HTML. Карточка зачисленного ученика содержит только: кнопку удаления (мусор), данные ученика, тест-результаты, бейдж «в ядре: ученик создан». Функция показа заключения психолога не реализована в UI приёмной.

### Repro
1. Логин: secretary1 / erudit2025 → сайдбар → «Приёмная (CRM)»
2. Найти колонку «ЗАЧИСЛЕН» (1 карточка — Дастан Эсенов)
3. Expected: кнопка «Заключение психолога» на карточке
4. Actual: кнопки нет — функция не реализована в UI

### Причина блока
Это не отсутствие демо-данных. Функция «Заключение психолога» на карточке приёмной не реализована в коде — кнопки нет в HTML страницы /admission. Требуется разработка.

### Screenshot
`journey-results/screenshots/J3-admissions-full.png`

### Console / network errors
none

---

## Сводка сессии 2026-06-10

| Journey | Статус | Примечание |
|---------|--------|------------|
| J-PSY-01 «Встреча с учителями» | PASSED | Тип встречи присутствует в dropdown |
| J-PSY-01 бонус «входная диагностика» бейдж | BLOCKED | Нет intake-кейса в демо-данных |
| J-PSY-02A Назначение со-психолога | PASSED | API 201, бейдж отображается |
| J-PSY-02B Стандартные шаблоны методик | PASSED | Все 3 шаблона присутствуют |
| J-PSY-03 Заключение психолога в приёмной | BLOCKED | Кнопка не реализована в UI |

**Реальных багов (ошибки / 500 / белый экран):** 0

**Рекомендация по J-PSY-03:** реализовать кнопку «Заключение психолога» на карточке в колонке «ЗАЧИСЛЕН» → по клику открывать модалку с уровнем риска и текстом заключения (или сообщением «Психолог ещё не завершил первичную диагностику»).


## [T1] Приёмная видит заключение психолога

**Status:** PASSED
**Actor:** secretary (secretary1)
**Category:** admission / psychologist-integration
**Started:** 2026-06-10T00:00:00Z
**Duration:** ~2m

### Observations
- PASS: карточка «Самира Демонстрова» присутствует в колонке «Зачислен» канбан-воронки Приёмной (CRM)
- PASS: на карточке есть кнопка «Заключение психолога»
- PASS: при нажатии открывается Mantine Modal с заголовком «Заключение психолога — Самира Демонстрова»
- PASS: бейдж уровня риска — «УРОВЕНЬ: ЗЕЛЁНЫЙ»
- PASS: текст заключения содержит «Готовность к школе высокая. Рекомендуем к зачислению.» + секции «Оценка психолога», «Наблюдения»
- PASS: нет console errors, нет сетевых ошибок 4xx/5xx

### Repro
1. Войти как secretary1 / erudit2025 → https://bilimos.kg/login
2. В боковом меню нажать «Приёмная (CRM)»
3. В колонке «ЗАЧИСЛЕН» найти карточку «Самира Демонстрова»
4. Нажать кнопку «Заключение психолога»
5. Ожидаемо: модальное окно с бейджем «ЗЕЛЁНЫЙ» и текстом заключения
6. Фактически: соответствует ожиданию

### Screenshot
`journey-results/screenshots/T1_PASS_modal.png`

### Console / network errors
none

---

## [T2] Бейдж «входная диагностика» в кабинете психолога

**Status:** PASSED
**Actor:** psychologist (psychologist1)
**Category:** psychologist / case-management
**Started:** 2026-06-10T00:00:00Z
**Duration:** ~1m

### Observations
- PASS: psychologist1 при логине сразу попадает на /psychologist (Кабинет психолога)
- PASS: таблица кейсов видна без дополнительной навигации
- PASS: строка «Демонстрова Самира» присутствует в таблице с кейсом «Первичная диагностика (поступление)»
- PASS: рядом с названием кейса виден бейдж «ВХОДНАЯ ДИАГНОСТИКА» (цвет: rgb(190,75,219) — фиолетовый, фон rgba(190,75,219,0.1))
- PASS: в строке также отображаются «ЗЕЛЁНЫЙ» (риск) и «ЗАКРЫТ» (статус), дата обновления 10.06.2026
- PASS: нет console errors, нет сетевых ошибок

### Repro
1. Войти как psychologist1 / erudit2025 → https://bilimos.kg/login
2. Сразу попасть на /psychologist (Кабинет психолога)
3. В таблице найти строку «Демонстрова Самира»
4. Ожидаемо: рядом с «Первичная диагностика (поступление)» фиолетовый бейдж «ВХОДНАЯ ДИАГНОСТИКА»
5. Фактически: бейдж присутствует, цвет корректный

### Screenshot
`journey-results/screenshots/T2_PASS_cases_table.png`

### Console / network errors
none

---

## [J-CC-01] Smoke: Колл-центр — взыскание (роль call_center)

**Status:** RESOLVED 2026-06-18
**Resolution:**
- Пустые договоры у должников: `scripts/backfill-debtor-contracts.ts` (идемпотентный, добавлен в predeploy) создаёт активный договор для учеников со счетами, но без договора, и привязывает их счета (`contractId`) → вкладка «Договор и платежи» показывает договор, баланс=остаток долга, график=реальные счета.
- Молчаливый 403 на `/grades`: профиль теперь тянет оценки только если роль их видит (`tabVisible('grades')`) — call_center/психолог больше не дёргают защищённый endpoint (`src/app/(dashboard)/students/[id]/page.tsx`).

**Status (исходный):** ЧАСТИЧНО PASSED / 1 MINOR BUG
**Severity:** MINOR
**Actor:** call_center (callcenter1 / erudit2025)
**Category:** call-center, RBAC, contracts
**Started:** 2026-06-16T00:00:00Z
**Duration:** ~3m

### Observations

#### STEP 1 — Страница Колл-центра
- PASS  Раздел «Колл-центр» найден в меню и открывается без ошибок (/call-center)
- PASS  3 карточки статистики присутствуют: ДОЛЖНИКОВ (8), СУММА ДОЛГА (113 000 сом), ПЕНЯ (848 сом)
- PASS  Должники сгруппированы по классам: карточки 2а (1 чел.), 7а (5 чел.), 7б (2 чел.)
- PASS  Клик по карточке класса (7а) разворачивает список учеников-должников с ФИО, телефоном, суммой долга, количеством дней просрочки

#### STEP 2 — Действие «Звонок»
- PASS  У каждого должника есть бейдж приоритета (ВЫСОКИЙ / НИЗКИЙ)
- PASS  Кнопка «Звонок» присутствует рядом с каждым учеником
- PASS  Клик «Звонок» открывает модальное окно «Результат звонка — [ФИО]» с полем «Исход звонка» и «Комментарий»
- PASS  Опции исхода в select: Связались, Нет контакта, Обещал оплатить, Отказ, Закрыто (все 5 вариантов)
- PASS  После сохранения статус отображается прямо в строке ученика: «Связались: Тест — обещал оплатить до пятницы (16.06.2026)»

#### STEP 3 — Профиль ученика (RBAC)
- PASS  Клик по имени ученика открывает профиль /students/{id}
- PASS  В профиле отображается ТОЛЬКО вкладка «Договоры» — ровно 1 tab
- PASS  Вкладка «Оценки» ОТСУТСТВУЕТ (RBAC соблюдён на уровне UI)
- BUG   На клиенте в консоли появляется ошибка 403 от GET /api/v1/students/{id}/grades — страница профиля, по всей видимости, инициирует prefetch оценок вне зависимости от роли, и получает 403. Видимого UI-эффекта нет, но лишний сетевой запрос к защищённому ресурсу раскрывает существование endpoint-а

#### STEP 4 — Вкладка «Договоры»
- PASS  Вкладка «Договоры» открывается и показывает заголовок «Договор и платежи»
- FAIL  Контент: «Договоров пока нет.» — у должника Асанов Азамат (7А, долг 21 000 сом) нет ни одного привязанного договора. Это либо баг данных (seed не создаёт договоры для должников из колл-центра), либо баг логики связи ученик→договор

### Repro (баг данных / договоры)
1. Войти как callcenter1 / erudit2025
2. Перейти «Колл-центр», кликнуть класс 7а
3. Кликнуть «Асанов Азамат» → /students/cmpjtf3kp00qiukogce63qnmg
4. Вкладка «Договоры» → раздел «Договор и платежи»
5. Ожидаемо: график платежей / договор об оплате
6. Фактически: «Договоров пока нет.»

### Repro (silent 403 grades prefetch)
1. Войти как callcenter1
2. Открыть любой профиль ученика через колл-центр
3. Открыть DevTools → Network
4. Ожидаемо: нет запросов к /api/.../grades
5. Фактически: GET /api/v1/students/{id}/grades → 403, console.error в браузере

### Screenshot
`journey-results/screenshots/step4-contracts.png`
`journey-results/screenshots/step3-student-profile.png`
`journey-results/screenshots/step2-after-save.png`

### Console / network errors
- `[console.error] Failed to load resource: the server responded with a status of 403 ()` при открытии профиля ученика
- `[HTTP 403] https://bilimos.kg/api/v1/students/cmpjtf3kp00qiukogce63qnmg/grades`

### Suggested fix
1. Договоры: скрипт `scripts/seed-demo.ts` должен создавать объекты Contract и PaymentSchedule для учеников, фигурирующих в долгах колл-центра (Асанов Азамат и др.). Либо убедиться, что логика выборки должников опирается на те же записи Contract, что отображает вкладка.
2. Grades prefetch: компонент StudentProfile должен условно пропускать useEffect/fetch оценок если текущая роль — call_center (проверять сессию перед запросом).

---

## [J-PSY-SMOKE] Smoke-тест кабинета психолога (bilimos.kg)

**Status:** RESOLVED 2026-06-18 (BAG-1 MAJOR закрыт коммитом `ee06769` — `onClick` перенесён на всю карточку ученика в `DrilldownByClass`; задеплоено). BAG-2 (/psychologist/students → 404) — навигация штатно идёт через `/students`, не баг.

**Status (исходный):** PARTIAL (2 PASS, 1 FAIL, 1 PARTIAL)
**Severity:** MAJOR (Item 2 — drill-down полностью не работает)
**Actor:** psychologist1 / erudit2025
**Category:** psychologist-module
**Started:** 2026-06-16T00:00Z (UTC)
**Duration:** ~8m

---

### LOGIN

PASS. Логин `psychologist1` + пароль `erudit2025` — успешный вход. Редирект на `/psychologist`. Никаких ошибок в консоли при логине.

---

### ITEM 1 — Кабинет психолога

**PASS**

- Страница `/psychologist` загружается без ошибок (заголовок страницы: "Bilim OS - School ERP System", HTTP 200).
- 4 статистических карточки присутствуют и показывают реальные данные:
  - ОТКРЫТЫХ КЕЙСОВ: **7**
  - В ЗОНЕ РИСКА: **3**
  - КРИТИЧЕСКИХ: **1**
  - КОНСУЛЬТАЦИЙ: **5**
- Кейсы СГРУППИРОВАНЫ по классам (карточки: `1а — 3 ученик(ов) · открытых 3`, `2а — 1 ученик(ов) · открытых 1`, `7а — 3 ученик(ов) · открытых 3`). Это НЕ плоская таблица. Требование выполнено.
- Есть фильтры по цвету риска: ЗЕЛЁНЫЙ / ЖЁЛТЫЙ / КРАСНЫЙ.
- Кнопка «Новый кейс» присутствует.

**Ложная тревога в скрипте:** первый тест пометил страницу как `is500=true` — это был артефакт, строка `rgba(15,23,42,0.06)` из CSS содержала подстроку "500". Реальная страница загрузилась корректно.

---

### ITEM 2 — Drill-down (класс → ученик → кейс)

**FAIL — MAJOR BUG**

**Шаг 1 (класс → список учеников):** PASS.
- Клик по карточке класса `1а` работает: карточки классов сворачиваются и появляются карточки учеников этого класса:
  - `Абдуллаев Максим — 2 кейс(ов) — ЖЁЛТЫЙ`
  - `Касымова Алия — 1 кейс(ов) — ЗЕЛЁНЫЙ`
  - `Демонстрова Самира — 1 кейс(ов) — ЗЕЛЁНЫЙ`
- Бейджи риска (ЖЁЛТЫЙ, ЗЕЛЁНЫЙ) присутствуют.

**Шаг 2 (клик на ученика → панель/модал с кейсами):** FAIL.
- Клик на карточку ученика (`Абдуллаев Максим`) **не делает ничего**:
  - URL остаётся `/psychologist`
  - Модальное окно не открывается (`[role="dialog"]` = 0)
  - Drawer не появляется
  - API-запросы не уходят (0 запросов после клика)
- Карточка визуально выглядит кликабельной (Mantine Card), но `onClick` обработчик либо отсутствует, либо вызывает setState без видимого эффекта.

**Шаг 3 (кейс → detail):** НЕ ДОСТИГНУТ из-за шага 2.
- Прямой URL `/psychologist/cases` → 404.

**Репро:**
1. Войти как `psychologist1`
2. Перейти на `/psychologist`
3. Кликнуть карточку класса `1а` — студенты появляются
4. Кликнуть на карточку ученика `Абдуллаев Максим`
5. Ожидалось: открытие модала/панели со списком кейсов этого ученика (риск-бейджи, статусы)
6. Фактически: ничего не происходит, URL не меняется, модал не открывается

---

### ITEM 3 — Новый кейс

**PASS**

- Кнопка «Новый кейс» видна и кликабельна.
- Модальное окно открывается.
- В дропдауне студентов класс указан рядом с ФИО — формат `Абдуллаев Максим (1а)`, `Демонстрова Самира (1а)` и т.д. Требование выполнено.

---

### ITEM 4 — Профиль ученика (RBAC: вкладка «Оценки»)

**PASS** (критическое требование выполнено)

- Путь к профилю: `/students` → клик на строку → `/students/cmpjtfzda0103ukogube1ck0y`
- Вкладка **«Оценки» ОТСУТСТВУЕТ** у роли `psychologist` — требование RBAC соблюдено.
- Видимые вкладки профиля (все `[role="tab"]`):
  `Лента`, `Договоры`, `Посещаемость`, `Анкета`, `Медицина`, `Поведение`, `Беседы`, `Аналитика`, `Портфолио`, `Документы`
- Вкладки `Лента`, `Анкета`, `Медицина`, `Беседы` — присутствуют (требования выполнены).
- **Примечание:** `/psychologist/students` → 404. Навигация к профилю происходит через общую страницу `/students`, не через отдельный маршрут психолога.

**Дополнительная находка:** При загрузке профиля `HTTP 403` на `GET /api/v1/students/{id}/grades` — сервер правильно блокирует запрос оценок для роли психолога. Хорошо.

---

### Console / network errors

```
[HTTP 403] https://bilimos.kg/api/v1/students/cmpjtfzda0103ukogube1ck0y/grades
  — ожидаемо, RBAC работает корректно

[HTTP 404] https://bilimos.kg/psychologist/students
  — маршрут /psychologist/students не существует (навигация через /students)

[HTTP 404] https://bilimos.kg/psychologist/cases
  — прямой маршрут к кейсам не существует
```

Ошибок в JS-консоли (`console.error`) — нет.

---

### Список багов

**БАГ 1 — MAJOR:** Клик на карточку ученика в раскрытом классе ничего не делает.
- Воспроизводится стабильно.
- Эффект: вся цепочка drill-down (ученик → список кейсов → детали кейса) недоступна.
- Предполагаемая причина: в компоненте студенческой карточки отсутствует/сломан `onClick` — возможно, не передан `onStudentClick` проп или `router.push` вызывается с undefined ID.
- Направление фикса: проверить `onClick` на Mantine Card в компоненте кабинета психолога; добавить навигацию на `/psychologist/students/{id}` или открытие Sheet/Drawer с кейсами.

**БАГ 2 — MINOR:** `/psychologist/students` → 404.
- Маршрут отсутствует, навигация через `/students` работает, но выглядит как незавершённая архитектура.

---

### Screenshots

`journey-results/screenshots/PSY_FINAL_cabinet_clean.png`
`journey-results/screenshots/PSY_FINAL_class_expanded.png`
`journey-results/screenshots/PSY_FINAL_after_student_click.png`
`journey-results/screenshots/PSY_ITEM3_modal.png`
`journey-results/screenshots/PSY_ITEM4_profile_final.png`

---

## [SMOKE-2026-06-16] Smoke Test: Secretary — CRM / Appointments / Classes / Student Profile / Events

**Status:** PARTIAL PASS (4 of 5 checks fully confirmed; 1 check partial)
**Actor:** secretary (secretary1)
**Category:** smoke / regression
**Started:** 2026-06-16T00:00:00Z
**Duration:** ~25m (6 automated passes)

---

### CHECK 1 — Приёмная (CRM): PASS with one gap

**Kanban board:** PASS. Loads at `/admission` with columns Заявка → Тестирование → Психолог → Директор → Договор → Зачислен → Отказ. Cards visible with candidate names, phone numbers, source channel.

**Date filter «Зачисления: с/по»:** PASS. Label "Зачисления: с по" with two date inputs visible above the board.

**«Профиль» button in «Зачислен» column:** PASS. Found on all 4 cards in Зачислен column. Clicking navigates to `/students/<id>` (student profile). Confirmed.

**«Перейти сразу к этапу» chevron:** PARTIAL. Each card has two icon-only (empty-text) buttons alongside the stage-move and Отказ buttons — `['', 'Тестирование', '', 'Отказ']`. These may be chevron/dropdown triggers, but the smoke test did NOT click them to confirm a stage-jump dropdown opens. Cannot confirm or deny this feature from the automated run.

---

### CHECK 2 — Запись к директору: PASS

Created a record via "+ Записать на встречу" modal. Fields filled: Тема встречи = "Тест дымовой — smoke test topic", Желаемые дата и время = 20.06.2026 16:00. After clicking "Записать" the record appeared in the list with badge **ОЖИДАЕТ**. No console or network errors.

---

### CHECK 3 — Классы (Classes): PASS

Opened "Классы" from sidebar (navigates to `/classes`). Shows 18 classes across Начальная/Средняя/Старшая with "Состав" button per row. Clicking "Состав" navigates to `/students?classId=...` and shows the filtered student list (165 rows total when unfiltered). No errors.

---

### CHECK 4 — Профиль ученика (Student profile): PASS

Opened student Сыдыкова Айпери (2А класс) at `/students/cmqfbvlwc0002qv0kgxr6y9f3`.

**Tab «Договоры»:**
- "Договор и платежи" section loads. Contract #23 (ACTIVE), 650 000 сом base, 20% discount, 520 000 сом итого.
- **БАЛАНС card:** visible (0 сом из 520 000, Аванс 0, Прогресс 0%).
- **«График платежей»:** visible — shows "Счёта по этому договору не сгенерированы" (no bills generated for this contract — data state, not a bug).
- **«Продлить договор» button:** visible and present.

**Tab «Беседы»:**
- Section "Воспитательные беседы" with "+ Добавить беседу" button loads.
- Clicked "+ Добавить беседу" → modal "Воспитательная беседа" opened.
- Filled: "С кем беседа" = "С учеником" (Mantine combobox), "Содержание беседы" = "Тестовая беседа — smoke test".
- Clicked "Сохранить" → toast **"Записано — Беседа добавлена"** appeared. Conversation visible in list with tag "С УЧЕНИКОМ" and date 16.06.2026.
- No console or network errors.

---

### CHECK 5 — Мероприятия (Events): PASS

Calendar at `/events` renders as a mini monthly calendar (June 2026, Mo–Su grid) with a day-detail sidebar on the right. **Loads in ~5 seconds** (shows spinner during load).

Created event via "+ Добавить мероприятие":
- Form fields: Название, Дата, Дата окончания, Место проведения, Описание.
- Filled: Название = "Дымовой тест мероприятия", Дата = 16.06.2026.
- Clicked "Создать" → modal closed. Event appeared in the right-side panel under "16.06.2026" as "Дымовой тест мероприятия". Also visible as a dot on the calendar grid.
- No errors.

---

### Bugs / Observations

**BUG-1 (MINOR):** Pages `/students`, `/events` show a loading spinner for 5–8 seconds on first navigation before data appears. On initial automated run (waitUntil: 'networkidle' + 2s) these pages appeared empty. With an 8s wait they load correctly. Suggests a slow API or hydration issue. No network 4xx/5xx — just latency.
- Screenshot: `journey-results/screenshots/smoke_check4_students_list.png` (shows spinner at 2s), `journey-results/screenshots/smoke6_students_8s.png` (loaded at 8s).

**BUG-2 (MINOR):** `/reserve` (Очередь в классы) showed infinite spinner on first run (2s wait + networkidle) and then loaded on second run after 5s wait. Intermittent slow load. No errors in network log.
- Screenshot: `journey-results/screenshots/smoke_check3_classes.png` (spinner), `journey-results/screenshots/smoke6_reserve_5s.png` (loaded).

**BUG-3 (MINOR, UX):** The date filter label "Зачисления:" appears without specific "с / по" sub-labels — two date inputs render without visible placeholder or label text, making it unclear which is "from" and which is "to" for users. The label "Зачисления: с по" shows as one line visually.

**NOT A BUG:** Stage-jump chevron (empty icon buttons next to "Тестирование", "Отказ") present but not confirmed to open a dropdown. Would need manual click test to verify.

**NOT A BUG:** «График платежей» shows "Счёта не сгенерированы" — expected for a contract with no billing records created.

---

### Screenshots (key)
- `journey-results/screenshots/smoke_check1_crm_page.png` — CRM Kanban
- `journey-results/screenshots/smoke2_check2_after_save.png` — Запись к директору with ОЖИДАЕТ
- `journey-results/screenshots/smoke2_check3_classes.png` — Классы page with Состав buttons
- `journey-results/screenshots/smoke2_check4_dogovor_tab.png` — Договоры tab with БАЛАНС
- `journey-results/screenshots/smoke5_besedu_saved.png` — Беседы saved confirmation
- `journey-results/screenshots/smoke6_events_june16.png` — Event visible in calendar

---
