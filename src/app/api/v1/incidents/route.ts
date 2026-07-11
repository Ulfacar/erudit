import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    const where: Record<string, unknown> = {};

    // Staff + specialist видят всё; parent — только инциденты своих детей; student — ничего.
    const STAFF: string[] = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist', 'psychologist', 'safeguarding_lead'];
    if (!STAFF.includes(role)) {
      if (role === 'parent') {
        const parent = await prisma.parent.findFirst({
          where: { userId },
          select: { children: { select: { studentId: true } } },
        });
        const childIds = parent?.children.map((c) => c.studentId) ?? [];
        where.studentId = { in: childIds };
      } else {
        return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      }
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(incidents);
  } catch (error) {
    console.error('GET /api/v1/incidents error:', error);
    return errorResponse('FETCH_ERROR', 'Не удалось загрузить происшествия', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { title, description, type, severity, classId, studentId } = body;

    if (!title || !description || !type || !severity) {
      return errorResponse('VALIDATION', 'Заполните все обязательные поля', 400);
    }

    const incident = await prisma.incident.create({
      data: {
        title,
        description,
        type,
        severity,
        authorId: auth.session.user.id,
        classId: classId || null,
        studentId: studentId || null,
      },
    });

    return successResponse(incident, 201);
  } catch (error) {
    console.error('POST /api/v1/incidents error:', error);
    return errorResponse('CREATE_ERROR', 'Не удалось создать происшествие', 500);
  }
}
