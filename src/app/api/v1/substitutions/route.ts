import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
    });
    if (auth.response) return auth.response;

    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    const classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');

    const where: Record<string, unknown> = {};

    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.date = { gte: start, lt: end };
    }

    if (classId) {
      where.classId = classId;
    }

    if (teacherId) {
      where.OR = [
        { originalTeacherId: teacherId },
        { substituteTeacherId: teacherId },
      ];
    }

    const substitutions = await prisma.substitution.findMany({
      where,
      include: {
        substitute: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with original teacher, class, subject, slot info
    const enriched = await Promise.all(
      substitutions.map(async (sub) => {
        const [originalTeacher, cls, subject, slot] = await Promise.all([
          prisma.teacher.findUnique({
            where: { id: sub.originalTeacherId },
            select: { id: true, firstName: true, lastName: true, middleName: true },
          }),
          prisma.class.findUnique({
            where: { id: sub.classId },
            include: { level: true },
          }),
          prisma.subject.findUnique({
            where: { id: sub.subjectId },
            select: { id: true, name: true, color: true },
          }),
          prisma.bellSchedule.findUnique({
            where: { id: sub.slotId },
            select: { id: true, slotNumber: true, startTime: true, endTime: true },
          }),
        ]);

        return {
          ...sub,
          originalTeacher,
          class: cls,
          subject,
          slot,
        };
      })
    );

    return successResponse(enriched);
  } catch (error) {
    console.error('GET /api/v1/substitutions error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить замены', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { date, originalTeacherId, substituteTeacherId, classId, subjectId, slotId, reason } = body;

    if (!date || !originalTeacherId || !substituteTeacherId || !classId || !subjectId || !slotId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Поля date, originalTeacherId, substituteTeacherId, classId, subjectId, slotId обязательны'
      );
    }

    const substitution = await prisma.substitution.create({
      data: {
        date: new Date(date),
        originalTeacherId,
        substituteTeacherId,
        classId,
        subjectId,
        slotId,
        reason: reason || null,
      },
      include: {
        substitute: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });

    return successResponse(substitution, 201);
  } catch (error) {
    console.error('POST /api/v1/substitutions error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать замену', 500);
  }
}
