import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/shared/lib/rate-limit';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId');
    const levelId = searchParams.get('levelId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    // Parents can only see their own children
    if (auth.session.user.role === 'parent') {
      where.parentLinks = {
        some: {
          parent: {
            userId: auth.session.user.id,
          },
        },
      };
    }
    // Students can only see themselves
    if (auth.session.user.role === 'student') {
      where.user = { id: auth.session.user.id };
    }

    if (classId) {
      where.classId = classId;
    }

    if (levelId) {
      where.class = { levelId };
    }

    if (status) {
      where.status = status;
    } else {
      // по умолчанию активные ростеры: без выпускников и отчисленных
      where.status = { notIn: ['graduated', 'withdrawn'] };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Multi-branch: персонал видит только свой филиал; админ — выбранный (cookie) или все.
    const bscope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    Object.assign(where, branchWhere(bscope));

    const students = await prisma.student.findMany({
      where,
      include: {
        class: {
          include: {
            level: true,
          },
        },
        parentLinks: {
          include: {
            parent: true,
          },
        },
      },
      orderBy: [
        { class: { grade: 'asc' } },
        { class: { letter: 'asc' } },
        { lastName: 'asc' },
      ],
    });

    return successResponse(students);
  } catch (error) {
    console.error('GET /api/v1/students error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка при получении списка учеников', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 100 requests per minute per IP
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, 100, 60000)) {
      return errorResponse('RATE_LIMITED', 'Слишком много запросов. Попробуйте позже.', 429);
    }

    const auth = await withAuth(request, { roles: ['super_admin', 'zavuch', 'secretary'] });
    if (auth.response) return auth.response;

    const body = await request.json();

    const { firstName, lastName, middleName, dateOfBirth, classId, status, photo } = body;

    if (!firstName || !lastName || !classId) {
      return errorResponse('VALIDATION_ERROR', 'Обязательные поля: firstName, lastName, classId');
    }

    const classExists = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, branchId: true } });
    if (!classExists) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    // Филиал нового ученика = филиал класса (или выбранный филиал создателя).
    const bscope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const branchId = classExists.branchId ?? bscope.branchId ?? null;

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        middleName: middleName || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        classId,
        status: status || 'permanent',
        photo: photo || null,
        branchId,
      },
      include: {
        class: {
          include: {
            level: true,
          },
        },
      },
    });

    return successResponse(student, 201);
  } catch (error) {
    console.error('POST /api/v1/students error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка при создании ученика', 500);
  }
}
