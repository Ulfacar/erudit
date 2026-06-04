import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/core/graph — граф ядра школы для визуализации.
 * Центр «Школа» → домены (с реальными счётчиками) → классы → учителя → ученики (сэмпл).
 * Кап ~350 узлов, чтобы граф оставался живым и быстрым.
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

const STUDENTS_PER_CLASS = 6;
const MAX_TEACHERS = 30;

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] });
    if (auth.response) return auth.response;

    const [
      studentCount, teacherCount, parentCount, gradeCount, invoiceCount,
      sessionCount, leadCount, mealCount, assetCount, libraryCount,
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
      { id: 'd-specialists', label: 'Психолог · Врач', count: sessionCount, meta: 'сессий специалистов' },
      { id: 'd-finance', label: 'Финансы', count: invoiceCount, meta: 'счетов' },
      { id: 'd-admission', label: 'Приёмная', count: leadCount, meta: 'заявок в воронке' },
      { id: 'd-parents', label: 'Родители', count: parentCount, meta: 'родителей' },
      { id: 'd-kitchen', label: 'Столовая', count: mealCount, meta: 'заказов питания' },
      { id: 'd-assets', label: 'Инвентарь', count: assetCount, meta: 'единиц на учёте' },
      { id: 'd-library', label: 'Библиотека', count: libraryCount, meta: 'книг в фонде' },
    ];
    for (const d of domains) {
      nodes.push({ id: d.id, label: d.label, type: 'domain', val: 12, count: d.count, meta: `${d.count} ${d.meta}` });
      links.push({ source: 'school', target: d.id });
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

    // Ученики — сэмпл на класс, чтобы граф дышал, но не тормозил
    const perClass = new Map<string, number>();
    for (const s of students) {
      const used = perClass.get(s.classId) ?? 0;
      if (used >= STUDENTS_PER_CLASS) continue;
      perClass.set(s.classId, used + 1);
      if (!classNodeIds.has(`c-${s.classId}`)) continue;
      nodes.push({ id: `s-${s.id}`, label: `${s.lastName} ${s.firstName[0]}.`, type: 'student', val: 2 });
      links.push({ source: `c-${s.classId}`, target: `s-${s.id}` });
    }

    return successResponse({
      nodes,
      links,
      stats: { учеников: studentCount, педагогов: teacherCount, классов: classes.length, узлов: nodes.length, связей: links.length },
    });
  } catch (error) {
    console.error('GET /api/v1/core/graph error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось построить граф', 500);
  }
}
