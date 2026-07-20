import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BASE_URL } from './helpers';

/**
 * Вертикальный сценарий «один школьный день» Bilim OS.
 *
 * Проходит день целиком по API: завуч смотрит расписание → учитель №1 открывает
 * свой урок, отмечает посещаемость и ставит оценку → учитель №2 ведёт второй урок →
 * завуч проверяет журнал → ученик и родитель видят ТОЛЬКО свои данные → завуч
 * смотрит итог дня. Плюс блок обязательных негативных проверок (чужой урок,
 * чужой класс/предмет, чужой ребёнок, эскалация прав, аноним, отсутствие побочек).
 *
 * Данные полностью синтетические и самодостаточные: тест сам создаёт школу
 * (филиал, ступень, период, 2 класса, предметы, звонки, расписание, 4 учеников,
 * завуча, 2 учителей, 2 ученических и 2 родительских аккаунта) и удаляет всё в
 * afterAll. Прогон НЕ зависит от сида и не трогает существующие записи.
 *
 * Требует запущенный dev/prod-сервер на localhost:3000 + локальный/CI Postgres.
 */

const MARK = 'e2e-ssd'; // single school day
const PW = 'Test_erudit_2026';

/**
 * Предохранитель: тест мутирует БД, поэтому запускается только против локальной
 * или CI-Postgres. Любой нелокальный хост (Neon/прод) — жёсткий отказ.
 */
function assertNonProductionDatabase(): string {
  let url = process.env.DATABASE_URL;
  if (!url) {
    // Локальный прогон: playwright не читает .env, а Prisma читает — берём оттуда же.
    try {
      const raw = readFileSync('.env', 'utf8');
      url = /^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(raw)?.[1];
    } catch {
      /* .env может отсутствовать (CI) — обработаем ниже */
    }
  }
  if (!url) {
    throw new Error('DATABASE_URL не определён — невозможно безопасно определить тестовую БД, прогон отменён');
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL не парсится как URL — невозможно проверить, что БД тестовая, прогон отменён');
  }

  // Хосты, на которых допустимо мутировать данные: докер-Postgres разработчика
  // и postgres-сервис GitHub Actions.
  const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'];
  if (!ALLOWED_HOSTS.includes(hostname)) {
    throw new Error(
      `Отказ: тест мутирует БД и допускает только локальную/CI Postgres, а DATABASE_URL указывает на "${hostname}". ` +
        'Прогон против production/Neon запрещён.',
    );
  }
  if (/neon\.tech|supabase|rds\.amazonaws|bilimos|prod/i.test(url)) {
    throw new Error('Отказ: DATABASE_URL содержит признаки production-базы. Прогон запрещён.');
  }
  return hostname;
}

assertNonProductionDatabase();

const prisma = new PrismaClient();

const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Логин «с нуля»: branchId зашивается в JWT в момент входа.
 *
 * POST /api/auth/* ограничен 10 попытками в минуту на IP. Проект `setup` успевает
 * израсходовать окно до нас, поэтому при неудаче ждём сброса окна и повторяем —
 * иначе фикстура флейкает не по вине сценария.
 */
async function loginCtx(login: string, password: string): Promise<APIRequestContext> {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const c = await pwRequest.newContext({ baseURL: BASE_URL });
    const { csrfToken } = (await (await c.get('/api/auth/csrf')).json()) as { csrfToken: string };
    const res = await c.post('/api/auth/callback/credentials', { form: { csrfToken, login, password, json: 'true' } });
    lastStatus = res.status();
    const session = (await (await c.get('/api/auth/session')).json()) as { user?: { role?: string } };
    if (session?.user?.role) return c;
    await c.dispose();
    if (attempt < 3) await new Promise((r) => setTimeout(r, RATE_LIMIT_WINDOW_MS + 1_000));
  }
  throw new Error(`Не удалось залогинить ${login} (последний статус ${lastStatus})`);
}

async function makeUser(login: string, role: string, branchId: string | null) {
  return prisma.user.create({
    data: { login, password: await hash(PW, 10), role: role as never, isActive: true, branchId },
    select: { id: true },
  });
}

// --- фикстура одного школьного дня ---
const now = new Date();
const lessonDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // локальная полночь
const lessonDateIso = lessonDate.toISOString();
const dayOfWeek = lessonDate.getDay() === 0 ? 7 : lessonDate.getDay();
const periodStart = new Date(lessonDate.getTime() - 30 * 24 * 3600_000);
const periodEnd = new Date(lessonDate.getTime() + 30 * 24 * 3600_000);
const dayFrom = new Date(lessonDate.getTime() - 12 * 3600_000).toISOString();
const dayTo = new Date(lessonDate.getTime() + 12 * 3600_000).toISOString();

const ids = {
  branch: '',
  level: '',
  period: '',
  category: '',
  classA: '',
  classB: '',
  subjMath: '',
  subjHistory: '',
  slot1: '',
  slot2: '',
  zavuchUser: '',
  t1User: '',
  t2User: '',
  t1: '',
  t2: '',
  s1User: '',
  s2User: '',
  p1User: '',
  p2User: '',
  p1: '',
  p2: '',
  s1A: '',
  s2A: '',
  s3B: '',
  s4B: '',
  lesson1: '',
  lesson2: '',
  gradeS1: '',
  gradeS3: '',
};

let zavuch: APIRequestContext;
let teacher1: APIRequestContext;
let teacher2: APIRequestContext;
let student1: APIRequestContext; // s1A, класс 7А
let parent1: APIRequestContext; // родитель s1A
let anon: APIRequestContext;

type Env<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

// .serial обязателен: этапы дня зависят от id, созданных предыдущими этапами
// (оценка → правка оценки → сводка). Без него Playwright перезапускает воркер после
// первого падения, повторно выполняет beforeAll и теряет состояние модуля.
test.describe.serial('Один школьный день Bilim OS (вертикальный сценарий + негативы)', () => {
  test.beforeAll(async () => {
    // Запас на ожидание окна rate-limit при логине пяти аккаунтов фикстуры.
    test.setTimeout(300_000);

    const branch = await prisma.branch.create({ data: { name: `${MARK}-school` }, select: { id: true } });
    ids.branch = branch.id;

    const level = await prisma.schoolLevel.create({
      data: { name: `${MARK}-level`, fromGrade: 1, toGrade: 11 },
      select: { id: true },
    });
    ids.level = level.id;

    // Учебный год/период. isActive=false намеренно: чтобы не перебивать активный
    // период сида для остальных тестов — все запросы ниже передают periodId явно.
    const period = await prisma.academicPeriod.create({
      data: {
        name: `${MARK}-trimester`,
        type: 'trimester',
        startDate: periodStart,
        endDate: periodEnd,
        isActive: false,
      },
      select: { id: true },
    });
    ids.period = period.id;

    const category = await prisma.gradeCategory.create({
      data: { name: `${MARK}-Работа на уроке`, weight: 1, order: 900, requiresModeration: false },
      select: { id: true },
    });
    ids.category = category.id;

    const [classA, classB] = await Promise.all([
      prisma.class.create({ data: { grade: 7, letter: `${MARK}-A`, levelId: ids.level, branchId: ids.branch }, select: { id: true } }),
      prisma.class.create({ data: { grade: 7, letter: `${MARK}-B`, levelId: ids.level, branchId: ids.branch }, select: { id: true } }),
    ]);
    ids.classA = classA.id;
    ids.classB = classB.id;

    const [math, history] = await Promise.all([
      prisma.subject.create({ data: { name: `${MARK}-Математика` }, select: { id: true } }),
      prisma.subject.create({ data: { name: `${MARK}-История` }, select: { id: true } }),
    ]);
    ids.subjMath = math.id;
    ids.subjHistory = history.id;

    const [slot1, slot2] = await Promise.all([
      prisma.bellSchedule.create({ data: { slotNumber: 901, startTime: '08:00', endTime: '08:45', type: 'lesson' }, select: { id: true } }),
      prisma.bellSchedule.create({ data: { slotNumber: 902, startTime: '09:00', endTime: '09:45', type: 'lesson' }, select: { id: true } }),
    ]);
    ids.slot1 = slot1.id;
    ids.slot2 = slot2.id;

    // Персонал
    ids.zavuchUser = (await makeUser(`${MARK}-zavuch`, 'zavuch', ids.branch)).id;
    ids.t1User = (await makeUser(`${MARK}-teacher1`, 'teacher', ids.branch)).id;
    ids.t2User = (await makeUser(`${MARK}-teacher2`, 'teacher', ids.branch)).id;

    const t1 = await prisma.teacher.create({
      data: { userId: ids.t1User, firstName: 'Айгуль', lastName: `${MARK}-Учитель1`, curatorOf: { connect: { id: ids.classA } } },
      select: { id: true },
    });
    ids.t1 = t1.id;
    const t2 = await prisma.teacher.create({
      data: { userId: ids.t2User, firstName: 'Нурлан', lastName: `${MARK}-Учитель2`, curatorOf: { connect: { id: ids.classB } } },
      select: { id: true },
    });
    ids.t2 = t2.id;

    // Нагрузка: учитель №1 — математика в 7А, учитель №2 — история в 7Б.
    await prisma.teacherSubject.createMany({
      data: [
        { teacherId: ids.t1, subjectId: ids.subjMath, classId: ids.classA, hoursPerWeek: 5 },
        { teacherId: ids.t2, subjectId: ids.subjHistory, classId: ids.classB, hoursPerWeek: 2 },
      ],
    });

    // Ученики: 2 в 7А, 2 в 7Б; у одного из каждого класса есть логин.
    ids.s1User = (await makeUser(`${MARK}-student1`, 'student', ids.branch)).id;
    ids.s2User = (await makeUser(`${MARK}-student2`, 'student', ids.branch)).id;

    const mk = async (firstName: string, classId: string, userId?: string) =>
      (await prisma.student.create({
        data: { firstName, lastName: `${MARK}-Ученик`, classId, branchId: ids.branch, status: 'permanent', userId },
        select: { id: true },
      })).id;

    ids.s1A = await mk('Асель', ids.classA, ids.s1User);
    ids.s2A = await mk('Бекзат', ids.classA);
    ids.s3B = await mk('Чынара', ids.classB, ids.s2User);
    ids.s4B = await mk('Данияр', ids.classB);

    // Родители: p1 → s1A (7А), p2 → s3B (7Б).
    ids.p1User = (await makeUser(`${MARK}-parent1`, 'parent', ids.branch)).id;
    ids.p2User = (await makeUser(`${MARK}-parent2`, 'parent', ids.branch)).id;
    ids.p1 = (await prisma.parent.create({ data: { userId: ids.p1User, firstName: 'Гүлнара', lastName: `${MARK}-Родитель1` }, select: { id: true } })).id;
    ids.p2 = (await prisma.parent.create({ data: { userId: ids.p2User, firstName: 'Эркин', lastName: `${MARK}-Родитель2` }, select: { id: true } })).id;
    await prisma.parentStudent.createMany({
      data: [
        { parentId: ids.p1, studentId: ids.s1A, relation: 'мать' },
        { parentId: ids.p2, studentId: ids.s3B, relation: 'отец' },
      ],
    });

    // Расписание дня: 1-й урок — математика в 7А, 2-й — история в 7Б.
    const lesson1 = await prisma.scheduleEntry.create({
      data: { classId: ids.classA, teacherId: ids.t1, subjectId: ids.subjMath, slotId: ids.slot1, dayOfWeek, periodStart, periodEnd },
      select: { id: true },
    });
    ids.lesson1 = lesson1.id;
    const lesson2 = await prisma.scheduleEntry.create({
      data: { classId: ids.classB, teacherId: ids.t2, subjectId: ids.subjHistory, slotId: ids.slot2, dayOfWeek, periodStart, periodEnd },
      select: { id: true },
    });
    ids.lesson2 = lesson2.id;

    zavuch = await loginCtx(`${MARK}-zavuch`, PW);
    teacher1 = await loginCtx(`${MARK}-teacher1`, PW);
    teacher2 = await loginCtx(`${MARK}-teacher2`, PW);
    student1 = await loginCtx(`${MARK}-student1`, PW);
    parent1 = await loginCtx(`${MARK}-parent1`, PW);
    anon = await pwRequest.newContext({ baseURL: BASE_URL });

    const expectedRoles = [
      ['zavuch', zavuch, 'zavuch'],
      ['teacher1', teacher1, 'teacher'],
      ['teacher2', teacher2, 'teacher'],
      ['student1', student1, 'student'],
      ['parent1', parent1, 'parent'],
    ] as const;
    for (const [name, ctx, role] of expectedRoles) {
      const me = (await (await ctx.get('/api/auth/session')).json()) as { user?: { role?: string } };
      expect(me?.user?.role, `${name} залогинен как ${role}`).toBe(role);
    }
  });

  test.afterAll(async () => {
    const studentIds = [ids.s1A, ids.s2A, ids.s3B, ids.s4B].filter(Boolean);
    const userIds = [ids.zavuchUser, ids.t1User, ids.t2User, ids.s1User, ids.s2User, ids.p1User, ids.p2User].filter(Boolean);

    await prisma.gradeAuditLog.deleteMany({ where: { grade: { studentId: { in: studentIds } } } });
    await prisma.grade.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.parentStudent.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.scheduleEntry.deleteMany({ where: { classId: { in: [ids.classA, ids.classB].filter(Boolean) } } });
    await prisma.lessonTopic.deleteMany({ where: { classId: { in: [ids.classA, ids.classB].filter(Boolean) } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.parent.deleteMany({ where: { id: { in: [ids.p1, ids.p2].filter(Boolean) } } });
    await prisma.teacherSubject.deleteMany({ where: { teacherId: { in: [ids.t1, ids.t2].filter(Boolean) } } });
    await prisma.class.updateMany({ where: { id: { in: [ids.classA, ids.classB].filter(Boolean) } }, data: { curatorId: null } });
    await prisma.teacher.deleteMany({ where: { id: { in: [ids.t1, ids.t2].filter(Boolean) } } });
    await prisma.class.deleteMany({ where: { id: { in: [ids.classA, ids.classB].filter(Boolean) } } });
    await prisma.schoolLevel.deleteMany({ where: { id: ids.level } });
    await prisma.subject.deleteMany({ where: { id: { in: [ids.subjMath, ids.subjHistory].filter(Boolean) } } });
    await prisma.bellSchedule.deleteMany({ where: { id: { in: [ids.slot1, ids.slot2].filter(Boolean) } } });
    await prisma.gradeCategory.deleteMany({ where: { id: ids.category } });
    await prisma.academicPeriod.deleteMany({ where: { id: ids.period } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.branch.deleteMany({ where: { id: ids.branch } });

    await Promise.all([zavuch, teacher1, teacher2, student1, parent1, anon].map((c) => c?.dispose()));
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------- 07:45
  test('07:45 — завуч видит расписание дня по обоим классам', async () => {
    const resA = await zavuch.get(`/api/v1/schedule?classId=${ids.classA}&dayOfWeek=${dayOfWeek}`);
    expect(resA.status(), 'завуч читает расписание 7А').toBe(200);
    const a = (await resA.json()) as Env<Array<{ id: string; subject: { name: string } }>>;
    expect(a.data?.map((e) => e.id), 'в расписании 7А есть 1-й урок').toContain(ids.lesson1);

    const resB = await zavuch.get(`/api/v1/schedule?classId=${ids.classB}&dayOfWeek=${dayOfWeek}`);
    expect(resB.status(), 'завуч читает расписание 7Б').toBe(200);
    const b = (await resB.json()) as Env<Array<{ id: string }>>;
    expect(b.data?.map((e) => e.id), 'в расписании 7Б есть 2-й урок').toContain(ids.lesson2);
  });

  // ---------------------------------------------------------------- 08:00
  test('08:00 — учитель №1 видит только свой урок и открывает его', async () => {
    const res = await teacher1.get('/api/v1/schedule/teacher-today');
    expect(res.status(), 'учитель открывает свой день').toBe(200);
    const json = (await res.json()) as Env<{ lessons: Array<{ scheduleId: string; classId: string }> }>;
    const lessonIds = json.data?.lessons.map((l) => l.scheduleId) ?? [];
    expect(lessonIds, 'свой урок в списке дня').toContain(ids.lesson1);
    expect(lessonIds, 'чужой урок не показывается').not.toContain(ids.lesson2);

    // «Открыть урок» = получить свою запись расписания по своему классу.
    const open = await teacher1.get(`/api/v1/schedule?classId=${ids.classA}&dayOfWeek=${dayOfWeek}`);
    expect(open.status(), 'учитель открывает урок своего класса').toBe(200);
    const opened = (await open.json()) as Env<Array<{ id: string }>>;
    expect(opened.data?.map((e) => e.id), 'урок открыт').toContain(ids.lesson1);
  });

  // ---------------------------------------------------------------- 08:05
  test('08:05 — учитель №1 отмечает посещаемость своего класса', async () => {
    const p1 = await teacher1.post('/api/v1/attendance', { data: { studentId: ids.s1A, date: lessonDateIso, status: 'present' } });
    expect(p1.status(), 'отметка «был» сохранена').toBe(201);
    const p2 = await teacher1.post('/api/v1/attendance', { data: { studentId: ids.s2A, date: lessonDateIso, status: 'late', reason: 'опоздал на автобус' } });
    expect(p2.status(), 'отметка «опоздал» сохранена').toBe(201);

    const res = await teacher1.get(`/api/v1/attendance?classId=${ids.classA}&startDate=${dayFrom}&endDate=${dayTo}`);
    expect(res.status(), 'учитель читает посещаемость своего класса').toBe(200);
    const json = (await res.json()) as Env<Array<{ studentId: string; status: string }>>;
    const byStudent = new Map((json.data ?? []).map((r) => [r.studentId, r.status]));
    expect(byStudent.get(ids.s1A), 'ученик 1 — present').toBe('present');
    expect(byStudent.get(ids.s2A), 'ученик 2 — late').toBe('late');
  });

  // ---------------------------------------------------------------- 08:20
  test('08:20 — учитель №1 выставляет оценку ученику своего класса', async () => {
    const res = await teacher1.post('/api/v1/grading', {
      data: {
        studentId: ids.s1A,
        subjectId: ids.subjMath,
        categoryId: ids.category,
        teacherId: ids.t1,
        periodId: ids.period,
        value: 5,
        date: lessonDateIso,
      },
    });
    expect(res.status(), 'оценка своему ученику по своему предмету выставлена').toBe(201);
    const json = (await res.json()) as Env<{ id: string; status: string; teacherId: string }>;
    ids.gradeS1 = json.data?.id ?? '';
    expect(ids.gradeS1, 'id оценки получен').toBeTruthy();

    const grade = await prisma.grade.findUnique({ where: { id: ids.gradeS1 }, select: { value: true, teacherId: true, status: true } });
    expect(grade?.value, 'оценка 5 в БД').toBe(5);
    expect(grade?.teacherId, 'авторство — учитель №1 из сессии').toBe(ids.t1);
    expect(grade?.status, 'категория без модерации → published').toBe('published');
  });

  // ---------------------------------------------------------------- 09:00
  test('09:00 — учитель №2 проводит второй урок (посещаемость + оценка)', async () => {
    const today = await teacher2.get('/api/v1/schedule/teacher-today');
    expect(today.status(), 'учитель №2 открывает свой день').toBe(200);
    const day = (await today.json()) as Env<{ lessons: Array<{ scheduleId: string }> }>;
    const lessonIds = day.data?.lessons.map((l) => l.scheduleId) ?? [];
    expect(lessonIds, 'свой урок в списке дня').toContain(ids.lesson2);
    expect(lessonIds, 'урок первого учителя не виден').not.toContain(ids.lesson1);

    const att = await teacher2.post('/api/v1/attendance', { data: { studentId: ids.s3B, date: lessonDateIso, status: 'absent', reason: 'болеет' } });
    expect(att.status(), 'посещаемость 7Б отмечена').toBe(201);

    const res = await teacher2.post('/api/v1/grading', {
      data: {
        studentId: ids.s3B,
        subjectId: ids.subjHistory,
        categoryId: ids.category,
        teacherId: ids.t2,
        periodId: ids.period,
        value: 4,
        date: lessonDateIso,
      },
    });
    expect(res.status(), 'оценка по истории в 7Б выставлена').toBe(201);
    ids.gradeS3 = ((await res.json()) as Env<{ id: string }>).data?.id ?? '';
    expect(ids.gradeS3, 'id оценки получен').toBeTruthy();
  });

  // ---------------------------------------------------------------- 11:00
  test('11:00 — завуч проверяет заполнение журнала', async () => {
    const res = await zavuch.get(`/api/v1/grading/class-journal?classId=${ids.classA}&periodId=${ids.period}`);
    expect(res.status(), 'завуч открывает журнал 7А').toBe(200);
    const json = (await res.json()) as Env<{
      students: Array<{ id: string; absences: number; lates: number; subjectGrades: Record<string, { count: number }> }>;
    }>;
    const rows = json.data?.students ?? [];
    expect(rows.map((s) => s.id).sort(), 'в журнале оба ученика 7А').toEqual([ids.s1A, ids.s2A].sort());

    const asel = rows.find((s) => s.id === ids.s1A);
    expect(asel?.subjectGrades?.[ids.subjMath]?.count, 'у ученика 1 есть оценка по математике').toBe(1);
    const bekzat = rows.find((s) => s.id === ids.s2A);
    expect(bekzat?.lates, 'опоздание ученика 2 попало в журнал').toBe(1);
  });

  // ---------------------------------------------------------------- 13:00
  test('13:00 — ученик видит только своё расписание, посещаемость и оценки', async () => {
    const sched = await student1.get('/api/v1/schedule');
    expect(sched.status(), 'ученик читает своё расписание').toBe(200);
    const s = (await sched.json()) as Env<Array<{ id: string; classId: string }>>;
    expect(s.data?.map((e) => e.id), 'свой урок виден').toContain(ids.lesson1);
    expect(s.data?.every((e) => e.classId === ids.classA), 'только свой класс в расписании').toBe(true);

    const att = await student1.get('/api/v1/attendance');
    expect(att.status(), 'ученик читает свою посещаемость').toBe(200);
    const a = (await att.json()) as Env<Array<{ studentId: string }>>;
    expect(a.data?.length, 'есть своя запись посещаемости').toBeGreaterThan(0);
    expect(a.data?.every((r) => r.studentId === ids.s1A), 'только свои записи посещаемости').toBe(true);

    const gr = await student1.get('/api/v1/grading');
    expect(gr.status(), 'ученик читает свои оценки').toBe(200);
    const g = (await gr.json()) as Env<Array<{ id: string; studentId: string; status: string }>>;
    expect(g.data?.map((x) => x.id), 'своя оценка видна').toContain(ids.gradeS1);
    expect(g.data?.every((x) => x.studentId === ids.s1A), 'только свои оценки').toBe(true);
    expect(g.data?.every((x) => x.status === 'published'), 'только опубликованные оценки').toBe(true);
  });

  // ---------------------------------------------------------------- 13:10
  test('13:10 — родитель видит только данные своего ребёнка', async () => {
    const kids = await parent1.get('/api/v1/students');
    expect(kids.status(), 'родитель читает список детей').toBe(200);
    const k = (await kids.json()) as Env<Array<{ id: string }>>;
    expect(k.data?.map((x) => x.id), 'свой ребёнок в списке').toContain(ids.s1A);
    expect(k.data?.every((x) => x.id === ids.s1A), 'чужих детей в списке нет').toBe(true);

    const gr = await parent1.get('/api/v1/grading');
    expect(gr.status(), 'родитель читает оценки ребёнка').toBe(200);
    const g = (await gr.json()) as Env<Array<{ studentId: string }>>;
    expect(g.data?.every((x) => x.studentId === ids.s1A), 'только оценки своего ребёнка').toBe(true);

    const own = await parent1.get(`/api/v1/students/${ids.s1A}/grades`);
    expect(own.status(), 'карточка оценок своего ребёнка доступна').toBe(200);

    const att = await parent1.get('/api/v1/attendance');
    expect(att.status(), 'родитель читает посещаемость ребёнка').toBe(200);
    const a = (await att.json()) as Env<Array<{ studentId: string }>>;
    expect(a.data?.every((r) => r.studentId === ids.s1A), 'только посещаемость своего ребёнка').toBe(true);
  });

  // ---------------------------------------------------------------- 15:00
  test('15:00 — завуч видит итог дня по обоим классам', async () => {
    const att = await zavuch.get(`/api/v1/attendance?startDate=${dayFrom}&endDate=${dayTo}`);
    expect(att.status(), 'завуч читает посещаемость дня').toBe(200);
    const a = (await att.json()) as Env<Array<{ studentId: string; status: string }>>;
    const byStudent = new Map((a.data ?? []).map((r) => [r.studentId, r.status]));
    expect(byStudent.get(ids.s1A), 'итог: ученик 1 — present').toBe('present');
    expect(byStudent.get(ids.s2A), 'итог: ученик 2 — late').toBe('late');
    expect(byStudent.get(ids.s3B), 'итог: ученик 3 — absent').toBe('absent');

    const gr = await zavuch.get('/api/v1/grading');
    expect(gr.status(), 'завуч читает оценки дня').toBe(200);
    const g = (await gr.json()) as Env<Array<{ id: string }>>;
    const gradeIds = g.data?.map((x) => x.id) ?? [];
    expect(gradeIds, 'оценка учителя №1 в итоге дня').toContain(ids.gradeS1);
    expect(gradeIds, 'оценка учителя №2 в итоге дня').toContain(ids.gradeS3);
  });

  // ================= обязательные негативные сценарии =================

  test('НЕГАТИВ 1 — учитель не может открыть или изменить чужой урок', async () => {
    const read = await teacher1.get(`/api/v1/schedule?classId=${ids.classB}&dayOfWeek=${dayOfWeek}`);
    expect(read.status(), 'чтение расписания чужого класса запрещено').toBe(403);

    const write = await teacher1.put(`/api/v1/schedule/${ids.lesson2}`, { data: { slotId: ids.slot1 } });
    expect([401, 403], 'правка чужого урока запрещена').toContain(write.status());

    const del = await teacher1.delete(`/api/v1/schedule/${ids.lesson2}`);
    expect([401, 403], 'удаление чужого урока запрещено').toContain(del.status());

    const still = await prisma.scheduleEntry.findUnique({ where: { id: ids.lesson2 }, select: { slotId: true } });
    expect(still?.slotId, 'чужой урок не изменён').toBe(ids.slot2);
  });

  test('НЕГАТИВ 2 — учитель не может выставить оценку чужому классу', async () => {
    const res = await teacher1.post('/api/v1/grading', {
      data: {
        studentId: ids.s3B,
        subjectId: ids.subjHistory,
        categoryId: ids.category,
        teacherId: ids.t1,
        periodId: ids.period,
        value: 2,
        date: lessonDateIso,
      },
    });
    expect(res.status(), 'оценка ученику чужого класса запрещена').toBe(403);
    const count = await prisma.grade.count({ where: { studentId: ids.s3B } });
    expect(count, 'у ученика 7Б осталась только оценка учителя №2').toBe(1);
  });

  test('НЕГАТИВ 3 — учитель не может выставить оценку по чужому предмету', async () => {
    // Учитель №1 ведёт математику в 7А, историю — нет. Свой класс, чужой предмет.
    const res = await teacher1.post('/api/v1/grading', {
      data: {
        studentId: ids.s1A,
        subjectId: ids.subjHistory,
        categoryId: ids.category,
        teacherId: ids.t1,
        periodId: ids.period,
        value: 2,
        date: lessonDateIso,
      },
    });
    expect(res.status(), 'оценка по предмету, который учитель не ведёт, запрещена').toBe(403);
    const count = await prisma.grade.count({ where: { studentId: ids.s1A, subjectId: ids.subjHistory } });
    expect(count, 'оценка по чужому предмету не создана').toBe(0);
  });

  test('НЕГАТИВ 4 — учитель не может изменить чужую оценку', async () => {
    const res = await teacher2.put(`/api/v1/grading/${ids.gradeS1}`, { data: { value: 2 } });
    expect(res.status(), 'правка оценки другого учителя запрещена').toBe(403);
    const grade = await prisma.grade.findUnique({ where: { id: ids.gradeS1 }, select: { value: true } });
    expect(grade?.value, 'значение чужой оценки не изменилось').toBe(5);
  });

  test('НЕГАТИВ 5 — ученик не видит другого ученика', async () => {
    const att = await student1.get(`/api/v1/attendance?studentId=${ids.s3B}`);
    expect(att.status(), 'посещаемость другого ученика закрыта').toBe(403);

    const grade = await student1.get(`/api/v1/grading/${ids.gradeS3}`);
    expect(grade.status(), 'чужая оценка по id закрыта').toBe(403);

    const journal = await student1.get(`/api/v1/grading/class-journal?classId=${ids.classB}&periodId=${ids.period}`);
    expect(journal.status(), 'журнал чужого класса закрыт').toBe(403);

    const foreignGrades = await student1.get(`/api/v1/students/${ids.s3B}/grades`);
    expect(foreignGrades.status(), 'карточка оценок другого ученика закрыта').toBe(403);

    const weekly = await student1.get('/api/v1/schedule/weekly');
    expect(weekly.status(), 'общешкольная сетка расписания ученику закрыта').toBe(403);
  });

  test('НЕГАТИВ 6 — родитель не видит чужого ребёнка', async () => {
    const att = await parent1.get(`/api/v1/attendance?studentId=${ids.s3B}`);
    expect(att.status(), 'посещаемость чужого ребёнка закрыта').toBe(403);

    const grades = await parent1.get(`/api/v1/students/${ids.s3B}/grades`);
    expect(grades.status(), 'оценки чужого ребёнка закрыты').toBe(403);

    const grade = await parent1.get(`/api/v1/grading/${ids.gradeS3}`);
    expect(grade.status(), 'чужая оценка по id закрыта').toBe(403);

    const journal = await parent1.get(`/api/v1/grading/class-journal?classId=${ids.classB}&periodId=${ids.period}`);
    expect(journal.status(), 'журнал чужого класса закрыт').toBe(403);
  });

  test('НЕГАТИВ 7 — учитель не получает права завуча', async () => {
    const createLesson = await teacher1.post('/api/v1/schedule', {
      data: {
        classId: ids.classA,
        teacherId: ids.t1,
        subjectId: ids.subjMath,
        slotId: ids.slot2,
        dayOfWeek,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    });
    expect(createLesson.status(), 'учитель не создаёт расписание').toBe(403);

    const moderation = await teacher1.get('/api/v1/grading/moderation');
    expect(moderation.status(), 'учитель не открывает модерацию').toBe(403);

    const approve = await teacher1.put('/api/v1/grading/moderation', { data: { gradeIds: [ids.gradeS1], action: 'approve' } });
    expect(approve.status(), 'учитель не утверждает оценки').toBe(403);

    const period = await teacher1.post('/api/v1/periods', {
      data: { name: `${MARK}-hack`, type: 'trimester', startDate: periodStart.toISOString(), endDate: periodEnd.toISOString() },
    });
    expect(period.status(), 'учитель не создаёт учебные периоды').toBe(403);

    const del = await teacher1.delete(`/api/v1/grading/${ids.gradeS1}`);
    expect(del.status(), 'учитель не удаляет оценки').toBe(403);
  });

  test('НЕГАТИВ 8 — неизвестный пользователь не получает данные', async () => {
    for (const path of [
      `/api/v1/schedule?classId=${ids.classA}`,
      '/api/v1/schedule/teacher-today',
      '/api/v1/schedule/weekly',
      `/api/v1/attendance?classId=${ids.classA}`,
      '/api/v1/grading',
      `/api/v1/grading/class-journal?classId=${ids.classA}&periodId=${ids.period}`,
      '/api/v1/me',
    ]) {
      const res = await anon.get(path);
      expect(res.status(), `аноним не читает ${path}`).toBe(401);
    }

    const post = await anon.post('/api/v1/attendance', { data: { studentId: ids.s1A, date: lessonDateIso, status: 'absent' } });
    expect(post.status(), 'аноним не пишет посещаемость').toBe(401);
  });

  // Правила «закрытого учебного периода» в системе НЕТ: у AcademicPeriod есть только
  // isActive (без isClosed/closedAt), POST /api/v1/grading вообще не читает период,
  // а посещаемость с периодом не связана. Единственное ограничение правки — окно 24ч
  // по Grade.createdAt. Проверять нечего → фиксируем как явный пробел в бэклоге.
  test.skip('НЕГАТИВ 10 — учитель не редактирует закрытый период (правила нет в системе)', async () => {});

  test('НЕГАТИВ 9 — запрещённые запросы не создали побочных записей', async () => {
    const studentIds = [ids.s1A, ids.s2A, ids.s3B, ids.s4B];

    const grades = await prisma.grade.count({ where: { studentId: { in: studentIds } } });
    expect(grades, 'ровно 2 оценки за день — обе легальные').toBe(2);

    const attendance = await prisma.attendance.count({ where: { studentId: { in: studentIds } } });
    expect(attendance, 'ровно 3 отметки посещаемости — все легальные').toBe(3);

    const lessons = await prisma.scheduleEntry.count({ where: { classId: { in: [ids.classA, ids.classB] } } });
    expect(lessons, 'расписание дня не выросло от отказанных запросов').toBe(2);

    const periods = await prisma.academicPeriod.count({ where: { name: `${MARK}-hack` } });
    expect(periods, 'отказанный POST не создал учебный период').toBe(0);

    const s1 = await prisma.grade.findUnique({ where: { id: ids.gradeS1 }, select: { value: true, status: true } });
    expect(s1?.value, 'оценка ученика 1 не изменена').toBe(5);
    expect(s1?.status, 'статус оценки ученика 1 не изменён').toBe('published');
  });
});
