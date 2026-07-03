import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiAs, type Envelope } from './helpers';

/**
 * Фаза 1 (эта сессия): проверки для 7 закрытых утечек, которых нет в rbac-leaks.spec.ts.
 * ПРОВАЛ теста = реальная уязвимость (роль видит чужое). Часть кейсов зависит от данных
 * в локальной БД и при их отсутствии корректно пропускается (test.skip).
 */
test.describe('RBAC Фаза 1 — новые фиксы (FAILURE = уязвимость)', () => {
  let admin: APIRequestContext;
  let student: APIRequestContext;
  let parent: APIRequestContext;

  let ownStudentId = '';
  let ownClassId = '';
  let foreignClassId = '';
  let foreignGradeId = '';
  let foreignStudentId = '';
  let someTeacherId = '';

  test.beforeAll(async () => {
    admin = await apiAs('super_admin');
    student = await apiAs('student');
    parent = await apiAs('parent');

    const me = (
      (await (await student.get('/api/v1/me')).json()) as Envelope<{
        studentId: string;
        student?: { classId: string | null };
      }>
    ).data!;
    ownStudentId = me.studentId ?? '';
    ownClassId = me.student?.classId ?? '';

    // Чужой класс — любой, отличный от собственного.
    const classes = (
      (await (await admin.get('/api/v1/classes')).json()) as Envelope<Array<{ id: string }>>
    ).data ?? [];
    foreignClassId = classes.find((c) => c.id !== ownClassId)?.id ?? '';

    // Чужая оценка — grade, принадлежащий не нашему ученику.
    const grades = (
      (await (await admin.get('/api/v1/grading')).json()) as Envelope<
        Array<{ id: string; student: { id: string } }>
      >
    ).data ?? [];
    const foreign = grades.find((g) => g.student?.id && g.student.id !== ownStudentId);
    foreignGradeId = foreign?.id ?? '';
    foreignStudentId = foreign?.student.id ?? '';

    const wl = (
      (await (await admin.get('/api/v1/workload')).json()) as Envelope<{
        teachers: Array<{ id: string }>;
      }>
    ).data;
    someTeacherId = wl?.teachers?.[0]?.id ?? '';
  });

  test.afterAll(async () => {
    await admin.dispose();
    await student.dispose();
    await parent.dispose();
  });

  test('student не читает ростер чужого класса (classes/[id])', async () => {
    test.skip(!foreignClassId, 'нет второго класса в БД');
    const res = await student.get(`/api/v1/classes/${foreignClassId}`);
    expect(res.status(), 'ростер чужого класса должен быть запрещён').toBe(403);
  });

  test('student не может подменить studentId в списке оценок (grading)', async () => {
    test.skip(!foreignStudentId, 'нет чужих оценок в БД');
    const res = await student.get(`/api/v1/grading?studentId=${foreignStudentId}`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<Array<{ student: { id: string } }>>;
    for (const g of json.data ?? []) {
      expect(g.student.id, `утекла чужая оценка ученика ${g.student.id}`).toBe(ownStudentId);
    }
  });

  test('student не читает чужую оценку по id (grading/[id])', async () => {
    test.skip(!foreignGradeId, 'нет чужих оценок в БД');
    const res = await student.get(`/api/v1/grading/${foreignGradeId}`);
    expect(res.status(), 'чужая оценка по id должна быть запрещена').toBe(403);
  });

  test('student не читает средневзвешенные класса (grading/weighted-average)', async () => {
    const res = await student.get(
      `/api/v1/grading/weighted-average?classId=${ownClassId || 'x'}&subjectId=x&periodId=x`,
    );
    expect(res.status(), 'рейтинг класса — только staff').toBe(403);
  });

  test('student не читает заметки по ученику (students/[id]/notes)', async () => {
    const res = await student.get(`/api/v1/students/${ownStudentId || 'x'}/notes`);
    expect(res.status(), 'кросс-ролевые заметки — только staff').toBe(403);
  });

  test('parent не читает заметки по ученику (students/[id]/notes)', async () => {
    const res = await parent.get(`/api/v1/students/${ownStudentId || 'x'}/notes`);
    expect(res.status()).toBe(403);
  });

  test('student не читает очередь в класс (class-reserve, PII родителей)', async () => {
    const res = await student.get('/api/v1/class-reserve');
    expect(res.status()).toBe(403);
  });

  test('parent не читает очередь в класс (class-reserve)', async () => {
    const res = await parent.get('/api/v1/class-reserve');
    expect(res.status()).toBe(403);
  });

  test('карточка педагога не отдаёт PII учеников student-у (teachers/[id])', async () => {
    test.skip(!someTeacherId, 'нет педагога в БД');
    const res = await student.get(`/api/v1/teachers/${someTeacherId}`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<{
      curatorOf?: Array<{ students?: Array<Record<string, unknown>> }>;
    }>;
    for (const klass of json.data?.curatorOf ?? []) {
      for (const s of klass.students ?? []) {
        expect(s, 'дата рождения ученика не должна утекать').not.toHaveProperty('dateOfBirth');
        expect(s, 'связи с родителями не должны утекать').not.toHaveProperty('parentLinks');
        expect(s, 'оценки ученика не должны утекать').not.toHaveProperty('grades');
      }
    }
  });

  test('student не может редактировать чужой инцидент (incidents/[id] PUT)', async () => {
    const created = await admin.post('/api/v1/incidents', {
      data: { title: 'e2e leak probe', description: 'probe', type: 'other', severity: 'low' },
    });
    const id = ((await created.json()) as Envelope<{ id: string }>).data?.id;
    test.skip(!id, 'не удалось создать инцидент');
    const res = await student.put(`/api/v1/incidents/${id}`, { data: { status: 'closed' } });
    expect(res.status(), 'правка инцидента — только автор/staff').toBe(403);
  });

  test('student не может редактировать чужой срочный вопрос (urgent-issues/[id] PUT)', async () => {
    const created = await admin.post('/api/v1/urgent-issues', {
      data: { title: 'e2e leak probe', description: 'probe', priority: 'low' },
    });
    const id = ((await created.json()) as Envelope<{ id: string }>).data?.id;
    test.skip(!id, 'не удалось создать срочный вопрос');
    const res = await student.put(`/api/v1/urgent-issues/${id}`, { data: { status: 'closed' } });
    expect(res.status(), 'правка срочного вопроса — по видимости').toBe(403);
  });
});
