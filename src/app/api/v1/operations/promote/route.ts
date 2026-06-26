import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { renewFromActiveContract } from '@/shared/lib/finance/renew-contract';

/**
 * POST /api/v1/operations/promote — выборочный перевод года.
 * Переводит выбранных учеников в целевой класс (существующий или создаваемый) и,
 * опционально, продлевает их договоры. В отличие от bulk-перевода
 * (/operations/transition) — по конкретному списку учеников и одному целевому классу,
 * что покрывает и слияние (общий целевой класс для учеников из разных классов).
 */
const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds.map(String) : [];
  const targetClassId: string | null = body.targetClassId ? String(body.targetClassId) : null;
  const createTarget = body.createTarget as { grade?: number; letter?: string; branchId?: string | null } | undefined;
  const renewContracts = body.renewContracts === true;
  const year = String(body.year ?? '');
  const newBaseAmount = body.newBaseAmount != null ? (parseInt(String(body.newBaseAmount), 10) || 0) : null;

  if (studentIds.length === 0) return errorResponse('VALIDATION_ERROR', 'Не выбраны ученики');
  if (!targetClassId && !(createTarget?.grade && createTarget?.letter)) {
    return errorResponse('VALIDATION_ERROR', 'Нужен целевой класс');
  }

  try {
    // ── целевой класс: существующий или создаём ──
    let targetId = targetClassId;
    let createdClass = false;
    if (!targetId && createTarget?.grade && createTarget?.letter) {
      const grade = createTarget.grade;
      const letter = String(createTarget.letter).toUpperCase();
      const branchId = createTarget.branchId ?? null;
      const existing = await prisma.class.findFirst({ where: { grade, letter, branchId } });
      if (existing) {
        targetId = existing.id;
      } else {
        const lvl = await prisma.schoolLevel.findFirst({ where: { fromGrade: { lte: grade }, toGrade: { gte: grade } } });
        if (!lvl) return errorResponse('VALIDATION_ERROR', `Нет уровня обучения для класса ${grade}`);
        const nc = await prisma.class.create({ data: { grade, letter, levelId: lvl.id, branchId } });
        targetId = nc.id;
        createdClass = true;
      }
    }
    if (!targetId) return errorResponse('VALIDATION_ERROR', 'Не удалось определить целевой класс');

    // ── перевод выбранных учеников ──
    const upd = await prisma.student.updateMany({ where: { id: { in: studentIds } }, data: { classId: targetId } });

    // ── продление договоров ──
    let renewed = 0;
    if (renewContracts) {
      for (const sid of studentIds) {
        const res = await renewFromActiveContract(sid, { year, newBaseAmount, createdById: auth.session.user.id });
        if (res) renewed++;
      }
    }

    return successResponse({ moved: upd.count, renewed, targetClassId: targetId, createdClass });
  } catch (e) {
    console.error('POST operations/promote error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выполнить перевод', 500);
  }
}
