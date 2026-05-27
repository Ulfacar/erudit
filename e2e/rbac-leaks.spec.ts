import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiAs, type Envelope } from './helpers';

/**
 * Each test below asserts the SECURE expectation. A FAILING test here is a real
 * RBAC / data-disclosure vulnerability present in the running app — these are the
 * findings, not flaky tests. See the accompanying bug report.
 *
 * Root cause: the affected GET handlers call `withAuth(request)` with no `roles`
 * option and no ownership check, so any authenticated user (incl. student/parent)
 * can read data scoped to other people / classes / staff.
 */
test.describe('RBAC & data-leak expectations  (a FAILURE = a vulnerability)', () => {
  let admin: APIRequestContext;
  let student: APIRequestContext;
  let parent: APIRequestContext;
  let someClassId = '';
  let someTeacherId = '';

  test.beforeAll(async () => {
    admin = await apiAs('super_admin');
    student = await apiAs('student');
    parent = await apiAs('parent');

    const wl = (
      (await (await admin.get('/api/v1/workload')).json()) as Envelope<{
        teachers: Array<{ id: string }>;
        classes: Array<{ id: string }>;
      }>
    ).data!;
    someTeacherId = wl.teachers[0].id;
    someClassId = wl.classes[0].id;
  });
  test.afterAll(async () => {
    await admin.dispose();
    await student.dispose();
    await parent.dispose();
  });

  test('student cannot read an arbitrary class journal', async () => {
    const res = await student.get(`/api/v1/grading/class-journal?classId=${someClassId}`);
    expect(res.status(), 'student should be denied an arbitrary class journal').toBe(403);
  });

  test('parent cannot read an arbitrary class journal', async () => {
    const res = await parent.get(`/api/v1/grading/class-journal?classId=${someClassId}`);
    expect(res.status(), 'parent should be denied an arbitrary class journal').toBe(403);
  });

  test('student cannot read teacher load-transfer history (grades leak)', async () => {
    const res = await student.get(`/api/v1/workload/transfer?toTeacherId=${someTeacherId}`);
    expect(res.status(), 'workload/transfer GET must restrict by role/ownership').toBe(403);
  });

  test('student cannot list all staff (email/role disclosure)', async () => {
    const res = await student.get('/api/v1/teachers');
    expect(res.status(), 'student should not enumerate staff').toBe(403);
  });

  test('student cannot read the school-wide grading overview', async () => {
    const res = await student.get('/api/v1/grading/overview');
    expect(res.status(), 'student should not read the grading overview').toBe(403);
  });
});
