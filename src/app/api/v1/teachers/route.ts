import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const levelFilter = searchParams.get('level') || '';

    const teachers = await prisma.teacher.findMany({
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
        curatorOf: {
          include: {
            level: true,
          },
        },
        user: {
          select: {
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      where: {
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { middleName: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { lastName: 'asc' },
    });

    const data = teachers.map((t) => {
      const uniqueSubjects = [
        ...new Map(t.subjects.map((ts) => [ts.subjectId, ts.subject])).values(),
      ];
      const totalHours = t.subjects.reduce((sum, ts) => sum + ts.hoursPerWeek, 0);

      return {
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        middleName: t.middleName,
        position: t.position,
        photo: t.photo,
        hireDate: t.hireDate,
        email: t.user.email,
        role: t.user.role,
        isActive: t.user.isActive,
        subjects: uniqueSubjects,
        teacherSubjects: t.subjects,
        curatorOf: t.curatorOf,
        totalHours,
      };
    });

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/teachers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить список педагогов', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { firstName, lastName, middleName, position, photo, hireDate, userId } = body;

    if (!firstName || !lastName || !userId) {
      return errorResponse('VALIDATION_ERROR', 'Поля firstName, lastName и userId обязательны');
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return errorResponse('NOT_FOUND', 'Пользователь не найден', 404);
    }

    const teacher = await prisma.teacher.create({
      data: {
        userId,
        firstName,
        lastName,
        middleName: middleName || null,
        position: position || null,
        photo: photo || null,
        hireDate: hireDate ? new Date(hireDate) : null,
      },
      include: {
        subjects: { include: { subject: true } },
        user: { select: { email: true, role: true } },
      },
    });

    return successResponse(teacher, 201);
  } catch (error) {
    console.error('POST /api/v1/teachers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать педагога', 500);
  }
}
