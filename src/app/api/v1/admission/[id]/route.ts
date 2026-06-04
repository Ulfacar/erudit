import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { emitEvent } from '@/shared/lib/agent/engine';
import type { AdmissionStage, PaymentSchedule } from '@prisma/client';

/**
 * PATCH /api/v1/admission/[id] — перевод лида по этапам воронки с полями этапа.
 * На этапе `enrolled` приёмная «пишет в ядро»: создаётся реальный Student
 * и счета FeeInvoice по графику оплат из договора.
 */

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

const STAGES: AdmissionStage[] = ['lead', 'testing', 'psych', 'director', 'contract', 'enrolled', 'rejected'];

/** Сколько счетов и с каким шагом (мес.) создаём по графику оплат. */
const SCHEDULE_PLAN: Record<PaymentSchedule, { count: number; stepMonths: number; label: (i: number) => string }> = {
  monthly: {
    count: 9,
    stepMonths: 1,
    label: (i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      return `Обучение, ${d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`;
    },
  },
  quarterly: { count: 3, stepMonths: 3, label: (i) => `Обучение, ${i + 1}-й триместр` },
  yearly: { count: 1, stepMonths: 12, label: () => 'Обучение, учебный год' },
};

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const lead = await prisma.admissionLead.findUnique({ where: { id } });
    if (!lead) return errorResponse('NOT_FOUND', 'Заявка не найдена', 404);

    const body = await request.json().catch(() => ({}));
    const stage = body.stage as AdmissionStage | undefined;
    if (stage && !STAGES.includes(stage)) return errorResponse('VALIDATION_ERROR', 'Неизвестный этап');

    // поля этапов (whitelist)
    const data: Record<string, unknown> = {};
    if (stage) data.stage = stage;
    if (body.mathScore !== undefined) data.mathScore = body.mathScore === null ? null : parseInt(String(body.mathScore), 10);
    if (body.englishScore !== undefined) data.englishScore = body.englishScore === null ? null : parseInt(String(body.englishScore), 10);
    if (typeof body.psychNote === 'string') data.psychNote = body.psychNote.slice(0, 2000);
    if (typeof body.decisionNote === 'string') data.decisionNote = body.decisionNote.slice(0, 1000);
    if (body.contractAmount !== undefined) data.contractAmount = parseInt(String(body.contractAmount), 10) || null;
    if (typeof body.paymentSchedule === 'string' && ['monthly', 'quarterly', 'yearly'].includes(body.paymentSchedule)) {
      data.paymentSchedule = body.paymentSchedule;
    }
    if (typeof body.rejectReason === 'string') data.rejectReason = body.rejectReason.slice(0, 1000);
    if (typeof body.classId === 'string') data.classId = body.classId;

    // ── Зачисление: лид становится учеником в ядре ──
    if (stage === 'enrolled' && !lead.enrolledStudentId) {
      const classId = (data.classId as string) || lead.classId;
      if (!classId) return errorResponse('VALIDATION_ERROR', 'Для зачисления выберите класс');
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
      if (!cls) return errorResponse('VALIDATION_ERROR', 'Класс не найден');

      const parts = lead.childName.trim().split(/\s+/);
      const firstName = parts[0] ?? lead.childName;
      const lastName = parts.slice(1).join(' ') || '—';

      const student = await prisma.student.create({
        data: { firstName, lastName, classId, status: 'permanent' },
        select: { id: true },
      });
      data.enrolledStudentId = student.id;

      // счета по графику оплат из договора (best-effort — зачисление важнее)
      try {
        const schedule = (data.paymentSchedule as PaymentSchedule) || lead.paymentSchedule;
        const amount = (data.contractAmount as number) || lead.contractAmount;
        if (schedule && amount) {
          const plan = SCHEDULE_PLAN[schedule];
          for (let i = 0; i < plan.count; i++) {
            const due = new Date();
            due.setMonth(due.getMonth() + i * plan.stepMonths);
            due.setDate(10);
            await prisma.feeInvoice.create({
              data: { studentId: student.id, title: plan.label(i), amount, status: 'pending', dueDate: due },
            });
          }
        }
      } catch (err) {
        console.error('[admission] invoice creation failed:', err);
      }

      await emitEvent('admission.enrolled', {
        actorUserId: auth.session.user.id,
        studentId: student.id,
        classId,
        payload: { leadId: lead.id, childName: lead.childName },
      });
    }

    const updated = await prisma.admissionLead.update({ where: { id }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/admission/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку', 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    await prisma.admissionLead.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/admission/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить заявку', 500);
  }
}
