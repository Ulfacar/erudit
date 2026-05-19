import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/news
 * List news filtered by type and user role.
 * - Parents see school + their class notes
 * - Staff (teacher/curator/zavuch/specialist/secretary) see school + staff
 * - Admin/analyst see all
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');

    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    // Build where conditions based on role
    const orConditions: Record<string, unknown>[] = [];

    if (role === 'super_admin' || role === 'analyst') {
      // Admin sees all
      if (typeFilter) {
        orConditions.push({ type: typeFilter });
      }
      // No filter means all
    } else if (role === 'parent') {
      // Parents see school news + class_note for their children's classes
      orConditions.push({ type: 'school' });

      // Find parent's children's classIds
      const parent = await prisma.parent.findUnique({
        where: { userId },
        include: {
          children: {
            include: {
              student: { select: { classId: true } },
            },
          },
        },
      });

      if (parent) {
        const classIds = parent.children.map((ps) => ps.student.classId);
        if (classIds.length > 0) {
          orConditions.push({
            type: 'class_note',
            classId: { in: classIds },
          });
        }
      }
    } else if (role === 'student') {
      // Students see school news + class_note for their class
      orConditions.push({ type: 'school' });

      const student = await prisma.student.findUnique({
        where: { userId },
        select: { classId: true },
      });

      if (student) {
        orConditions.push({
          type: 'class_note',
          classId: student.classId,
        });
      }
    } else {
      // Staff roles: teacher, curator, zavuch, secretary, specialist
      orConditions.push({ type: 'school' });
      orConditions.push({ type: 'staff' });

      // Curators also see class_note for their classes
      const teacher = await prisma.teacher.findUnique({
        where: { userId },
        include: {
          curatorOf: { select: { id: true } },
        },
      });

      if (teacher && teacher.curatorOf.length > 0) {
        const curatorClassIds = teacher.curatorOf.map((c) => c.id);
        orConditions.push({
          type: 'class_note',
          classId: { in: curatorClassIds },
        });
      }
    }

    // Apply type filter on top if admin with type filter
    const where: Record<string, unknown> = { isPublished: true };
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }
    if (typeFilter && (role === 'super_admin' || role === 'analyst')) {
      where.type = typeFilter;
      delete where.OR;
    }

    const news = await prisma.news.findMany({
      where,
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve author names
    const authorIds = [...new Set(news.map((n) => n.authorId))];
    const users = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, login: true },
    });
    const teachers = await prisma.teacher.findMany({
      where: { userId: { in: authorIds } },
      select: { userId: true, firstName: true, lastName: true },
    });

    const authorMap: Record<string, string> = {};
    for (const u of users) {
      const t = teachers.find((t) => t.userId === u.id);
      authorMap[u.id] = t ? `${t.lastName} ${t.firstName}` : u.login;
    }

    const result = news.map((n) => ({
      ...n,
      authorName: authorMap[n.authorId] || 'Неизвестный',
    }));

    return successResponse(result);
  } catch (error) {
    console.error('GET /api/v1/news error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить новости', 500);
  }
}

/**
 * POST /api/v1/news
 * Create news.
 * - admin/zavuch can create school + staff news
 * - curator can create class_note for their class
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch', 'teacher', 'curator'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { title, content, type, classId } = body;

    if (!title || !content || !type) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Обязательные поля: title, content, type',
      );
    }

    if (!['school', 'staff', 'class_note'].includes(type)) {
      return errorResponse('VALIDATION_ERROR', 'Недопустимый тип новости');
    }

    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    // Only admin/zavuch can create school and staff news
    if ((type === 'school' || type === 'staff') && role !== 'super_admin' && role !== 'zavuch') {
      return errorResponse('FORBIDDEN', 'Только администратор или завуч могут создавать школьные и кадровые новости', 403);
    }

    // class_note requires classId
    if (type === 'class_note') {
      if (!classId) {
        return errorResponse('VALIDATION_ERROR', 'Для новости класса необходимо указать classId');
      }

      // Verify class exists
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls) {
        return errorResponse('NOT_FOUND', 'Класс не найден', 404);
      }

      // Teachers can only create class_note for classes they curate
      if (role === 'teacher' || role === 'curator') {
        const teacher = await prisma.teacher.findUnique({
          where: { userId },
          include: { curatorOf: { select: { id: true } } },
        });
        if (!teacher || !teacher.curatorOf.some((c) => c.id === classId)) {
          return errorResponse('FORBIDDEN', 'Вы можете создавать новости только для своего класса', 403);
        }
      }
    }

    const news = await prisma.news.create({
      data: {
        title,
        content,
        type,
        authorId: userId,
        classId: type === 'class_note' ? classId : null,
      },
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
      },
    });

    return successResponse(news, 201);
  } catch (error) {
    console.error('POST /api/v1/news error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать новость', 500);
  }
}
