import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BASE_URL } from './helpers';

/**
 * Regression: POST /api/v1/payments must enforce branch isolation.
 *
 * Finding E-1 — branch-scoped accountant/finance_manager филиала A мог передать
 * invoiceId счёта филиала B и зарегистрировать по нему платёж (для бухгалтера —
 * сразу verified): пересчитывался статус чужого счёта, при переплате создавалась
 * StudentNote чужому ученику.
 *
 * Данные создаются детерминированно через Prisma (свои филиалы A/B, свой бухгалтер
 * филиала A, ученик B с договором и двумя счетами для сценария переплаты). Атакующий
 * филиал зашивается в JWT при СВЕЖЕМ логине, поэтому создаём и логиним отдельного
 * бухгалтера, а не берём сид.
 *
 * Требует запущенный dev-сервер (npm run dev) + локальный Postgres из .env.
 */

const prisma = new PrismaClient();
const MARK = 'e2e-pay-branch';
const STAFF_LOGIN = `${MARK}-accountant`;
const STAFF_PW = 'Test_erudit_2026';

let ctx: APIRequestContext; // авторизован как бухгалтер филиала A
let branchAId = '';
let branchBId = '';
let staffUserId = '';
let studentAId = '';
let studentBId = '';
let invoiceAId = '';
let contractBId = '';
let invoiceBId = '';
let invoiceB2Id = '';

/** Программный логин NextAuth (credentials) → контекст с session-cookie. */
async function loginCtx(login: string, password: string): Promise<APIRequestContext> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  const { csrfToken } = (await (await c.get('/api/auth/csrf')).json()) as { csrfToken: string };
  await c.post('/api/auth/callback/credentials', {
    form: { csrfToken, login, password, json: 'true' },
  });
  return c;
}

test.describe('payments POST: branch isolation (FAILURE = cross-branch payment)', () => {
  test.beforeAll(async () => {
    const anyClass = await prisma.class.findFirst({ select: { id: true } });
    if (!anyClass) throw new Error('В базе нет классов — прогоните сид перед тестом');
    const classId = anyClass.id;

    const [branchA, branchB] = await Promise.all([
      prisma.branch.create({ data: { name: `${MARK}-A` }, select: { id: true } }),
      prisma.branch.create({ data: { name: `${MARK}-B` }, select: { id: true } }),
    ]);
    branchAId = branchA.id;
    branchBId = branchB.id;

    const staff = await prisma.user.create({
      data: { login: STAFF_LOGIN, password: await hash(STAFF_PW, 10), role: 'accountant', isActive: true, branchId: branchAId },
      select: { id: true },
    });
    staffUserId = staff.id;

    const studentA = await prisma.student.create({
      data: { firstName: 'A', lastName: MARK, classId, branchId: branchAId, status: 'permanent' },
      select: { id: true },
    });
    studentAId = studentA.id;

    const studentB = await prisma.student.create({
      data: { firstName: 'B', lastName: MARK, classId, branchId: branchBId, status: 'permanent' },
      select: { id: true },
    });
    studentBId = studentB.id;

    // Счёт своего филиала (A) — для позитивного платежа. Остаток 50000.
    const invoiceA = await prisma.feeInvoice.create({
      data: { studentId: studentAId, title: `${MARK} A tuition`, amount: 50000, status: 'pending' },
      select: { id: true },
    });
    invoiceAId = invoiceA.id;

    // Договор + два счёта филиала B — цель атаки и сценария переплаты (spill B→B2 → note).
    const contractB = await prisma.contract.create({
      data: {
        number: `${MARK}-B`, studentId: studentBId, branchId: branchBId, year: '2026–2027',
        baseAmount: 200000, amount: 200000, status: 'active', createdById: staffUserId,
      },
      select: { id: true },
    });
    contractBId = contractB.id;

    const invoiceB = await prisma.feeInvoice.create({
      data: { studentId: studentBId, contractId: contractBId, title: `${MARK} B sep`, period: '1/2', amount: 100000, status: 'pending', dueDate: new Date('2026-09-10') },
      select: { id: true },
    });
    invoiceBId = invoiceB.id;

    const invoiceB2 = await prisma.feeInvoice.create({
      data: { studentId: studentBId, contractId: contractBId, title: `${MARK} B oct`, period: '2/2', amount: 100000, status: 'pending', dueDate: new Date('2026-10-10') },
      select: { id: true },
    });
    invoiceB2Id = invoiceB2.id;

    ctx = await loginCtx(STAFF_LOGIN, STAFF_PW);
    const me = (await (await ctx.get('/api/auth/session')).json()) as { user?: { role?: string } };
    expect(me?.user?.role, 'бухгалтер филиала A должен быть залогинен').toBe('accountant');
  });

  test.afterAll(async () => {
    // Teardown в порядке FK. Всё помечено MARK — чужого не трогаем.
    await prisma.payment.deleteMany({ where: { invoice: { studentId: { in: [studentAId, studentBId] } } } });
    await prisma.studentNote.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.contract.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId] } } });
    await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    await ctx?.dispose();
    await prisma.$disconnect();
  });

  test('scenario 1 (positive): бухгалтер филиала A регистрирует платёж по счёту своего филиала', async () => {
    const res = await ctx.post('/api/v1/payments', { data: { invoiceId: invoiceAId, amount: 20000, method: 'нал' } });
    expect(res.status(), 'платёж по своему счёту разрешён').toBe(201);

    const payments = await prisma.payment.findMany({ where: { invoiceId: invoiceAId }, select: { amount: true, verified: true } });
    expect(payments.length, 'платёж по счёту A создан').toBe(1);
    expect(payments[0].amount, 'сумма платежа').toBe(20000);
    expect(payments[0].verified, 'бухгалтерский платёж сразу verified').toBe(true);

    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceAId }, select: { status: true } });
    expect(inv?.status, 'счёт A пересчитан в partial (20000 < 50000)').toBe('partial');
  });

  test('scenario 2 (cross-branch): платёж по счёту филиала B по прямому invoiceId запрещён', async () => {
    const res = await ctx.post('/api/v1/payments', { data: { invoiceId: invoiceBId, amount: 30000, method: 'нал' } });
    expect([403, 404], 'кросс-филиальный платёж должен быть запрещён').toContain(res.status());

    const payments = await prisma.payment.count({ where: { invoiceId: invoiceBId } });
    expect(payments, 'платёж по счёту B не создан').toBe(0);

    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceBId }, select: { status: true } });
    expect(inv?.status, 'статус счёта B неизменён').toBe('pending');
  });

  test('scenario 3 (overpayment side effect): кросс-филиальная переплата не создаёт платёж/note', async () => {
    // 150000 > остаток B (100000): на старом коде перелилось бы в B2 (2 allocations → StudentNote).
    const res = await ctx.post('/api/v1/payments', { data: { invoiceId: invoiceBId, amount: 150000, method: 'нал' } });
    expect([403, 404], 'кросс-филиальная переплата должна быть запрещена до транзакции').toContain(res.status());

    const payB = await prisma.payment.count({ where: { invoiceId: invoiceBId } });
    const payB2 = await prisma.payment.count({ where: { invoiceId: invoiceB2Id } });
    expect(payB, 'платёж по B не создан').toBe(0);
    expect(payB2, 'перелив в B2 не создан').toBe(0);

    const invB = await prisma.feeInvoice.findUnique({ where: { id: invoiceBId }, select: { status: true } });
    const invB2 = await prisma.feeInvoice.findUnique({ where: { id: invoiceB2Id }, select: { status: true } });
    expect(invB?.status, 'статус B неизменён').toBe('pending');
    expect(invB2?.status, 'статус B2 неизменён').toBe('pending');

    const notes = await prisma.studentNote.count({ where: { studentId: studentBId, type: 'finance' } });
    expect(notes, 'StudentNote о переплате чужому ученику не создан').toBe(0);
  });

  test('scenario 4 (unknown invoice): несуществующий invoiceId → NOT_FOUND без побочек', async () => {
    const res = await ctx.post('/api/v1/payments', { data: { invoiceId: `${MARK}-nonexistent`, amount: 1000, method: 'нал' } });
    expect([403, 404], 'неизвестный счёт → штатный отказ').toContain(res.status());

    const notes = await prisma.studentNote.count({ where: { studentId: { in: [studentAId, studentBId] }, type: 'finance' } });
    expect(notes, 'побочных StudentNote не создано').toBe(0);
  });
});
