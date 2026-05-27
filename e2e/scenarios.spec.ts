import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiAs, storageStateFor, type Envelope } from './helpers';

/* ───────────────────────── Scenario A — grade moderation chain ───────────────────────── */
test.describe('Scenario A — grade moderation (teacher → zavuch → analyst)', () => {
  test.use({ storageState: storageStateFor('zavuch') });
  let zavuch: APIRequestContext;
  let analyst: APIRequestContext;

  test.beforeAll(async () => {
    zavuch = await apiAs('zavuch');
    analyst = await apiAs('analyst');
  });
  test.afterAll(async () => {
    await zavuch.dispose();
    await analyst.dispose();
  });

  test('moderation page renders for zavuch (not gated)', async ({ page }) => {
    await page.goto('/grading/moderation');
    await expect(page.getByText('Доступ ограничен')).toHaveCount(0);
  });

  test('status machine: submitted →(zavuch)→ moderated →(analyst)→ published', async () => {
    const listRes = await zavuch.get('/api/v1/grading/moderation?status=submitted');
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as Envelope<Array<{ id: string }>>;
    expect(list.success).toBeTruthy();
    expect(
      list.data!.length,
      'expected at least one submitted grade from the demo seed',
    ).toBeGreaterThan(0);

    const gradeId = list.data![0].id;

    const zav = await zavuch.put('/api/v1/grading/moderation', {
      data: { gradeIds: [gradeId], action: 'approve' },
    });
    expect(zav.ok()).toBeTruthy();
    const zres = (await zav.json()) as Envelope<Array<{ newStatus?: string; error?: string }>>;
    expect(zres.data![0].newStatus, JSON.stringify(zres.data![0])).toBe('moderated');

    const an = await analyst.put('/api/v1/grading/moderation', {
      data: { gradeIds: [gradeId], action: 'approve' },
    });
    expect(an.ok()).toBeTruthy();
    const ares = (await an.json()) as Envelope<Array<{ newStatus?: string }>>;
    expect(ares.data![0].newStatus).toBe('published');
  });

  test('teacher is forbidden from the moderation API', async () => {
    const teacher = await apiAs('teacher');
    const res = await teacher.put('/api/v1/grading/moderation', {
      data: { gradeIds: ['x'], action: 'approve' },
    });
    expect(res.status()).toBe(403);
    await teacher.dispose();
  });
});

/* ───────────────────────── Scenario B — teacher load transfer ───────────────────────── */
test.describe('Scenario B — teacher load transfer', () => {
  test.use({ storageState: storageStateFor('zavuch') });
  let zavuch: APIRequestContext;

  test.beforeAll(async () => {
    zavuch = await apiAs('zavuch');
  });
  test.afterAll(async () => {
    await zavuch.dispose();
  });

  test('workload page renders for zavuch (not gated)', async ({ page }) => {
    await page.goto('/teachers/workload');
    await expect(page.getByText('Доступ ограничен')).toHaveCount(0);
  });

  test('transfer reassigns load and exposes read-only history', async () => {
    const wl = (
      (await (await zavuch.get('/api/v1/workload')).json()) as Envelope<{
        teachers: Array<{ id: string }>;
        workloadMap: Record<string, Record<string, Array<{ subjectId: string }>>>;
      }>
    ).data!;

    let fromTeacherId = '';
    let classId = '';
    let subjectId = '';
    for (const [tId, byClass] of Object.entries(wl.workloadMap)) {
      const entries = Object.entries(byClass);
      if (entries.length && entries[0][1].length) {
        fromTeacherId = tId;
        classId = entries[0][0];
        subjectId = entries[0][1][0].subjectId;
        break;
      }
    }
    expect(fromTeacherId, 'need a teacher with an existing load to transfer').not.toBe('');
    const toTeacherId = wl.teachers.find((t) => t.id !== fromTeacherId)!.id;

    const res = await zavuch.post('/api/v1/workload/transfer', {
      data: { fromTeacherId, toTeacherId, subjectId, classId, reason: 'E2E test transfer' },
    });
    expect(res.status(), await res.text()).toBe(201);
    const created = (await res.json()).data;
    expect(created.toTeacherId).toBe(toTeacherId);

    const hist = (
      (await (await zavuch.get(`/api/v1/workload/transfer?toTeacherId=${toTeacherId}`)).json()) as Envelope<
        Array<{ transfer: { fromTeacherId: string; subjectId: string }; readonlyGrades: unknown[]; readonlySchedule: unknown[] }>
      >
    ).data!;
    expect(
      hist.some((e) => e.transfer.fromTeacherId === fromTeacherId && e.transfer.subjectId === subjectId),
      'recipient history should include the new transfer',
    ).toBeTruthy();
    expect(hist[0]).toHaveProperty('readonlyGrades');
    expect(hist[0]).toHaveProperty('readonlySchedule');
  });
});

/* ───────────────────────── Scenario C — descriptor access levels ───────────────────────── */
test.describe('Scenario C — teacher descriptors L1/L2/L3 visibility', () => {
  let zavuch: APIRequestContext;
  let self: APIRequestContext;
  let teacherId = '';

  test.beforeAll(async () => {
    zavuch = await apiAs('zavuch');
    self = await apiAs('khaydarova');
    const data = (
      (await (await zavuch.get('/api/v1/teachers')).json()) as Envelope<Array<{ id: string; lastName: string }>>
    ).data!;
    teacherId = data.find((t) => /Хайдар/i.test(t.lastName))?.id ?? '';
  });
  test.afterAll(async () => {
    await zavuch.dispose();
    await self.dispose();
  });

  test('khaydarova located via /api/v1/teachers', () => {
    expect(teacherId, 'khaydarova not found in teachers list').not.toBe('');
  });

  test('zavuch sees the L2 descriptor (and nothing above L2)', async () => {
    const ds = (
      (await (await zavuch.get(`/api/v1/teachers/${teacherId}/descriptors`)).json()) as Envelope<Array<{ accessLevel: number }>>
    ).data!;
    expect(ds.length, 'zavuch should see descriptors').toBeGreaterThan(0);
    expect(Math.max(...ds.map((d) => d.accessLevel))).toBeLessThanOrEqual(2);
    expect(ds.some((d) => d.accessLevel === 2), 'zavuch should see at least one L2').toBeTruthy();
  });

  test('teacher does NOT see her own L2/L3 descriptors (key demo fact)', async () => {
    const ds = (
      (await (await self.get(`/api/v1/teachers/${teacherId}/descriptors`)).json()) as Envelope<Array<{ accessLevel: number }>>
    ).data!;
    expect(ds.every((d) => d.accessLevel === 1), 'self must only ever see L1 descriptors').toBeTruthy();
  });
});
