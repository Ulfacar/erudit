import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    // Filter by visibility: user must have a role that's in the visibleTo array
    const userRole = auth.session.user.role;
    if (userRole !== 'super_admin') {
      where.OR = [
        { visibleTo: { has: userRole } },
        { authorId: auth.session.user.id },
      ];
    }

    const issues = await prisma.urgentIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(issues);
  } catch (error) {
    console.error('GET /api/v1/urgent-issues error:', error);
    return errorResponse('FETCH_ERROR', 'Не удалось загрузить срочные вопросы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { title, description, priority, visibleTo, classId, studentId } = body;

    if (!title || !description || !priority) {
      return errorResponse('VALIDATION', 'Заполните все обязательные поля', 400);
    }

    const issue = await prisma.urgentIssue.create({
      data: {
        title,
        description,
        priority,
        visibleTo: visibleTo || [],
        authorId: auth.session.user.id,
        classId: classId || null,
        studentId: studentId || null,
      },
    });

    return successResponse(issue, 201);
  } catch (error) {
    console.error('POST /api/v1/urgent-issues error:', error);
    return errorResponse('CREATE_ERROR', 'Не удалось создать срочный вопрос', 500);
  }
}
