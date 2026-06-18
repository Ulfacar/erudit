import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/core/graph — граф ядра школы для нейро-визуализации.
 * Центр «Школа» → домены (с реальными счётчиками) → классы → учителя →
 * ученики (сэмпл) → их родители. Кап ~400 узлов.
 * Плюс `scenario` — шаги демо-анимации «оценка 2 → сигнал родителю»
 * с реальными id узлов этого графа.
 */

interface GraphNode {
  id: string;
  label: string;
  type: 'school' | 'domain' | 'class' | 'teacher' | 'student' | 'parent';
  val: number;
  count?: number;
  meta?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

interface ScenarioStep {
  from: string;
  to: string;
  caption: string;
}

const STUDENTS_PER_CLASS = 6;
const MAX_TEACHERS = 30;
const MAX_PARENTS = 40;

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin'] });
    if (auth.response) return auth.response;

    const [
      studentCount, teacherCount, parentCount, gradeCount, invoiceCount,
      sessionCount, leadCount, mealCount, assetCount, libraryCount, agentItemCount, knowledgeCount,
      psyCaseCount, contractCount, candidateCount, vacancyCount, psyAlertCount, promiseCount,
      classes, teachers, students,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.parent.count(),
      prisma.grade.count(),
      prisma.feeInvoice.count(),
      prisma.specialistSession.count(),
      prisma.admissionLead.count(),
      prisma.mealOrder.count(),
      prisma.asset.count(),
      prisma.libraryItem.count(),
      prisma.agentItem.count(),
      prisma.knowledgeDoc.count(),
      prisma.psyCase.count(),
      prisma.contract.count(),
      prisma.candidate.count(),
      prisma.vacancy.count(),
      prisma.psyAlert.count(),
      prisma.studentNote.count({ where: { type: 'promise' } }),
      prisma.class.findMany({
        select: { id: true, grade: true, letter: true, curatorId: true, _count: { select: { students: true } } },
        orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
      }),
      prisma.teacher.findMany({
        select: { id: true, firstName: true, lastName: true, subjects: { select: { classId: true }, take: 3 } },
        take: MAX_TEACHERS,
      }),
      prisma.student.findMany({
        select: { id: true, firstName: true, lastName: true, classId: true },
        take: 1000,
      }),
    ]);

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    nodes.push({ id: 'school', label: 'Школа', type: 'school', val: 28, meta: 'Единое ядро данных' });

    // Домены — модули экосистемы со счётчиками реальных записей
    const domains: Array<{ id: string; label: string; count: number; meta: string }> = [
      { id: 'd-journal', label: 'Журнал', count: gradeCount, meta: 'оценок в базе' },
      { id: 'd-people', label: 'Педагоги', count: teacherCount, meta: 'педагогов' },
      { id: 'd-specialists', label: 'Специалисты', count: sessionCount, meta: 'сессий специалистов' },
      { id: 'd-psych', label: 'Психолог (eSPSMS)', count: psyCaseCount, meta: 'кейсов психолога' },
      { id: 'd-safeguard', label: 'Безопасность', count: psyAlertCount, meta: 'safeguarding-сигналов' },
      { id: 'd-finance', label: 'Финансы', count: invoiceCount, meta: 'счетов' },
      { id: 'd-callcenter', label: 'Колл-центр', count: promiseCount, meta: 'обещаний оплаты' },
      { id: 'd-contracts', label: 'Договоры', count: contractCount, meta: 'договоров' },
      { id: 'd-admission', label: 'Приёмная', count: leadCount, meta: 'заявок в воронке' },
      { id: 'd-hr', label: 'Кадры (HR)', count: candidateCount + vacancyCount, meta: 'кандидатов и вакансий' },
      { id: 'd-agent', label: 'AI-агенты', count: agentItemCount, meta: 'сигналов агентов' },
      { id: 'd-knowledge', label: 'База знаний', count: knowledgeCount, meta: 'документов' },
      { id: 'd-kitchen', label: 'Столовая', count: mealCount, meta: 'заказов питания' },
      { id: 'd-assets', label: 'Инвентарь', count: assetCount, meta: 'единиц на учёте' },
      { id: 'd-library', label: 'Библиотека', count: libraryCount, meta: 'книг в фонде' },
    ];
    for (const d of domains) {
      nodes.push({ id: d.id, label: d.label, type: 'domain', val: 12, count: d.count, meta: `${d.count} ${d.meta}` });
      links.push({ source: 'school', target: d.id });
    }

    // Меж-доменные связи — реальная взаимосвязь ролей (не просто звезда вокруг ядра):
    const domainIds = new Set(domains.map((d) => d.id));
    const crossLinks: GraphLink[] = [
      { source: 'd-callcenter', target: 'd-finance' },   // колл-центр обзванивает должников → финансы
      { source: 'd-safeguard', target: 'd-psych' },      // safeguarding-сигналы рождаются в психо-кейсах
      { source: 'd-contracts', target: 'd-finance' },    // договор → счета
      { source: 'd-admission', target: 'd-contracts' },  // приёмка → договор
      { source: 'd-admission', target: 'd-psych' },      // приёмка → входной тест психолога
      { source: 'd-hr', target: 'd-people' },            // HR нанимает педагогов
    ];
    for (const l of crossLinks) {
      if (domainIds.has(l.source) && domainIds.has(l.target)) links.push(l);
    }

    // Классы → к ядру
    for (const c of classes) {
      nodes.push({
        id: `c-${c.id}`,
        label: `${c.grade}${c.letter}`,
        type: 'class',
        val: 6,
        count: c._count.students,
        meta: `${c._count.students} учеников`,
      });
      links.push({ source: 'school', target: `c-${c.id}` });
    }

    // Учителя → домен «Педагоги» + классы, где ведут
    const classNodeIds = new Set(classes.map((c) => `c-${c.id}`));
    for (const t of teachers) {
      nodes.push({ id: `t-${t.id}`, label: `${t.lastName} ${t.firstName[0]}.`, type: 'teacher', val: 4 });
      links.push({ source: 'd-people', target: `t-${t.id}` });
      for (const s of t.subjects) {
        if (classNodeIds.has(`c-${s.classId}`)) links.push({ source: `t-${t.id}`, target: `c-${s.classId}` });
      }
    }

    // Ученики — сэмпл на класс
    const perClass = new Map<string, number>();
    const sampledStudentIds: string[] = [];
    for (const s of students) {
      const used = perClass.get(s.classId) ?? 0;
      if (used >= STUDENTS_PER_CLASS) continue;
      if (!classNodeIds.has(`c-${s.classId}`)) continue;
      perClass.set(s.classId, used + 1);
      nodes.push({ id: `s-${s.id}`, label: `${s.lastName} ${s.firstName[0]}.`, type: 'student', val: 2 });
      links.push({ source: `c-${s.classId}`, target: `s-${s.id}` });
      sampledStudentIds.push(s.id);
    }

    // Родители сэмпл-учеников (нейронная связь ученик → родитель)
    const parentLinks = await prisma.parentStudent.findMany({
      where: { studentId: { in: sampledStudentIds.slice(0, 60) } },
      select: {
        studentId: true,
        parent: { select: { id: true, firstName: true, lastName: true } },
      },
      take: MAX_PARENTS,
    });
    const addedParents = new Set<string>();
    for (const pl of parentLinks) {
      const pid = `p-${pl.parent.id}`;
      if (!addedParents.has(pid)) {
        nodes.push({ id: pid, label: `${pl.parent.lastName} ${pl.parent.firstName[0]}.`, type: 'parent', val: 2.5 });
        addedParents.add(pid);
      }
      links.push({ source: `s-${pl.studentId}`, target: pid });
    }

    // ── Демо-сценарий: «учитель ставит 2 → сигнал родителю» по реальным узлам ──
    const scenario: ScenarioStep[] = [];
    const scenarioPl = parentLinks[0]; // ученик, у которого точно есть родитель в графе
    if (scenarioPl) {
      const student = students.find((s) => s.id === scenarioPl.studentId);
      const cls = classes.find((c) => c.id === student?.classId);
      // учитель, ведущий в этом классе (или первый)
      const teacher = teachers.find((t) => t.subjects.some((s) => s.classId === student?.classId)) ?? teachers[0];
      if (student && cls && teacher) {
        const studentName = `${student.lastName} ${student.firstName[0]}.`;
        scenario.push(
          { from: `t-${teacher.id}`, to: 'd-journal', caption: `Учитель ${teacher.lastName} ставит оценку «2» в журнал` },
          { from: 'd-journal', to: 'school', caption: 'Журнал мгновенно обновляет единое ядро' },
          { from: 'school', to: `c-${cls.id}`, caption: `Ядро знает: ученик из класса ${cls.grade}${cls.letter}` },
          { from: `c-${cls.id}`, to: `s-${student.id}`, caption: `Профиль ученика ${studentName} обновлён` },
          { from: 'school', to: 'd-agent', caption: 'AI-агент замечает низкую оценку — правило сработало' },
          { from: `s-${student.id}`, to: `p-${scenarioPl.parent.id}`, caption: 'Родитель получает заботливый сигнал — без звонков и журналов' },
        );
      }
    }

    return successResponse({
      nodes,
      links,
      scenario,
      stats: { учеников: studentCount, педагогов: teacherCount, классов: classes.length, родителей: parentCount, узлов: nodes.length, связей: links.length },
    });
  } catch (error) {
    console.error('GET /api/v1/core/graph error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось построить граф', 500);
  }
}
