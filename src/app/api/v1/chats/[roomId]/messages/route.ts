import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/chats/[roomId]/messages?after=ISO_TIMESTAMP
 * Polling endpoint: returns messages created after the given timestamp.
 * Used by the client to poll for new messages every 3 seconds.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    if (auth.session.user.role === 'student') {
      return errorResponse('FORBIDDEN', 'Ученикам запрещён доступ к чатам', 403);
    }

    const { roomId } = await params;
    const decodedRoomId = decodeURIComponent(roomId);

    const { searchParams } = new URL(request.url);
    const after = searchParams.get('after');

    if (!after) {
      return errorResponse('VALIDATION_ERROR', 'Параметр "after" обязателен');
    }

    const afterDate = new Date(after);
    if (isNaN(afterDate.getTime())) {
      return errorResponse('VALIDATION_ERROR', 'Некорректный формат даты "after"');
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId: decodedRoomId,
        createdAt: { gt: afterDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with sender info
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const sender = await getSenderInfo(msg.senderId);
        return {
          id: msg.id,
          senderId: msg.senderId,
          roomId: msg.roomId,
          content: msg.content,
          fileUrl: msg.fileUrl,
          createdAt: msg.createdAt.toISOString(),
          sender,
        };
      }),
    );

    return successResponse(enriched);
  } catch (error) {
    console.error('GET /api/v1/chats/[roomId]/messages error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить новые сообщения', 500);
  }
}

async function getSenderInfo(userId: string): Promise<{
  name: string;
  initials: string;
  role: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return { name: 'Неизвестный', initials: '??', role: 'unknown' };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true },
  });
  if (teacher) {
    return {
      name: `${teacher.lastName} ${teacher.firstName}`,
      initials: `${teacher.lastName[0] || ''}${teacher.firstName[0] || ''}`.toUpperCase(),
      role: user.role,
    };
  }

  const parent = await prisma.parent.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true },
  });
  if (parent) {
    return {
      name: `${parent.lastName} ${parent.firstName}`,
      initials: `${parent.lastName[0] || ''}${parent.firstName[0] || ''}`.toUpperCase(),
      role: user.role,
    };
  }

  return {
    name: 'Администратор',
    initials: 'АД',
    role: user.role,
  };
}
