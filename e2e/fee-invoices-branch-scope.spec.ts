import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BASE_URL } from './helpers';

/**
 * Regression: fee-invoices/[id] must enforce branch isolation + field whitelist.
 *
 * Findings B-1 / B-2 — a branch-scoped accountant/finance_manager could, by direct
 * invoice id:
 *  - PUT: изменить счёт ЧУЖОГО филиала и (mass assignment) переписать любые поля
 *    (studentId/contractId/...), т.к. body уходил в prisma.update целиком;
 *  - DELETE: удалить счёт чужого филиала (cascade сносит его Payment-ы).
 *
 * Данные создаются детерминированно через Prisma (свои филиалы A/B, свой бухгалтер
 * филиала A, ученик B в филиале B с активным договором, счётом и платежом). Атакующий
 * филиал зашивается в JWT при СВЕЖЕМ логине, поэтому создаём и логиним отдельного
 * бухгалтера, а не берём сид.
 *
 * Требует запущенный dev-сервер (npm run dev) + локальный Postgres из .env.
 */

const prisma = new PrismaClient();
const MARK = 'e2e-fi-branch';
const STAFF_LOGIN = `${MARK}-accountant`;
const STAFF_PW = 'Test_erudit_2026';

let ctx: APIRequestContext; // авторизован как бухгалтер филиала A
let branchAId = '';
let branchBId = '';
let staffUserId = '';
let studentAId = '';
let studentBId = '';
let invoiceAId = '';
let invoiceA2Id = '';
let invoiceBId = '';
let contractBId = '';
let paymentBId = '';

/** Программный логин NextAuth (credentials) → контекст с session-cookie. */
async function loginCtx(login: string, password: string): Promise<APIRequestContext> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  const { csrfToken } = (await (await c.get('/api/auth/csrf')).json()) as { csrfToken: string };
  await c.post('/api/auth/callback/credentials', {
    form: { csrfToken, login, password, json: 'true' },
  });
  return c;
}

test.describe('fee-invoices: branch isolation + whitelist (FAILURE = cross-branch write / mass assignment)', () => {
  test.beforeAll(async () => {
    // student.classId обязателен — переиспользуем любой существующий класс из сида.
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
      data: {
        login: STAFF_LOGIN,
        password: await hash(STAFF_PW, 10),
        role: 'accountant',
        isActive: true,
        branchId: branchAId,
      },
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

    // Счёт своего филиала (A) — для позитивного PUT и доказательства mass assignment.
    const invoiceA = await prisma.feeInvoice.create({
      data: { studentId: studentAId, title: `${MARK} A tuition`, amount: 50000, status: 'pending', dueDate: new Date('2026-09-10') },
      select: { id: true },
    });
    invoiceAId = invoiceA.id;

    // Отдельный счёт филиала A — исключительно под позитивный DELETE (чтобы не рушить invoiceA).
    const invoiceA2 = await prisma.feeInvoice.create({
      data: { studentId: studentAId, title: `${MARK} A disposable`, amount: 10000, status: 'pending' },
      select: { id: true },
    });
    invoiceA2Id = invoiceA2.id;

    // Договор + счёт + платёж филиала B — цель кросс-филиальной атаки.
    const contractB = await prisma.contract.create({
      data: {
        number: `${MARK}-B`,
        studentId: studentBId,
        branchId: branchBId,
        year: '2026–2027',
        baseAmount: 100000,
        amount: 100000,
        status: 'active',
        createdById: staffUserId,
      },
      select: { id: true },
    });
    contractBId = contractB.id;

    const invoiceB = await prisma.feeInvoice.create({
      data: { studentId: studentBId, contractId: contractBId, title: `${MARK} B tuition`, amount: 100000, status: 'pending', dueDate: new Date('2026-09-10') },
      select: { id: true },
    });
    invoiceBId = invoiceB.id;

    const paymentB = await prisma.payment.create({
      data: { invoiceId: invoiceBId, amount: 30000, method: 'нал', verified: true },
      select: { id: true },
    });
    paymentBId = paymentB.id;

    ctx = await loginCtx(STAFF_LOGIN, STAFF_PW);
    const me = (await (await ctx.get('/api/auth/session')).json()) as { user?: { role?: string } };
    expect(me?.user?.role, 'бухгалтер филиала A должен быть залогинен').toBe('accountant');
  });

  test.afterAll(async () => {
    // Teardown в порядке FK. Всё помечено MARK — чужого не трогаем.
    await prisma.payment.deleteMany({ where: { invoice: { studentId: { in: [studentAId, studentBId] } } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.contract.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId] } } });
    await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    await ctx?.dispose();
    await prisma.$disconnect();
  });

  // --- PUT ---

  test('PUT 1: бухгалтер филиала A МОЖЕТ изменить разрешённое поле счёта своего филиала', async () => {
    const res = await ctx.put(`/api/v1/fee-invoices/${invoiceAId}`, {
      data: { title: `${MARK} A updated`, period: 'сентябрь', amount: 55000, status: 'partial', dueDate: new Date('2026-10-10').toISOString() },
    });
    expect(res.status(), 'правка счёта своего филиала разрешена').toBe(200);
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceAId }, select: { title: true, amount: true, status: true } });
    expect(inv?.title, 'title должен обновиться').toBe(`${MARK} A updated`);
    expect(inv?.amount, 'amount должен обновиться').toBe(55000);
    expect(inv?.status, 'status должен обновиться').toBe('partial');
  });

  test('PUT 2: бухгалтер филиала A НЕ МОЖЕТ изменить счёт филиала B по прямому id', async () => {
    const res = await ctx.put(`/api/v1/fee-invoices/${invoiceBId}`, {
      data: { amount: 1, status: 'paid', title: 'HACKED' },
    });
    expect([403, 404], 'кросс-филиальная правка счёта должна быть запрещена').toContain(res.status());

    // Счёт B не должен измениться.
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceBId }, select: { amount: true, status: true, studentId: true, contractId: true, dueDate: true, title: true } });
    expect(inv?.amount, 'amount B неизменен').toBe(100000);
    expect(inv?.status, 'status B неизменен').toBe('pending');
    expect(inv?.studentId, 'studentId B неизменен').toBe(studentBId);
    expect(inv?.contractId, 'contractId B неизменен').toBe(contractBId);
    expect(inv?.title, 'title B неизменен').toBe(`${MARK} B tuition`);

    // Платёж B не должен измениться/удалиться.
    const pay = await prisma.payment.findUnique({ where: { id: paymentBId }, select: { amount: true, verified: true } });
    expect(pay, 'платёж B должен существовать').not.toBeNull();
    expect(pay?.amount, 'сумма платежа B неизменна').toBe(30000);
  });

  test('PUT 3: mass assignment — тело НЕ должно переписывать системные поля (studentId/contractId)', async () => {
    // Легальная правка своего счёта, но с попыткой протащить studentId/contractId чужого.
    const res = await ctx.put(`/api/v1/fee-invoices/${invoiceAId}`, {
      data: { title: `${MARK} A whitelist`, studentId: studentBId, contractId: contractBId, id: 'evil-id' },
    });
    // Статус может быть 200 (правка своего счёта легальна), но системные поля должны игнорироваться.
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceAId }, select: { studentId: true, contractId: true } });
    expect(res.status(), 'запрос по своему счёту не должен падать сервером').toBeLessThan(500);
    expect(inv?.studentId, 'studentId нельзя переписать через body (mass assignment)').toBe(studentAId);
    expect(inv?.contractId, 'contractId нельзя переписать через body (mass assignment)').toBeNull();
  });

  // --- DELETE ---

  test('DELETE 1: бухгалтер филиала A МОЖЕТ удалить счёт своего филиала', async () => {
    const res = await ctx.delete(`/api/v1/fee-invoices/${invoiceA2Id}`);
    expect(res.status(), 'удаление счёта своего филиала разрешено политикой').toBe(200);
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceA2Id }, select: { id: true } });
    expect(inv, 'счёт A2 должен быть удалён').toBeNull();
  });

  test('DELETE 2: бухгалтер филиала A НЕ МОЖЕТ удалить счёт филиала B по прямому id', async () => {
    const res = await ctx.delete(`/api/v1/fee-invoices/${invoiceBId}`);
    expect([403, 404], 'кросс-филиальное удаление счёта должно быть запрещено').toContain(res.status());

    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceBId }, select: { id: true, amount: true, status: true } });
    expect(inv, 'счёт B должен остаться в БД').not.toBeNull();
    expect(inv?.status, 'статус счёта B неизменен').toBe('pending');

    const pay = await prisma.payment.findUnique({ where: { id: paymentBId }, select: { id: true } });
    expect(pay, 'платёж B должен остаться в БД').not.toBeNull();

    const contract = await prisma.contract.findUnique({ where: { id: contractBId }, select: { status: true } });
    expect(contract?.status, 'договор B неизменен').toBe('active');

    const student = await prisma.student.findUnique({ where: { id: studentBId }, select: { status: true } });
    expect(student?.status, 'ученик B неизменен').toBe('permanent');
  });
});
