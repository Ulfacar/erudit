import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { hash } from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { BASE_URL } from './helpers';

/**
 * Regression: psychology privacy hotfix closes four data-security holes:
 * cross-branch subject-card disclosure, cross-branch case creation, trust in a
 * client-supplied screening score, and disclosure of clinical alert reasons.
 *
 * FAILURE of any scenario means a leak of personal or clinical data.
 * Requires a running dev server (npm run dev) and a seeded local Postgres.
 */

const prisma = new PrismaClient();
const MARK = 'e2e-psy-priv';
const PASSWORD = 'Test_erudit_2026';

let ctxPsyA: APIRequestContext;
let ctxZavuch: APIRequestContext;
let ctxSgLead: APIRequestContext;
let ctxAdmin: APIRequestContext;
let ctxSecretary: APIRequestContext;
let ctxStudent: APIRequestContext;
let branchAId = '';
let branchBId = '';
let psyAId = '';
let psyBId = '';
let zavuchId = '';
let sgLeadId = '';
let adminId = '';
let secretaryId = '';
let studentUserId = '';
let studentAId = '';
let studentALastName = '';
let studentBId = '';
let studentBLastName = '';
let screeningStudentId = '';
let parentUserId = '';
let parentBId = '';
let parentAUserId = '';
let parentAId = '';
let caseId = '';
let templateId = '';
let campaignId = '';
let alertId = '';

/** Программный логин NextAuth (credentials) → контекст с session-cookie. */
async function loginCtx(login: string, password: string): Promise<APIRequestContext> {
  const c = await pwRequest.newContext({ baseURL: BASE_URL });
  const { csrfToken } = (await (await c.get('/api/auth/csrf')).json()) as { csrfToken: string };
  await c.post('/api/auth/callback/credentials', {
    form: { csrfToken, login, password, json: 'true' },
  });
  return c;
}

test.describe('psychology privacy hotfix (FAILURE = утечка персональных/клинических данных)', () => {
  test.beforeAll(async () => {
    const anyClass = await prisma.class.findFirst({ select: { id: true, grade: true } });
    if (!anyClass) throw new Error('В базе нет классов — прогоните сид перед тестом');

    const [branchA, branchB] = await Promise.all([
      prisma.branch.create({ data: { name: `${MARK}-A` }, select: { id: true } }),
      prisma.branch.create({ data: { name: `${MARK}-B` }, select: { id: true } }),
    ]);
    branchAId = branchA.id;
    branchBId = branchB.id;

    const password = await hash(PASSWORD, 10);
    const [psyA, psyB, zavuch, sgLead, admin, secretary, studentUser, parentUser, parentAUser] = await Promise.all([
      prisma.user.create({ data: { login: `${MARK}-psy-a`, password, role: 'psychologist', isActive: true, branchId: branchAId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-psy-b`, password, role: 'psychologist', isActive: true, branchId: branchBId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-zavuch`, password, role: 'zavuch', isActive: true, branchId: branchAId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-sglead`, password, role: 'safeguarding_lead', isActive: true, branchId: branchAId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-admin`, password, role: 'super_admin', isActive: true, branchId: branchAId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-secretary`, password, role: 'secretary', isActive: true, branchId: branchAId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-student`, password, role: 'student', isActive: true, branchId: branchAId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-parent-b`, password, role: 'parent', isActive: true, branchId: branchBId }, select: { id: true } }),
      prisma.user.create({ data: { login: `${MARK}-parent-a`, password, role: 'parent', isActive: true, branchId: branchAId }, select: { id: true } }),
    ]);
    psyAId = psyA.id;
    psyBId = psyB.id;
    zavuchId = zavuch.id;
    sgLeadId = sgLead.id;
    adminId = admin.id;
    secretaryId = secretary.id;
    studentUserId = studentUser.id;
    parentUserId = parentUser.id;
    parentAUserId = parentAUser.id;

    const [studentA, studentB, screeningStudent] = await Promise.all([
      prisma.student.create({ data: { firstName: 'А', lastName: `${MARK}-student-a`, classId: anyClass.id, branchId: branchAId, psyCode: `${MARK}-CODE-A` }, select: { id: true, lastName: true } }),
      prisma.student.create({ data: { firstName: 'Б', lastName: `${MARK}-student-b`, classId: anyClass.id, branchId: branchBId }, select: { id: true, lastName: true } }),
      prisma.student.create({ data: { userId: studentUserId, firstName: 'С', lastName: `${MARK}-screening`, classId: anyClass.id, branchId: branchAId }, select: { id: true } }),
    ]);
    studentAId = studentA.id;
    studentALastName = studentA.lastName;
    studentBId = studentB.id;
    studentBLastName = studentB.lastName;
    screeningStudentId = screeningStudent.id;

    const parentB = await prisma.parent.create({
      data: { userId: parentUserId, firstName: 'Р', lastName: `${MARK}-parent` },
      select: { id: true },
    });
    parentBId = parentB.id;
    await prisma.parentStudent.create({ data: { parentId: parentBId, studentId: studentBId, relation: 'parent' } });

    const parentA = await prisma.parent.create({
      data: { userId: parentAUserId, firstName: 'Р', lastName: `${MARK}-parent-a` },
      select: { id: true },
    });
    parentAId = parentA.id;
    await prisma.parentStudent.create({ data: { parentId: parentAId, studentId: studentAId, relation: 'parent' } });

    const psyCase = await prisma.psyCase.create({
      data: { ownerId: psyBId, subjectType: 'student', subjectId: studentBId, studentId: studentBId, title: MARK, status: 'new' },
      select: { id: true },
    });
    caseId = psyCase.id;

    const template = await prisma.psyDiagnosticTemplate.create({
      data: { name: MARK, authorId: psyAId, schema: {}, scaleConfig: Prisma.DbNull },
      select: { id: true },
    });
    templateId = template.id;
    const campaign = await prisma.psyScreeningCampaign.create({
      data: { title: MARK, templateId, createdBy: psyAId, gradeBand: String(anyClass.grade), grade: anyClass.grade, status: 'active', riskThreshold: 5 },
      select: { id: true },
    });
    campaignId = campaign.id;

    const alert = await prisma.psyAlert.create({
      data: { caseId, reason: `${MARK} клиническое обоснование`, status: 'open' },
      select: { id: true },
    });
    alertId = alert.id;

    [ctxPsyA, ctxZavuch, ctxSgLead, ctxAdmin, ctxSecretary, ctxStudent] = await Promise.all([
      loginCtx(`${MARK}-psy-a`, PASSWORD),
      loginCtx(`${MARK}-zavuch`, PASSWORD),
      loginCtx(`${MARK}-sglead`, PASSWORD),
      loginCtx(`${MARK}-admin`, PASSWORD),
      loginCtx(`${MARK}-secretary`, PASSWORD),
      loginCtx(`${MARK}-student`, PASSWORD),
    ]);
    const sessions = await Promise.all([ctxPsyA, ctxZavuch, ctxSgLead, ctxAdmin, ctxSecretary, ctxStudent].map(async (ctx) => (await (await ctx.get('/api/auth/session')).json()) as { user?: { role?: string } }));
    expect(sessions[0]?.user?.role, 'психолог филиала A должен быть залогинен').toBe('psychologist');
    expect(sessions[1]?.user?.role, 'завуч филиала A должен быть залогинен').toBe('zavuch');
    expect(sessions[2]?.user?.role, 'ответственный за защиту детей должен быть залогинен').toBe('safeguarding_lead');
    expect(sessions[3]?.user?.role, 'директор должен быть залогинен как super_admin').toBe('super_admin');
    expect(sessions[4]?.user?.role, 'секретарь должен быть залогинен').toBe('secretary');
    expect(sessions[5]?.user?.role, 'ученик филиала A должен быть залогинен').toBe('student');
  });

  test.afterAll(async () => {
    await prisma.moduleGrant.deleteMany({ where: { userId: { in: [sgLeadId] } } });
    await prisma.psyScreeningResult.deleteMany({ where: { campaignId } });
    await prisma.psyScreeningCampaign.deleteMany({ where: { id: campaignId, title: MARK } });
    await prisma.psyDiagnosticTemplate.deleteMany({ where: { id: templateId, name: MARK } });
    await prisma.psyAlert.deleteMany({ where: { id: alertId, reason: { startsWith: MARK } } });
    await prisma.psyCase.deleteMany({ where: { title: { startsWith: MARK } } });
    await prisma.parentStudent.deleteMany({ where: { parentId: { in: [parentAId, parentBId] } } });
    await prisma.parent.deleteMany({ where: { id: { in: [parentAId, parentBId] }, lastName: { startsWith: MARK } } });
    await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId, screeningStudentId] }, lastName: { startsWith: MARK } } });
    await prisma.user.deleteMany({ where: { id: { in: [psyAId, psyBId, zavuchId, sgLeadId, adminId, secretaryId, studentUserId, parentUserId, parentAUserId] }, login: { startsWith: MARK } } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] }, name: { startsWith: MARK } } });
    await Promise.all([ctxPsyA, ctxZavuch, ctxSgLead, ctxAdmin, ctxSecretary, ctxStudent].map((ctx) => ctx?.dispose()));
    await prisma.$disconnect();
  });

  test('scenario 1: subject-card запрещает кросс-филиального субъекта', async () => {
    const res = await ctxPsyA.get(`/api/v1/psy/subject-card?type=parent&id=${parentBId}`);
    const raw = await res.text();
    expect([403, 404], 'карточка родителя чужого филиала должна быть недоступна').toContain(res.status());
    expect(raw, 'ответ не должен раскрывать фамилию ребёнка чужого филиала').not.toContain(studentBLastName);
  });

  test('scenario 2: cases POST запрещает кросс-филиального ученика и не создаёт кейс', async () => {
    const res = await ctxPsyA.post('/api/v1/psy/cases', { data: { studentId: studentBId, title: `${MARK} attack`, subjectType: 'student' } });
    expect([403, 404], 'создание кейса ученику чужого филиала должно быть запрещено').toContain(res.status());
    const count = await prisma.psyCase.count({ where: { studentId: studentBId, ownerId: psyAId } });
    expect(count, 'кросс-филиальный кейс психолога A не должен появиться в БД').toBe(0);
  });

  test('scenario 3: cases POST разрешает ученика своего филиала', async () => {
    const res = await ctxPsyA.post('/api/v1/psy/cases', { data: { studentId: studentAId, title: `${MARK} ok`, subjectType: 'student' } });
    expect([200, 201], 'создание кейса ученику своего филиала должно работать').toContain(res.status());
  });

  test('scenario 4: screening игнорирует клиентский score и пересчитывает риск', async () => {
    const first = await ctxStudent.post(`/api/v1/psy/screening/campaigns/${campaignId}/submit`, { data: { rawScores: [0, 0, 0], score: 999 } });
    expect([200, 201], 'первичный сабмит скрининга должен быть принят').toContain(first.status());
    const firstResult = await prisma.psyScreeningResult.findUnique({ where: { campaignId_studentId: { campaignId, studentId: screeningStudentId } } });
    expect(firstResult?.score, 'score должен быть рассчитан на сервере из rawScores, а не взят у клиента').toBe(0);
    expect(firstResult?.isRisk, 'нулевой серверный score не должен считаться риском').toBe(false);

    const second = await ctxStudent.post(`/api/v1/psy/screening/campaigns/${campaignId}/submit`, { data: { rawScores: [5, 5, 0], score: 0 } });
    expect([200, 201], 'повторный сабмит скрининга должен обновить результат').toContain(second.status());
    const secondResult = await prisma.psyScreeningResult.findUnique({ where: { campaignId_studentId: { campaignId, studentId: screeningStudentId } } });
    expect(secondResult?.score, 'повторный score должен быть пересчитан сервером как сумма rawScores').toBe(10);
    expect(secondResult?.isRisk, 'score 10 при пороге 5 должен установить признак риска').toBe(true);
  });

  test('scenario 8: скрининг принимает реальный формат клиента { answers: [...] }', async () => {
    const res = await ctxStudent.post(`/api/v1/psy/screening/campaigns/${campaignId}/submit`,
      { data: { rawScores: { answers: [5, 5, 0] }, score: 0 } });
    expect([200, 201], '400 здесь означает полный отказ рабочей фичи скрининга').toContain(res.status());
    const result = await prisma.psyScreeningResult.findUnique({ where: { campaignId_studentId: { campaignId, studentId: screeningStudentId } } });
    expect(result?.score, 'score должен быть рассчитан как сумма answers').toBe(10);
    expect(result?.isRisk, 'score 10 при пороге 5 должен установить признак риска').toBe(true);
  });

  test('scenario 5: завуч не видит клиническое обоснование safeguarding-алерта', async () => {
    const res = await ctxZavuch.get('/api/v1/psy/safeguarding');
    const raw = await res.text();
    expect(res.status(), 'завуч должен иметь доступ к списку safeguarding-алертов').toBe(200);
    const body = JSON.parse(raw) as { data?: Array<{ id: string; reason: string | null }> };
    const alert = body.data?.find((item) => item.id === alertId);
    expect(alert, 'помеченный safeguarding-алерт должен присутствовать в ответе завучу').toBeDefined();
    expect(alert?.reason, 'клиническое обоснование должно быть скрыто от завуча').toBeNull();
    expect(raw, 'сырой ответ завучу не должен содержать клиническое обоснование').not.toContain('клиническое обоснование');
  });

  test('scenario 6: ответственный за защиту детей БЕЗ capability не видит клиническое обоснование', async () => {
    const res = await ctxSgLead.get('/api/v1/psy/safeguarding');
    const raw = await res.text();
    expect(res.status(), 'ответственный за защиту детей должен иметь доступ к safeguarding, но capability по умолчанию выключена').toBe(200);
    const body = JSON.parse(raw) as { data?: Array<{ id: string; reason: string | null }> };
    const alert = body.data?.find((item) => item.id === alertId);
    expect(alert, 'помеченный safeguarding-алерт должен присутствовать в защищённом ответе').toBeDefined();
    expect(alert?.reason, 'без явно выданной capability клиническое обоснование должно быть скрыто (fail-closed)').toBeNull();
    expect(raw, 'при выключенной по умолчанию capability сырой ответ не должен содержать клиническое обоснование').not.toContain('клиническое обоснование');
  });

  test('scenario 9: capability psy_safeguarding_reason открывает клиническое обоснование', async () => {
    await prisma.moduleGrant.create({ data: { userId: sgLeadId, module: 'psy_safeguarding_reason', canRead: true } });
    const res = await ctxSgLead.get('/api/v1/psy/safeguarding');
    const raw = await res.text();
    expect(res.status(), 'capability должна открывать safeguarding без повторного логина').toBe(200);
    const body = JSON.parse(raw) as { data?: Array<{ id: string; reason: string | null }> };
    const alert = body.data?.find((item) => item.id === alertId);
    expect(alert, 'помеченный safeguarding-алерт должен присутствовать в ответе').toBeDefined();
    expect(alert?.reason, 'явно выданная capability должна открыть клиническое обоснование').toContain('клиническое обоснование');
    await prisma.moduleGrant.deleteMany({ where: { userId: sgLeadId, module: 'psy_safeguarding_reason' } });
  });

  test('scenario 10: super_admin без capability не видит клиническое обоснование', async () => {
    const res = await ctxAdmin.get('/api/v1/psy/safeguarding');
    const raw = await res.text();
    expect(res.status(), 'super_admin должен иметь доступ к safeguarding-очереди').toBe(200);
    const body = JSON.parse(raw) as { data?: Array<{ id: string; reason: string | null }> };
    const alert = body.data?.find((item) => item.id === alertId);
    expect(alert, 'помеченный safeguarding-алерт должен присутствовать в ответе директору').toBeDefined();
    expect(alert?.reason, 'super_admin без capability не должен видеть клиническое обоснование').toBeNull();
    expect(raw, 'сырой ответ директору без capability не должен содержать клиническое обоснование').not.toContain('клиническое обоснование');
  });

  test('scenario 11: секретарь не имеет доступа к safeguarding-очереди', async () => {
    const res = await ctxSecretary.get('/api/v1/psy/safeguarding');
    const raw = await res.text();
    expect([401, 403], 'секретарь не должен иметь доступа к safeguarding-очереди').toContain(res.status());
    expect(raw, 'ответ секретарю не должен содержать клиническое обоснование').not.toContain('клиническое обоснование');
  });

  test('scenario 7: subject-card маскирует ФИО детей, когда у психолога нет кейса по субъекту', async () => {
    const res = await ctxPsyA.get(`/api/v1/psy/subject-card?type=parent&id=${parentAId}`);
    const raw = await res.text();
    expect(res.status(), 'карточка родителя своего филиала должна быть доступна').toBe(200);
    expect(raw, 'ответ не должен раскрывать фамилию ребёнка без доступного кейса').not.toContain(studentALastName);
    const body = JSON.parse(raw) as { data?: { children?: Array<{ studentId: string; name: string; className: string }>; cases?: unknown[] } };
    const child = body.data?.children?.find((item) => item.studentId === studentAId);
    expect(child, 'ребёнок должен присутствовать в карточке родителя').toBeDefined();
    expect(child?.name, 'вместо ФИО ребёнка должен быть выдан psyCode').toBe(`${MARK}-CODE-A`);
    expect(body.data?.cases, 'кейсов по этому родителю не должно быть').toEqual([]);
  });
});
