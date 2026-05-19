import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse, paginatedResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/chats/[roomId]
 * List messages in a room (paginated, latest first).
 * Query params: page (default 1), perPage (default 50)
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50', 10)));

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { roomId: decodedRoomId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.chatMessage.count({
        where: { roomId: decodedRoomId },
      }),
    ]);

    // Enrich messages with sender info
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

    return paginatedResponse(enriched, {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('GET /api/v1/chats/[roomId] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сообщения', 500);
  }
}

/**
 * POST /api/v1/chats/[roomId]
 * Send a message to a room.
 * Body: { content: string, fileUrl?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    if (auth.session.user.role === 'student') {
      return errorResponse('FORBIDDEN', 'Ученикам запрещено отправлять сообщения', 403);
    }

    const { roomId } = await params;
    const decodedRoomId = decodeURIComponent(roomId);
    const body = await request.json();
    const { content, fileUrl } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return errorResponse('VALIDATION_ERROR', 'Сообщение не может быть пустым');
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId: auth.session.user.id,
        roomId: decodedRoomId,
        content: content.trim(),
        fileUrl: fileUrl || null,
      },
    });

    const sender = await getSenderInfo(auth.session.user.id);

    return successResponse(
      {
        id: message.id,
        senderId: message.senderId,
        roomId: message.roomId,
        content: message.content,
        fileUrl: message.fileUrl,
        createdAt: message.createdAt.toISOString(),
        sender,
      },
      201,
    );
  } catch (error) {
    console.error('POST /api/v1/chats/[roomId] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось отправить сообщение', 500);
  }
}

/**
 * Get sender display info from userId
 */
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

  // Check if teacher
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

  // Check if parent
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

  // Admin or other
  return {
    name: 'Администратор',
    initials: 'АД',
    role: user.role,
  };
}
