import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/psy/dashboard — АНОНИМНАЯ сводка для руководства (UC, блок 1.2).
 * Только агрегаты: «в 7-х классах N кейсов в зоне риска», динамика в %.
 * НИКАКИХ ФИО и текстов заключений.
 */
const VIEW_ROLES = ['super_admin', 'analyst', 'zavuch', 'senior_psychologist', 'safeguarding_lead'] as const;

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...VIEW_ROLES] });
  if (auth.response) return auth.response;

  try {
    const cases = await prisma.psyCase.findMany({ select: { id: true, studentId: true, status: true, riskLevel: true } });
    const byStatus: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    for (const c of cases) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      byRisk[c.riskLevel] = (byRisk[c.riskLevel] ?? 0) + 1;
    }

    // зона риска (yellow/red) по параллелям классов
    const atRisk = cases.filter((c) => c.riskLevel !== 'green');
    const students = await prisma.student.findMany({
      where: { id: { in: [...new Set(atRisk.map((c) => c.studentId).filter((x): x is string => !!x))] } },
      select: { id: true, class: { select: { grade: true } } },
    });
    const gradeOf = (sid: string) => students.find((s) => s.id === sid)?.class?.grade ?? null;
    const riskByGrade: Record<number, number> = {};
    for (const c of atRisk) {
      const g = c.studentId ? gradeOf(c.studentId) : null;
      if (g != null) riskByGrade[g] = (riskByGrade[g] ?? 0) + 1;
    }

    // динамика: доля кейсов, где последний замер ниже первого (улучшение для шкал тревожности).
    // ВАЖНО: значения нормализуем через mappingRule версии методики (склейка версий),
    // иначе смена шкалы исказит динамику (патч аналитического коллапса).
    const measurements = await prisma.psyMeasurement.findMany({ orderBy: { date: 'asc' }, select: { caseId: true, value: true, templateId: true } });
    const tplIds = [...new Set(measurements.map((m) => m.templateId).filter(Boolean) as string[])];
    const tpls = tplIds.length
      ? await prisma.psyDiagnosticTemplate.findMany({ where: { id: { in: tplIds } }, select: { id: true, mappingRule: true } })
      : [];
    const norm = (value: number, templateId: string | null): number => {
      const rule = templateId ? (tpls.find((t) => t.id === templateId)?.mappingRule as { op?: string; factor?: number } | null) : null;
      if (!rule || !rule.op || !rule.factor) return value;
      if (rule.op === 'divide') return value / rule.factor;
      if (rule.op === 'multiply') return value * rule.factor;
      return value;
    };
    const byCase: Record<string, number[]> = {};
    for (const m of measurements) (byCase[m.caseId] ??= []).push(norm(m.value, m.templateId));
    const withDynamics = Object.values(byCase).filter((v) => v.length >= 2);
    const improved = withDynamics.filter((v) => v[v.length - 1] < v[0]).length;
    const improvedPct = withDynamics.length ? Math.round((improved / withDynamics.length) * 100) : 0;

    return successResponse({
      total: cases.length,
      byStatus,
      byRisk,
      riskByGrade: Object.entries(riskByGrade).map(([grade, count]) => ({ grade: Number(grade), count })).sort((a, b) => a.grade - b.grade),
      dynamics: { casesWithDynamics: withDynamics.length, improved, improvedPct },
    });
  } catch (e) {
    console.error('GET psy/dashboard error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сводку', 500);
  }
}
