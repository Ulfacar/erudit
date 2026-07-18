import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BASE_URL } from './helpers';

/**
 * Regression: POST /api/v1/withdrawals must enforce branch isolation.
 *
 * A FAILURE of scenario 2 here is finding C — a branch-scoped staff member
 * (secretary/zavuch) отчисляет ученика ЧУЖОГО филиала по прямому studentId,
 * что деструктивно (status=withdrawn + отмена счетов + отмена договора + note).
 *
 * Данные создаются детерминированно через Prisma (свои филиалы A/B, свой
 * секретарь филиала A, ученик B в филиале B с активным договором и неоплаченным
 * счётом). Атакующий филиал контролируется через СВЕЖИЙ логин (branchId зашивается
 * в JWT на входе), поэтому создаём и логиним отдельного секретаря, а не берём сид.
 *
 * Требует запущенный dev-сервер (npm run dev) + локальный Postgres из .env.
 */

const prisma = new PrismaClient();
const MARK = 'e2e-wd-branch';
const STAFF_LOGIN = `${MARK}-secretary`;
const STAFF_PW = 'Test_erudit_2026';

let ctx: APIRequestContext; // авторизован как секретарь филиала A
let branchAId = '';
let branchBId = '';
let staffUserId = '';
let studentAId = '';
let studentBId = '';
let contractBId = '';
let invoiceBId = '';

/** Программный логин NextAuth (credentials) → контекст с session-cookie. */
async function loginCtx(login: string, password: string): Promise<APIRequestContext> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  const { csrfToken } = (await (await c.get('/api/auth/csrf')).json()) as { csrfToken: string };
  await c.post('/api/auth/callback/credentials', {
    form: { csrfToken, login, password, json: 'true' },
  });
  return c;
}

test.describe('withdrawals: branch isolation (FAILURE = cross-branch withdrawal)', () => {
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
        role: 'secretary',
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
      data: {
        studentId: studentBId,
        contractId: contractBId,
        title: `${MARK} tuition`,
        amount: 100000,
        status: 'pending',
      },
      select: { id: true },
    });
    invoiceBId = invoiceB.id;

    ctx = await loginCtx(STAFF_LOGIN, STAFF_PW);
    const me = (await (await ctx.get('/api/auth/session')).json()) as { user?: { role?: string } };
    expect(me?.user?.role, 'секретарь филиала A должен быть залогинен').toBe('secretary');
  });

  test.afterAll(async () => {
    // Teardown в порядке FK. Всё помечено MARK — чужого не трогаем.
    await prisma.withdrawal.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.studentNote.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.contract.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId] } } });
    await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    await ctx?.dispose();
    await prisma.$disconnect();
  });

  test('scenario 1: секретарь филиала A МОЖЕТ отчислить ученика своего филиала', async () => {
    const res = await ctx.post('/api/v1/withdrawals', {
      data: { studentId: studentAId, reason: 'e2e same-branch (разрешено политикой)' },
    });
    expect(res.status(), 'отчисление в своём филиале разрешено политикой').toBe(200);
  });

  test('scenario 2: секретарь филиала A НЕ МОЖЕТ отчислить ученика филиала B по прямому id', async () => {
    const res = await ctx.post('/api/v1/withdrawals', {
      data: { studentId: studentBId, reason: 'e2e cross-branch attack' },
    });
    expect([403, 404], 'кросс-филиальное отчисление должно быть запрещено').toContain(res.status());

    // Побочных эффектов на ученике B быть не должно.
    const student = await prisma.student.findUnique({ where: { id: studentBId }, select: { status: true } });
    expect(student?.status, 'статус ученика B не должен измениться').toBe('permanent');

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: invoiceBId }, select: { status: true } });
    expect(invoice?.status, 'счёт B не должен быть отменён').toBe('pending');

    const contract = await prisma.contract.findUnique({ where: { id: contractBId }, select: { status: true } });
    expect(contract?.status, 'договор B не должен быть отменён').toBe('active');

    const wdCount = await prisma.withdrawal.count({ where: { studentId: studentBId } });
    expect(wdCount, 'запись об отчислении B создаваться не должна').toBe(0);

    const noteCount = await prisma.studentNote.count({ where: { studentId: studentBId } });
    expect(noteCount, 'служебная заметка по B создаваться не должна').toBe(0);

    // POST /withdrawals не эмитит доменное событие (emitEvent) — проверять нечего.
  });
});
