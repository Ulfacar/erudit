import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BASE_URL } from './helpers';

/**
 * Regression: PATCH /api/v1/payments/[id] must enforce branch isolation.
 *
 * Finding E-2 — branch-scoped accountant/finance_manager филиала A мог передать
 * paymentId платежа филиала B и изменить подтверждение (verified true↔false),
 * пересчитать статус чужого invoice и прикрепить чек (receiptBase64 → MinIO).
 *
 * Данные создаются детерминированно через Prisma. Атакующий филиал зашивается в JWT
 * при СВЕЖЕМ логине, поэтому создаём и логиним отдельного бухгалтера филиала A.
 *
 * Требует запущенный dev-сервер (npm run dev) + локальный Postgres из .env.
 */

const prisma = new PrismaClient();
const MARK = 'e2e-paypatch-branch';
const STAFF_LOGIN = `${MARK}-accountant`;
const STAFF_PW = 'Test_erudit_2026';
// 1x1 PNG data URL — валидный вход для dataUrlToBuffer (receipt).
const RECEIPT_DATAURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let ctx: APIRequestContext; // бухгалтер филиала A
let branchAId = '';
let branchBId = '';
let staffUserId = '';
let studentAId = '';
let studentBId = '';
let invoiceAId = '';
let invoiceBId = '';
let invoiceB2Id = '';
let paymentAId = '';
let paymentBId = '';
let paymentB2Id = '';

async function loginCtx(login: string, password: string): Promise<APIRequestContext> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  const { csrfToken } = (await (await c.get('/api/auth/csrf')).json()) as { csrfToken: string };
  await c.post('/api/auth/callback/credentials', { form: { csrfToken, login, password, json: 'true' } });
  return c;
}

test.describe('payments PATCH: branch isolation (FAILURE = cross-branch confirm/revoke)', () => {
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

    const studentA = await prisma.student.create({ data: { firstName: 'A', lastName: MARK, classId, branchId: branchAId, status: 'permanent' }, select: { id: true } });
    studentAId = studentA.id;
    const studentB = await prisma.student.create({ data: { firstName: 'B', lastName: MARK, classId, branchId: branchBId, status: 'permanent' }, select: { id: true } });
    studentBId = studentB.id;

    // Свой счёт+платёж (A): платёж пока не verified, счёт pending → PATCH verified:true сделает paid.
    const invoiceA = await prisma.feeInvoice.create({ data: { studentId: studentAId, title: `${MARK} A`, amount: 50000, status: 'pending' }, select: { id: true } });
    invoiceAId = invoiceA.id;
    const paymentA = await prisma.payment.create({ data: { invoiceId: invoiceAId, amount: 50000, method: 'нал', verified: false }, select: { id: true } });
    paymentAId = paymentA.id;

    // Чужой счёт B + verified платёж → счёт paid. Для сценария revoke + receipt.
    const invoiceB = await prisma.feeInvoice.create({ data: { studentId: studentBId, title: `${MARK} B`, amount: 100000, status: 'paid' }, select: { id: true } });
    invoiceBId = invoiceB.id;
    const paymentB = await prisma.payment.create({ data: { invoiceId: invoiceBId, amount: 100000, method: 'нал', verified: true, verifiedBy: staffUserId, verifiedAt: new Date('2026-07-01') }, select: { id: true } });
    paymentBId = paymentB.id;

    // Чужой счёт B2 + unverified платёж → счёт pending. Для сценария confirm.
    const invoiceB2 = await prisma.feeInvoice.create({ data: { studentId: studentBId, title: `${MARK} B2`, amount: 100000, status: 'pending' }, select: { id: true } });
    invoiceB2Id = invoiceB2.id;
    const paymentB2 = await prisma.payment.create({ data: { invoiceId: invoiceB2Id, amount: 100000, method: 'нал', verified: false }, select: { id: true } });
    paymentB2Id = paymentB2.id;

    ctx = await loginCtx(STAFF_LOGIN, STAFF_PW);
    const me = (await (await ctx.get('/api/auth/session')).json()) as { user?: { role?: string } };
    expect(me?.user?.role, 'бухгалтер филиала A должен быть залогинен').toBe('accountant');
  });

  test.afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoice: { studentId: { in: [studentAId, studentBId] } } } });
    await prisma.studentNote.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
    await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId] } } });
    await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    await ctx?.dispose();
    await prisma.$disconnect();
  });

  test('scenario 1 (positive confirm): бухгалтер A подтверждает свой платёж', async () => {
    const res = await ctx.patch(`/api/v1/payments/${paymentAId}`, { data: { verified: true } });
    expect(res.status(), 'подтверждение своего платежа разрешено').toBe(200);
    const json = (await res.json()) as { data?: { verified?: boolean; invoice?: { status?: string } } };
    expect(json.data?.verified, 'ответ: verified=true').toBe(true);
    expect(json.data?.invoice?.status, 'ответ: счёт A пересчитан в paid').toBe('paid');

    const pay = await prisma.payment.findUnique({ where: { id: paymentAId }, select: { verified: true } });
    expect(pay?.verified, 'payment A verified=true').toBe(true);
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceAId }, select: { status: true } });
    expect(inv?.status, 'счёт A → paid').toBe('paid');
  });

  test('scenario 2 (cross-branch revoke): снятие подтверждения с платежа B запрещено', async () => {
    const res = await ctx.patch(`/api/v1/payments/${paymentBId}`, { data: { verified: false } });
    expect([403, 404], 'кросс-филиальный revoke запрещён').toContain(res.status());

    const pay = await prisma.payment.findUnique({ where: { id: paymentBId }, select: { verified: true, receiptKey: true, method: true } });
    expect(pay?.verified, 'verified платежа B неизменён (true)').toBe(true);
    expect(pay?.receiptKey, 'receipt платежа B неизменён (null)').toBeNull();
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceBId }, select: { status: true } });
    expect(inv?.status, 'статус счёта B неизменён (paid)').toBe('paid');
  });

  test('scenario 3 (cross-branch confirm): подтверждение платежа B запрещено', async () => {
    const res = await ctx.patch(`/api/v1/payments/${paymentB2Id}`, { data: { verified: true } });
    expect([403, 404], 'кросс-филиальный confirm запрещён').toContain(res.status());

    const pay = await prisma.payment.findUnique({ where: { id: paymentB2Id }, select: { verified: true } });
    expect(pay?.verified, 'verified платежа B2 остаётся false').toBe(false);
    const inv = await prisma.feeInvoice.findUnique({ where: { id: invoiceB2Id }, select: { status: true } });
    expect(inv?.status, 'счёт B2 не пересчитан (pending)').toBe('pending');
  });

  test('scenario 4 (cross-branch receipt mutation): чек чужого платежа менять нельзя', async () => {
    // method добавлен, чтобы data была непустой независимо от состояния MinIO.
    const res = await ctx.patch(`/api/v1/payments/${paymentBId}`, { data: { receiptBase64: RECEIPT_DATAURL, method: 'карта' } });
    expect([403, 404], 'кросс-филиальная правка чека запрещена').toContain(res.status());

    const pay = await prisma.payment.findUnique({ where: { id: paymentBId }, select: { receiptKey: true, method: true, verified: true } });
    expect(pay?.receiptKey, 'receiptKey платежа B неизменён (null)').toBeNull();
    expect(pay?.method, 'method платежа B неизменён (нал)').toBe('нал');
    expect(pay?.verified, 'verified платежа B неизменён (true)').toBe(true);
  });

  test('scenario 5 (unknown payment): несуществующий paymentId → отказ без побочек', async () => {
    const res = await ctx.patch(`/api/v1/payments/${MARK}-nonexistent`, { data: { verified: true } });
    expect([403, 404], 'неизвестный платёж → штатный отказ').toContain(res.status());
  });
});
