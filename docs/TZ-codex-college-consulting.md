# Codex-спека: Модуль «College Consulting» (CC)

**Lead-архитектор:** Claude (Opus) · **Исполнитель:** Codex · **Ревью:** codex-reviewer (Sonnet)
**Источник:** 3 ТЗ Эмира (базовое + бизнес-логика/сущности + User Journey) + макет карточки.
**Правила проекта:** реюз ядра, простейшее решение, хирургические правки, `--webpack` для dev (кириллица в пути). Next.js 16 модифицированный — сверяйся с реальным кодом, не с памятью.

---

## 0. КАРТА ПЕРЕИСПОЛЬЗОВАНИЯ (НЕ ДУБЛИРОВАТЬ)

| Нужно | Берём готовое (файл) |
|---|---|
| Ученик (ФИО/фото/класс/контакты) | `Student` `prisma/schema.prisma:204`; родители `ParentStudent:264`; классрук `Class.curatorId` |
| Учителя класса (для рекомендаций) | `TeacherSubject.classId` (`schema:302`) + `Class.curatorId`; инверсия: `teacherSubject.findMany({where:{classId}})` |
| GPA динамический | `calculateWeightedAverage` в `src/modules/grading/services/weighted-average.ts:7`; **НЕ хранить колонку** |
| CRUD-роуты | `createCrud`/`createCrudId` в `src/shared/lib/crud.ts:47,115` |
| Таблица+модалка UI | `ResourcePage` `src/shared/components/ui/ResourcePage.tsx:107` |
| Auth в роутах | `withAuth(request,{roles})` `src/shared/lib/api-auth.ts:31`; ответы `successResponse/errorResponse` `src/shared/lib/api-response.ts` |
| Клиентский гейт | `<RoleGate roles={...}>` `src/shared/components/auth/RoleGate.tsx:20`; хук `useRole()` |
| Меню/сайдбар | `SIDEBAR_NAV` в `src/shared/lib/nav-config.ts:64`; хелпер `grp()` :54 |
| Роли-реестр | Prisma enum `Role` `schema:62`; `src/shared/constants/roles.ts` (`ALL_ROLES:10`, `ROLE_LABELS:41`); `src/shared/lib/ai/scope.ts:35` |
| Задачи (core.tasks) | `AgentItem` `schema:1942`; `createItem({forUserId,forRole,kind:'task',severity:'urgent',...})` в `src/shared/lib/agent/engine.ts:34` |
| Событие→действие | `emitEvent(type,ctx)` `engine.ts:214`; диспетчер `processEvent` :198 (добавить ветку) |
| Cron (deadline engine) | клон `src/app/api/cron/reminders/route.ts`; регистрация в `vercel.json` (`CRON_SECRET`-гейт) |
| Обезличивание для LLM | `createMaskSession().maskOut()` + fail-closed `residualPiiRisk()`+`aiStrictPrivacy()` — см. `src/shared/lib/ai/privacy-guard.ts` и `assistant.ts:170-181` |
| Push | `sendWebPush(userId,title,body,url)` `src/shared/lib/agent/webpush.ts:22`; мультиканал `notifyUser` `notify.ts:14`; роль-бродкаст: `events/route.ts:45-50` |
| Канбан DnD | клон `MediaKanban` в `src/app/(dashboard)/media/page.tsx:123` (нативный HTML5 DnD, оптимистичная мутация :138) |
| Ветвь-скоуп | `branchScope` в `createCrud`; `branch-scope.ts` |

---

## 1. ДОСТУП (RBAC)

- Новый роль **`college_counselor`** (lowercase snake_case).
- Данные CC **конфиденциальны**: полный доступ только `college_counselor` + `super_admin`.
  Директор/`founder` — **только read** дашборд-отчёт (агрегаты, без матрицы конфликтов и черновиков эссе).
  Учителя — видят ТОЛЬКО задачу «запрос рекомендации» в своей панели (через AgentItem), не карточки CC.
- НЕ использовать `ROLE_INHERITS` для CC (это не завуч-ветка) — гейтить явными списками ролей в `withAuth`.

---

## 2. МОДЕЛЬ ДАННЫХ (schema.prisma — добавить в конец, стиль как у соседей)

### Энумы
```prisma
enum CcConflictStatus { green yellow red }              // матрица Цели vs Ожидания
enum CcExamType { sat ielts toefl ort csca opt }
enum CcApplicationType { early_action early_decision regular_decision }
enum CcAdmissionStatus { scouting document_prep submitted decision_pending offer_received rejected accepted_final }
enum CcDocType { personal_statement essay cv brag_sheet recommendation portfolio transcript passport other }
enum CcDocStatus { not_started draft in_review ready received }   // received = получено от педагога
```
Роль: отдельной миграцией `ALTER TYPE "Role" ADD VALUE 'college_counselor';` (Postgres — 1 значение/стейтмент).

### Модели
```prisma
model CcProfile {
  id                String   @id @default(cuid())
  studentId         String   @unique
  student           Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  counselorId       String?  // User.id консультанта (владелец)
  branchId          String?

  // Блок ученика (Цель)
  studentCountries  String[] // мультиселект стран
  studentMajor      String?
  studentMotivation String?  @db.Text

  // Блок родителей (Ожидания)
  parentCountries   String[]
  parentBudgetUsd   Int?
  parentMajor       String?
  parentSafety      Boolean  @default(false) // критичность локации/безопасности
  parentExpectations String? @db.Text

  // Матрица
  conflictStatus    CcConflictStatus @default(green)
  conflictComputedAt DateTime?
  riskFlagCleared   Boolean  @default(false) // ручное снятие RED-блока
  counselorComment  String?  @db.Text        // оценка реалистичности + next step
  strategyAssigned  Boolean  @default(false) // для фильтра "без стратегии"

  exams        CcExam[]
  applications CcApplication[]
  documents    CcDocument[]
  meetings     CcMeeting[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([counselorId])
  @@index([conflictStatus])
  @@index([branchId])
}

model CcExam {
  id           String   @id @default(cuid())
  profileId    String
  profile      CcProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  examType     CcExamType
  testDate     DateTime?
  scoreCurrent Float?
  scoreTarget  Float?
  isMock       Boolean  @default(false)   // пробный тест → отдельная история/график
  verified     Boolean  @default(false)   // финальный сертификат загружен
  certificateUrl String?
  comment      String?
  createdAt DateTime @default(now())
  @@index([profileId])
}

model CcApplication {
  id              String   @id @default(cuid())
  profileId       String
  profile         CcProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  universityName  String
  country         String?
  program         String?
  applicationType CcApplicationType?
  admissionStatus CcAdmissionStatus @default(scouting)
  deadlineDate    DateTime?          // критическое поле
  decisionDate    DateTime?
  applicationId   String?            // обязательно при submitted (валид. в PATCH)
  submissionProof String?
  scholarshipAmount String?          // разблок. при offer_received
  scholarshipType String?
  comment         String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([profileId])
  @@index([admissionStatus])
  @@index([deadlineDate])
}

model CcDocument {
  id         String   @id @default(cuid())
  profileId  String
  profile    CcProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  docType    CcDocType
  status     CcDocStatus @default(not_started)
  fileUrl    String?
  teacherId  String?   // для recommendation — Teacher.id
  requestedDeadline DateTime?
  receivedAt DateTime?
  requiredCount Int?   // для рекомендаций: "нужно X штук"
  comment    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([profileId])
}

model CcMeeting {
  id          String   @id @default(cuid())
  profileId   String
  profile     CcProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  counselorId String?
  meetingDate DateTime @default(now())
  topic       String?
  notes       String?  @db.Text
  actionItems String?  @db.Text
  format      String?  // онлайн/офис
  createdAt DateTime @default(now())
  @@index([profileId])
}
```
Добавить обратную связь `ccProfile CcProfile?` в модель `Student`.

---

## 3. КОНФЛИКТ-ДВИЖОК (сервер, чистая функция)

`src/modules/cc/services/conflict.ts` — `computeConflict(profile): CcConflictStatus`:
- **green**: массивы `studentCountries` ∩ `parentCountries` ≠ ∅ И (бюджет не задан ИЛИ бюджета достаточно — упрощённо: `parentBudgetUsd == null || parentBudgetUsd > 0`).
- **yellow**: страны различаются, НО `studentMajor == parentMajor`; ИЛИ бюджет «на грани».
- **red**: страны различаются И специальности различаются; ИЛИ `parentBudgetUsd === 0` при непустых целях.
Вызывать при создании/апдейте профиля → писать `conflictStatus` + `conflictComputedAt`. При `red` и `!riskFlagCleared` — профиль в «Зоне риска», блок перехода заявок в `submitted` (валидация в PATCH заявки).

---

## СЛАЙС 1 (этот заход): ФУНДАМЕНТ
1. schema.prisma: 6 энумов + 5 моделей + обратная связь в Student.
2. Отдельная миграция роли `college_counselor` (или через `prisma db push` на dev — но подготовь SQL-миграцию в `prisma/migrations`).
3. `src/shared/constants/roles.ts`: `college_counselor` в `ALL_ROLES` + `ROLE_LABELS` («Колледж-консультант»).
4. `src/shared/lib/ai/scope.ts`: лейбл роли (если там Record — добавить, чтобы компилировалось).
5. `conflict.ts` сервис (чистая функция + тесты-примеры из ТЗ в комментарии).
6. `npx tsc --noEmit` зелёный, `npx prisma validate` зелёный.

**Стоп после Слайса 1** — Claude ревьюит, потом Слайс 2 (API+карточка+список+канбан) и Слайс 3 (cron+событие рекомендации+дашборд директора+обезличивание+push).

СЛАЙС 1 ГОТОВ И ПРИНЯТ (schema+роль+миграции+conflict.ts, tsc+validate зелёные).

---

## СЛАЙС 2: API + UI (Этап 1 ТЗ «обязательно»)

Всё под `college_counselor` + `super_admin` (гейт явными списками в `withAuth` и `<RoleGate>`). Роль `founder`/директор — НЕ в Слайсе 2 (его read-отчёт в Слайсе 3).

### 2.1 GPA-хелпер (реюз)
`src/modules/cc/services/gpa.ts` — `getOverallGpa(studentId): Promise<number|null>`: собери опубликованные (не draft) `Grade` ученика с весами категорий, вызови `calculateWeightedAverage` из `src/modules/grading/services/weighted-average.ts`. Вернуть общий взвешенный средний по 5-балльной (как в `students/[id]/grades`). Не хранить.

### 2.2 API-роуты (`src/app/api/v1/cc/...`)
Константа ролей: `const CC_ROLES = ['college_counselor','super_admin'] as const` (локально или в `src/modules/cc/roles.ts`).

- **`cc/profiles/route.ts`** — GET список + POST создать.
  - GET: bespoke (НЕ createCrud, т.к. нужны вычисляемые поля). Верни для каждого профиля быстрые поля из ТЗ §3-списка: `{id, studentId, fio, className, conflictStatus, gpa (getOverallGpa), nearestDeadline (min deadlineDate по applications со статусом != accepted_final/rejected), lastContact (max meetingDate), nextStep (последний actionItems или ближайшая задача), applicationsCount, strategyAssigned}`. Фильтры (query): `className`, `country` (по applications.country), `conflictStatus`, `strategyAssigned` (для «10 класс — без стратегии»), `search` (ФИО). Ветвь-скоуп: фильтруй по `branchId` пользователя (см. `branch-scope.ts`), кроме super_admin.
  - POST: создать `CcProfile` по `studentId` (uniq). Если профиль на этого ученика уже есть — 409. `counselorId` = текущий user. Наследование ФИО/класса/родителей — через relation к `Student` (ничего не копировать).
- **`cc/profiles/[id]/route.ts`** — GET карточка-агрегат + PUT обновить цели/ожидания.
  - GET: верни профиль + `student` (ФИО, фото, класс, dateOfBirth, родители через parentLinks), `gpa`, `exams` (сорт по testDate), `applications` (сорт по deadlineDate), `documents`, `meetings` (сорт desc, лимит для правой колонки), и вычисленный список ближайших дедлайнов (из applications + exams.testDate). Плюс лучший балл SAT/IELTS для плиток (последний verified или max scoreCurrent по типу).
  - PUT: обнови блоки цели ученика/ожидания родителей/counselorComment/strategyAssigned; ПЕРЕСЧИТАЙ `conflictStatus` через `computeConflict` (передай нормализованные поля) и запиши `conflictComputedAt`.
- **`cc/exams/route.ts`** (`createCrud`, model `ccExam`, createFields: examType,testDate,scoreCurrent,scoreTarget,isMock,verified,certificateUrl,comment,profileId; dateFields:[testDate]; intFields:[]; filterableParams:[profileId,examType]; writeRoles/listRoles=CC_ROLES) + **`[id]/route.ts`** (`createCrudId`, PUT/DELETE).
- **`cc/applications/route.ts`** (`createCrud`, model `ccApplication`, createFields: universityName,country,program,applicationType,admissionStatus,deadlineDate,comment,profileId; dateFields:[deadlineDate]; filterableParams:[profileId,admissionStatus]; roles=CC_ROLES) + **`[id]/route.ts`** — bespoke **PATCH** для канбана (как `media-requests/[id]`):
  - валидируй `admissionStatus` против enum;
  - **при переходе в `submitted`** требуй непустой `applicationId` ИЛИ `submissionProof` → иначе 400;
  - **блок в `submitted`/дальше**, если у профиля `conflictStatus==='red' && !riskFlagCleared` → 409 «снимите RED-флаг»;
  - при `offer_received` — разрешить запись `scholarshipAmount/scholarshipType`, `decisionDate`.
  - Плюс PUT (общий апдейт) + DELETE через `createCrudId` в том же файле, либо один bespoke handler.
- **`cc/documents/route.ts`** (`createCrud`, createFields: docType,status,fileUrl,teacherId,requestedDeadline,requiredCount,comment,profileId; dateFields:[requestedDeadline]; roles=CC_ROLES) + `[id]` (PUT/DELETE).
- **`cc/meetings/route.ts`** (`createCrud`, createFields: meetingDate,topic,notes,actionItems,format,profileId; dateFields:[meetingDate]; injectUserId:'counselorId'; roles=CC_ROLES) + `[id]` (DELETE).

### 2.3 Страницы (`src/app/(dashboard)/cc/`)
Обернуть КАЖДУЮ страницу в `<RoleGate roles={[...CC_ROLES]}>`. Mantine + react-query как в проекте.

- **`cc/page.tsx` — Рабочий стол «Светофор»**: таблица учеников из `cc/profiles`. Колонки: ФИО, класс, цель (studentMajor+страны), GPA, ближайший дедлайн (с бейджем «N дней», красный ≤7), последний контакт, следующий шаг, индикатор конфликта (кружок green/yellow/red). Сортировка по умолчанию: red-профили сверху, затем по близости дедлайна. Фильтры-контролы: класс, страна, статус конфликта, «без стратегии». Кнопка «+ Добавить ученика» (выбор из Student без CcProfile → POST). Блок «Зона риска» сверху: профили с `conflictStatus==='red' && !riskFlagCleared`. Клик по строке → `/cc/[id]`.
- **`cc/[id]/page.tsx` — Карточка ученика (ПО МАКЕТУ-РЕФЕРЕНСУ, файл cc_img.jpeg)**. Раскладка:
  - Шапка: аватар (`student.photo` или инициалы), «Имя Фамилия — N класс», строка «ID · Дата рождения», кнопка «Редактировать профиль» (открывает модалку целей/ожиданий → PUT).
  - Ряд из 5 плиток-статов: **GPA** (x/5), **SAT** (лучший балл), **IELTS** (лучший балл), **Заявки** (кол-во), **Дедлайны** (кол-во ближайших ≤30 дн). Иконка+подпись как в макете.
  - 3 колонки:
    - **Лево**: «1. Цель ученика» (страны+major+мотивация), «3. Академические результаты» (таблица: GPA, SAT, IELTS, пробные тесты, школьные оценки), «5. Статус поступления» (таблица Университет｜Страна(флаг)｜Программа｜Статус-бейдж; строки из applications; кнопка «+ Вуз»; тумблер «Таблица｜Канбан» → рендерит per-student канбан воронки).
    - **Центр**: «2. Ожидания родителей» (страны+бюджет+безопасность), «4. Документы» (список docType со статус-бейджем Готово/В работе/…; кнопка загрузить/сменить статус).
    - **Право**: «7. Ближайшие дедлайны» (дата｜вуз｜тип｜бейдж дней), «6. Журнал встреч» (дата｜тема｜формат｜инициалы; кнопка «+ встреча»).
  - При `conflictStatus` yellow/red — индикатор у шапки; клик → модалка с журналом встреч (контекст для медиации). При red — плашка «Зона риска» + кнопка «Снять флаг» (PUT `riskFlagCleared=true`).
- **Канбан воронки** (`src/app/(dashboard)/cc/CcPipelineKanban.tsx`): клон структуры `MediaKanban` (`media/page.tsx:123`). Колонки = стадии `CcAdmissionStatus` в порядке: scouting → document_prep → submitted → decision_pending → offer_received/rejected → accepted_final. Карточка = вуз (universityName, country-флаг, program, дедлайн-бейдж). Нативный HTML5 DnD, оптимистичная мутация → PATCH `cc/applications/[id]`. Ошибка PATCH (RED-блок/нет applicationId) → откат + красное уведомление с текстом ошибки. `canManage` = `useRole().has('college_counselor','super_admin')`.
  - Валидация дат-инпутов дедлайнов: запрет прошедших дат и дат вне текущего учебного года (ТЗ доп. §3).

### 2.4 Навигация
`src/shared/lib/nav-config.ts`: добавить раздел/пункт для CC. Секция «Поступление за рубеж» с пунктом `/cc` (label «Колледж-консалтинг»), `roles: ['college_counselor','super_admin']`. Разместить логично (напр. рядом с «Жизнь школы» или отдельной секцией). Убедиться что `filterNavByRole` показывает его только этим ролям.

### 2.5 Готово-критерий Слайса 2
`npx tsc --noEmit` зелёный. Роль `college_counselor` видит `/cc` и карточку; другие роли — «Доступ ограничен». Канбан двигает статусы оптимистично с откатом. Матрица пересчитывает конфликт на сохранении. GPA тянется из журнала (не хранится). Перечисли созданные файлы + подтверди tsc.

**Стоп после Слайса 2** — Claude ревьюит вживую (dev `--webpack` или прод), потом Слайс 3.

СЛАЙС 2 ГОТОВ И ПРИНЯТ (12 API-роутов + карточка + Светофор + канбан + навигация; закрыты утечки createCrudId.GET, добавлен ветвь-скоуп через relation, admissionStatus убран из createFields; tsc зелёный).

---

## СЛАЙС 3: Проактивный агент + отчёты + кросс-домен (Этап 2 ТЗ «желательно»)

### 3.1 Zero-Miss Deadline Engine (cron)
`src/app/api/cron/cc-deadlines/route.ts` — клон `src/app/api/cron/reminders/route.ts` (тот же `CRON_SECRET`-гейт). Логика:
- Найди `CcApplication` где `admissionStatus IN (scouting, document_prep)` И `deadlineDate` в пределах 14 дней от сегодня.
- Для каждой: `createItem({ forUserId: profile.counselorId, kind:'task', severity:'urgent', title:'Критический дедлайн: подача в {universityName}', body:..., payload:{ applicationId } })` (из `agent/engine.ts`) — это создаёт задачу + сам шлёт push через notify.
- Доп: если до дедлайна ≤5 дней И у профиля есть документ `docType:essay|personal_statement` со `status:not_started` → продублируй алерт директору (роль-бродкаст на `founder`/`super_admin` через паттерн `events/route.ts:45-50` `sendWebPush`), блок «Академические риски».
- Идемпотентность: не плодить дубли задач за один день (проверяй существующий открытый AgentItem по payload.applicationId, как это делают соседние крон-джобы; если такого механизма нет — фильтруй по title+forUserId+status:new).
- Регистрируй путь в `vercel.json` (`"schedule": "0 8 * * *"`).

### 3.2 Событие «запрос рекомендации» → задача учителю (кросс-домен)
- В `agent/engine.ts`: добавь ветку в `processEvent` для типа `cc.recommendation.requested` → `createItem({ forUserId: teacherUserId, kind:'task', severity:'urgent', title:'Запрос рекомендации для {студент}', body:'дедлайн {date}', payload:{ documentId } })`.
- Эмит: в `cc/documents/route.ts` POST (или отдельный action-роут `cc/documents/[id]/request/route.ts`), когда создаётся/помечается документ `docType:recommendation` с `teacherId` и `requestedDeadline` — резолвни `teacher.userId` по `teacherId` и вызови `emitEvent('cc.recommendation.requested', { ... })`. Учитель загружает готовый файл в своём интерфейсе задач (панель AgentItem уже существует) → статус документа переводится в `received`. Полный UI загрузки учителем — минимально: задача с дип-линком; апдейт статуса делает CC-консультант вручную при получении (Этап 3 — полный обмен файлами).

### 3.3 Read-отчёт для директора/учредителя
`src/app/(dashboard)/cc/reports/page.tsx` + `src/app/api/v1/cc/reports/route.ts` (GET, roles: `['founder','super_admin','college_counselor']`). Агрегаты (без матрицы конфликтов и черновиков — только сводка):
- Кол-во учеников по стадиям воронки (группировка `CcApplication.admissionStatus` или по «общему статусу» профиля).
- Ближайшие дедлайны (топ по `deadlineDate`).
- Ученики с рисками: низкий GPA (getOverallGpa < порога, напр. <3.0/5), нет цели (`studentCountries` пусто), нет контакта (нет meetings), просроченные дедлайны, нет экзаменов.
- Отчёт по классам: сколько определились со страной/направлением/экзаменами/вузами.
- Итог поступления: % с `accepted_final`, сумма стипендий.
Навигация: добавь `/cc/reports` (label «CC: отчёт») для `['founder','super_admin','college_counselor']` в `nav-config.ts` (в ту же секцию «Поступление за рубеж» либо в «Администрирование»).

### 3.4 Push RED-конфликта
В `cc/profiles/[id]/route.ts` PUT: если пересчёт дал `conflictStatus` переход в `red` (было не-red → стало red) И `!riskFlagCleared` — `sendWebPush(counselorId, 'Критический конфликт целей', '{студент}: цель ученика и родителей расходятся', '/cc/{id}')`. Не спамить: слать только при смене на red.

### 3.5 Демо-сид (для показа Эмиру)
Расширь существующий демо-сид (`scripts/seed-demo.ts` — идемпотентный, пароль `erudit2025`): добавь демо-аккаунт роли `college_counselor` (логин напр. `counselor`) + 2-3 демо-`CcProfile` на существующих демо-учеников с примерными exams/applications/documents/meetings (в т.ч. один red-конфликт для «Зоны риска», один с близким дедлайном). Чтобы `/cc` и карточка были наглядны сразу. Идемпотентно (upsert).

### 3.6 Готово-критерий Слайса 3
`npx.cmd tsc --noEmit` зелёный. Крон-роут отвечает на GET с секретом и создаёт задачи. Запрос рекомендации порождает AgentItem учителю. `/cc/reports` доступен директору read-only. Демо-сид создаёт counselor+профили. Перечисли файлы + подтверди tsc.

**Стоп после Слайса 3** — Claude финальный ревью + живая проверка + коммит + деплой (`git push erudit main` + триггер Coolify).
