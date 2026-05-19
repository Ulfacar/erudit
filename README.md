# ERUDIT — School ERP

Веб-приложение для управления школой (Бишкек, Кыргызстан). Включает 9 ролей пользователей, систему оценивания с 26 категориями и модерацией, расписание уроков с заменами, классные журналы, отчёты, поведение, новости и чаты.

**Стек:** Next.js 16 · React 19 · TypeScript · Mantine 7 · Prisma · PostgreSQL · NextAuth.js · TanStack Query · Zustand

---

## Содержание

- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Быстрый старт (локально)](#быстрый-старт-локально)
- [Переменные окружения](#переменные-окружения)
- [База данных](#база-данных)
- [Демо-аккаунты](#демо-аккаунты)
- [Скрипты npm](#скрипты-npm)
- [Развёртывание в продакшн](#развёртывание-в-продакшн)
- [Резервное копирование](#резервное-копирование)
- [Структура проекта](#структура-проекта)
- [Безопасность](#безопасность)

---

## Возможности

- **9 ролей:** super_admin, analyst, zavuch, secretary, teacher, curator, specialist, student, parent
- **4-звёздная система доступа** к данным (starLevel 1–4)
- **Оценивание:** 26 категорий с весами, шкалы 5/12/100/буквенная, модерация работ (контрольные/зачёты/триместровые/итоговые/экзамены), аудит изменений
- **Расписание:** гибкие звонки, привязка к классам и учителям, обнаружение конфликтов, замены
- **Перевод нагрузки** между учителями (декрет/болезнь/увольнение) с историей
- **Группы внутри класса:** перевод студентов между группами с подтверждением
- **Поведенческие инциденты** с модерацией
- **Срочные вопросы и инциденты** с приоритетами и видимостью по ролям
- **Домашние задания, новости, чаты**

## Архитектура

```
Browser ──► Next.js (App Router) ──► API Routes ──► Prisma ──► PostgreSQL
                │                          │
                └─ Mantine UI              └─ NextAuth (JWT, credentials)
```

- **Auth:** NextAuth с провайдером Credentials, JWT-сессии на 8 часов, rate-limit 10 попыток/мин на IP.
- **Authorization:** middleware прокидывает `x-user-id`, `x-user-role`, `x-user-star-level` в заголовки. На сервере — `requireAuth`, `requireRole`, `requireStarLevel` в `src/shared/lib/auth.ts`.
- **Безопасные заголовки:** X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-XSS-Protection.

---

## Быстрый старт (локально)

### 1. Требования

- **Node.js** ≥ 20 (рекомендуется 22)
- **npm** ≥ 10 (или pnpm/yarn — но lockfile под npm)
- **Docker Desktop** (для PostgreSQL/Redis/MinIO) ИЛИ локальный PostgreSQL 16
- **Git**

### 2. Клонирование

```bash
git clone git@github.com:Sijjia/school-erudit.git
cd school-erudit
npm install
```

### 3. Поднять инфраструктуру (Docker)

В корне проекта есть `docker-compose.yml`, который запускает Postgres 16, Redis 7 и MinIO:

```bash
docker compose up -d
```

Проверить статус:

```bash
docker compose ps
```

Postgres будет доступен на `localhost:5432` с credentials `erudit / erudit / erudit`.

> **Без Docker:** создайте Postgres-базу `erudit` вручную и пропишите свой `DATABASE_URL`.

### 4. Настроить `.env`

```bash
cp .env.example .env
```

Откройте `.env` и заполните как минимум:

```env
DATABASE_URL="postgresql://erudit:erudit@localhost:5432/erudit"
NEXTAUTH_SECRET="<сгенерируйте через: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

### 5. Накатить миграции и сид

```bash
npx prisma generate
npx prisma migrate deploy      # применить готовые миграции
npx prisma db seed             # заполнить демо-данными
```

> При первом запуске на пустой базе `migrate deploy` создаст всю схему за один проход.

### 6. Запустить dev-сервер

```bash
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000).

---

## Переменные окружения

Все переменные, которые читает приложение:

| Переменная | Обязательная | Описание |
|---|---|---|
| `DATABASE_URL` | да | Строка подключения к PostgreSQL |
| `NEXTAUTH_SECRET` | да | Секрет для подписи JWT (≥ 32 случайных символов) |
| `NEXTAUTH_URL` | в продакшне | Полный URL приложения, например `https://erudit.school.kg` |
| `NODE_ENV` | нет | `development` / `production` / `test` |

`.env.example` — шаблон, попадает в репозиторий.
`.env`, `.env.local`, `.env.production` — реальные значения, **в репозиторий не пушим** (см. `.gitignore`).

---

## База данных

Схема описана в [`prisma/schema.prisma`](prisma/schema.prisma). Основные сущности:

- **User** — единый аккаунт с `role` и `starLevel`
- **Teacher / Student / Parent** — профили, привязанные к User
- **SchoolLevel → Class → ClassGroup → Student** — структура школы
- **Subject + TeacherSubject** — нагрузка учителей
- **TeacherLoadTransfer** — история передачи нагрузки
- **BellSchedule + ScheduleEntry + Substitution** — расписание и замены
- **GradeCategory + Grade + GradeAuditLog** — оценивание с модерацией
- **AcademicPeriod** — триместры, каникулы, карантин
- **Attendance, Homework, BehaviorIncident, News, UrgentIssue, Incident, ChatMessage** — операционные модели

### Полезные команды Prisma

```bash
npx prisma studio                 # GUI для базы (localhost:5555)
npx prisma migrate dev --name X   # создать новую миграцию (в dev)
npx prisma migrate deploy         # применить миграции (в prod)
npx prisma migrate reset          # ВНИМАНИЕ: дропнуть и пересоздать БД
npx prisma db seed                # перезапустить сид
```

---

## Демо-аккаунты

После `npx prisma db seed` доступны следующие пользователи (пароль у всех одинаковый):

| Логин | Роль | Пароль |
|---|---|---|
| `admin` | super_admin | `erudit2025` |
| `kozlova` | zavuch | `erudit2025` |
| `azhibaeva`, `khaydarova`, `pulatova`, `sagyntai`, `egorova`, `fominykh`, `kalykov`, `imashev`, `satarkulov`, `bakashova`, `toktobekova`, `kovaleva`, `fedorova`, `sidorova`, `asanova` | teacher | `erudit2025` |
| `student1`, `student2`, … | student | `erudit2025` |
| `parent1`, `parent2`, … | parent | `erudit2025` |

> Пароли — только для демо. В продакшне обязательно сменить или пересоздать через админ-панель.

---

## Скрипты npm

```bash
npm run dev      # next dev — режим разработки
npm run build    # next build — production-сборка
npm run start    # next start — запуск production-сервера
npm run lint     # eslint
```

---

## Развёртывание в продакшн

### Вариант A: на одном сервере (Linux + Docker)

1. Установить Node.js 20+, Docker, Nginx.
2. Склонировать репо:
   ```bash
   git clone git@github.com:Sijjia/school-erudit.git /opt/erudit
   cd /opt/erudit
   ```
3. Поднять Postgres (либо через `docker compose up -d`, либо использовать managed-Postgres).
4. Заполнить `.env`:
   ```env
   DATABASE_URL="postgresql://erudit:STRONG_PASSWORD@localhost:5432/erudit"
   NEXTAUTH_SECRET="<openssl rand -base64 32>"
   NEXTAUTH_URL="https://erudit.example.com"
   NODE_ENV="production"
   ```
5. Установить зависимости и собрать:
   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed         # только при первом запуске!
   npm run build
   ```
6. Поднять через systemd / pm2 / Docker:
   ```bash
   npm run start   # слушает порт 3000
   ```
7. Перед Next.js поставить Nginx с TLS (Let's Encrypt) и проксированием на `127.0.0.1:3000`.

### Вариант B: Vercel

1. Импортируйте репозиторий на vercel.com.
2. В Environment Variables укажите `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
3. Подключите внешнюю Postgres (Neon, Supabase, Railway, RDS и т.п.).
4. Миграции запускайте локально или в CI: `npx prisma migrate deploy` против продакшн БД.

### Минимальный systemd-юнит (`/etc/systemd/system/erudit.service`)

```ini
[Unit]
Description=ERUDIT Next.js app
After=network.target

[Service]
Type=simple
User=erudit
WorkingDirectory=/opt/erudit
EnvironmentFile=/opt/erudit/.env
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now erudit
```

### Nginx (минимальная конфигурация)

```nginx
server {
  server_name erudit.example.com;
  listen 443 ssl http2;

  ssl_certificate     /etc/letsencrypt/live/erudit.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/erudit.example.com/privkey.pem;

  client_max_body_size 50M;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
  }
}
```

---

## Резервное копирование

В `scripts/backup.sh` лежит готовый скрипт `pg_dump | gzip`. Поставить в cron:

```cron
0 2 * * * /opt/erudit/scripts/backup.sh >> /var/log/erudit-backup.log 2>&1
```

Скрипт хранит бэкапы 30 дней (настраивается через `RETENTION_DAYS`).

Восстановление:

```bash
gunzip -c /root/backups/erudit/erudit_20260101_020000.sql.gz | psql "$DATABASE_URL"
```

---

## Структура проекта

```
erudit/
├── prisma/
│   ├── schema.prisma           # модель БД
│   ├── migrations/             # SQL-миграции
│   └── seed.ts                 # демо-данные
├── public/                     # статика
├── scripts/
│   └── backup.sh               # бэкап Postgres
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # страница логина
│   │   ├── (dashboard)/        # все разделы: classes, students, grading, schedule, ...
│   │   └── api/
│   │       ├── auth/[...nextauth]/   # NextAuth handler
│   │       ├── health/               # health check
│   │       └── v1/                   # бизнес-API
│   ├── middleware.ts           # проверка JWT, прокидывание заголовков
│   ├── modules/                # доменная логика (grading, schedule)
│   ├── shared/
│   │   ├── components/         # переиспользуемые UI-компоненты
│   │   ├── constants/
│   │   ├── hooks/
│   │   ├── lib/                # auth, prisma, rate-limit, formatters
│   │   └── providers/
│   ├── theme/                  # Mantine theme
│   └── types/
├── docker-compose.yml          # postgres + redis + minio
├── next.config.ts              # security headers
├── package.json
└── tsconfig.json
```

---

## Безопасность

- Пароли хешируются через `bcryptjs` (cost factor 10).
- JWT-сессии на 8 часов; `NEXTAUTH_SECRET` обязательно случайный длинный.
- Rate-limit 10 попыток входа/мин на IP (см. `src/shared/lib/rate-limit.ts`).
- Все API под `/api/v1/*` требуют аутентификации (см. `src/middleware.ts`).
- Доступ к данным — двухосный: роль + starLevel (см. `src/shared/lib/star-filter.ts`).
- Безопасные заголовки на всех маршрутах (см. `next.config.ts`).
- В продакшне обязательно: HTTPS, сильный пароль Postgres, пересоздать всех демо-пользователей.

---

## Лицензия

Внутренний проект. Все права принадлежат заказчику.
