import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

type AwardItem = {
  value?: Prisma.JsonValue;
  label?: Prisma.JsonValue;
};

function isAwardItem(value: Prisma.JsonValue): value is AwardItem {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function awardLabelFromScheme(values: Prisma.JsonValue | null | undefined, awardValue: string | null) {
  if (!Array.isArray(values) || !awardValue) return null;

  const match = values.find((item) => isAwardItem(item) && String(item.value) === awardValue);
  if (!match || !isAwardItem(match) || typeof match.label !== 'string') return null;

  return match.label;
}

export async function syncOlympiadAchievement(params: {
  studentId: string;
  olympiadId: string;
  olympiadName: string;
  level: string;
  status: string;
  awardValue: string | null;
  awardLabel: string | null;
  authorId: string;
}): Promise<void> {
  try {
    const shouldExist = params.status === 'participated' && !!params.awardValue;

    if (!shouldExist) {
      await prisma.achievement.deleteMany({
        where: { studentId: params.studentId, olympiadId: params.olympiadId },
      });
      return;
    }

    const place = params.awardLabel ?? params.awardValue;
    const title = `Олимпиада: ${params.olympiadName}`;
    const existing = await prisma.achievement.findFirst({
      where: { studentId: params.studentId, olympiadId: params.olympiadId },
      select: { id: true },
    });

    if (existing) {
      await prisma.achievement.update({
        where: { id: existing.id },
        data: {
          title,
          place,
          level: params.level,
          date: new Date(),
        },
      });
      return;
    }

    await prisma.achievement.create({
      data: {
        studentId: params.studentId,
        title,
        description: null,
        category: 'academic',
        level: params.level,
        place,
        date: new Date(),
        authorId: params.authorId,
        olympiadId: params.olympiadId,
      },
    });
  } catch (error) {
    console.error('sync olympiad achievement failed:', error);
  }
}
