import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiAs, type Envelope } from './helpers';

type PsyCase = {
  id: string;
  subjectType: string;
  studentId: string | null;
  subjectDisplay: string;
};

const CODE_RE = /^У-\d+/; // формат конфиденциального кода участника

test.describe('CR-015 — матрица видимости ФИО/код (FAILURE = утечка ПДн)', () => {
  let admin: APIRequestContext;
  let psychologist: APIRequestContext;
  let senior: APIRequestContext;
  let coordinator: APIRequestContext;
  let targetId = '';

  test.beforeAll(async () => {
    admin = await apiAs('super_admin');
    psychologist = await apiAs('psychologist');
    senior = await apiAs('senior_psychologist');
    coordinator = await apiAs('psy_coordinator');

    const cases = ((await (await admin.get('/api/v1/psy/cases')).json()) as Envelope<PsyCase[]>)
      .data ?? [];
    targetId = cases.find((c) => c.subjectType === 'student' && c.studentId != null)?.id ?? '';
  });

  test.afterAll(async () => {
    await admin.dispose();
    await psychologist.dispose();
    await senior.dispose();
    await coordinator.dispose();
  });

  async function displayFor(ctx: APIRequestContext, id: string): Promise<string | null> {
    const cases = ((await (await ctx.get('/api/v1/psy/cases')).json()) as Envelope<PsyCase[]>)
      .data ?? [];
    return cases.find((c) => c.id === id)?.subjectDisplay ?? null;
  }

  test('ведущий психолог (owner) видит ФИО', async () => {
    test.skip(!targetId, 'нет засеянного student-кейса');

    const display = await displayFor(psychologist, targetId);
    expect(display).toBeTruthy();
    expect(display ?? '').not.toMatch(CODE_RE);
  });

  test('старший психолог видит КОД, а не ФИО', async () => {
    test.skip(!targetId, 'нет засеянного student-кейса');

    const display = await displayFor(senior, targetId);
    expect(display ?? '').toMatch(CODE_RE);
  });

  test('координатор ПС видит ФИО', async () => {
    test.skip(!targetId, 'нет засеянного student-кейса');

    const display = await displayFor(coordinator, targetId);
    expect(display).toBeTruthy();
    expect(display ?? '').not.toMatch(CODE_RE);
  });

  test('деталь кейса для старшего психолога маскирована', async () => {
    test.skip(!targetId, 'нет засеянного student-кейса');

    const res = await senior.get(`/api/v1/psy/cases/${targetId}`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<
      PsyCase & {
        subjectName: string | null;
        firstName?: string;
        lastName?: string;
        psyCode?: string;
      }
    >;

    expect(json.data?.subjectDisplay ?? '').toMatch(CODE_RE);
    expect(json.data?.subjectName).toBeNull();
    expect(json.data).not.toHaveProperty('firstName');
    expect(json.data).not.toHaveProperty('lastName');
    expect(json.data).not.toHaveProperty('psyCode');
  });
});
