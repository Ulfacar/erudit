import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/chats
 * List chat rooms for the current user.
 * A "room" is derived from ChatMessage.roomId.
 * Returns unique rooms with last message preview, unread count, and participant info.
 *
 * Role-based restrictions:
 * - Teachers: can chat with parents of their students, other teachers, admin
 * - Parents: can chat with curator and teachers of their children
 * - Students: CANNOT access chat (FR-9.2)
 * - Admin/super_admin: can chat with anyone
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const user = auth.session.user;

    // Students cannot use chat
    if (user.role === 'student') {
      return errorResponse('FORBIDDEN', 'Ученикам запрещён доступ к чатам', 403);
    }

    // Build the set of allowed roomIds based on role
    const allowedRoomIds = await getAllowedRoomIds(user.id, user.role);

    // Get all messages grouped by roomId
    const rooms = await prisma.chatMessage.findMany({
      where: allowedRoomIds.length > 0
        ? { roomId: { in: allowedRoomIds } }
        : { roomId: { contains: user.id } },
      orderBy: { createdAt: 'desc' },
    });

    // Group by roomId, get last message and count
    const roomMap = new Map<string, {
      roomId: string;
      lastMessage: string;
      lastMessageAt: Date;
      unreadCount: number;
      senderId: string;
    }>();

    for (const msg of rooms) {
      if (!roomMap.has(msg.roomId)) {
        roomMap.set(msg.roomId, {
          roomId: msg.roomId,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
          senderId: msg.senderId,
        });
      }
      // Count messages not sent by current user as "unread" (simplified — no read receipts)
      if (msg.senderId !== user.id) {
        const room = roomMap.get(msg.roomId)!;
        room.unreadCount++;
      }
    }

    // Enrich with participant info
    const result = [];
    for (const [, room] of roomMap) {
      const participant = await getParticipantInfo(room.roomId, user.id);
      result.push({
        roomId: room.roomId,
        lastMessage: room.lastMessage,
        lastMessageAt: room.lastMessageAt.toISOString(),
        unreadCount: room.unreadCount,
        participant,
      });
    }

    // Sort by last message time desc
    result.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

    return successResponse(result);
  } catch (error) {
    console.error('GET /api/v1/chats error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить чаты', 500);
  }
}

/**
 * Determine which roomIds a user is allowed to access based on their role.
 */
async function getAllowedRoomIds(
  userId: string,
  role: string,
): Promise<string[]> {
  // Admin roles can see all rooms they participate in
  if (['super_admin', 'analyst', 'zavuch', 'secretary'].includes(role)) {
    // Admin can chat with anyone — return all rooms that mention this userId
    // plus admin:broadcast
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          { roomId: { contains: userId } },
          { roomId: 'admin:broadcast' },
        ],
      },
      select: { roomId: true },
      distinct: ['roomId'],
    });
    return messages.map((m) => m.roomId);
  }

  if (role === 'teacher' || role === 'curator' || role === 'specialist') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        curatorOf: {
          include: {
            students: {
              include: {
                parentLinks: { include: { parent: true } },
              },
            },
          },
        },
        subjects: {
          include: {
            // classId is on TeacherSubject, not a relation we can include directly
            // We need the students from the classes this teacher teaches
          },
        },
      },
    });

    if (!teacher) return [];

    const roomIds = new Set<string>();

    // Rooms with admin
    const adminUsers = await prisma.user.findMany({
      where: { role: { in: ['super_admin', 'zavuch', 'secretary', 'analyst'] } },
      select: { id: true },
    });
    for (const admin of adminUsers) {
      roomIds.add(buildRoomId('teacher', teacher.id, 'admin', admin.id));
      roomIds.add(buildRoomId('admin', admin.id, 'teacher', teacher.id));
    }

    // Rooms with parents of students in classes this teacher teaches
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { teacherId: teacher.id },
      select: { classId: true },
    });
    const classIds = [...new Set(teacherSubjects.map((ts) => ts.classId))];

    // Also include curator classes
    for (const cls of teacher.curatorOf) {
      if (!classIds.includes(cls.id)) classIds.push(cls.id);
    }

    const students = await prisma.student.findMany({
      where: { classId: { in: classIds } },
      include: {
        parentLinks: { include: { parent: true } },
      },
    });

    for (const student of students) {
      for (const link of student.parentLinks) {
        roomIds.add(
          buildRoomId('teacher', teacher.id, 'parent', link.parent.id),
        );
        roomIds.add(
          buildRoomId('parent', link.parent.id, 'teacher', teacher.id),
        );
      }
    }

    // Rooms with other teachers
    const otherTeachers = await prisma.teacher.findMany({
      where: { id: { not: teacher.id } },
      select: { id: true },
    });
    for (const other of otherTeachers) {
      roomIds.add(buildRoomId('teacher', teacher.id, 'teacher', other.id));
      roomIds.add(buildRoomId('teacher', other.id, 'teacher', teacher.id));
    }

    roomIds.add('admin:broadcast');

    return [...roomIds];
  }

  if (role === 'parent') {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: {
        children: {
          include: {
            student: {
              include: {
                class: {
                  include: {
                    curator: true,
                    scheduleEntries: {
                      select: { teacherId: true },
                      distinct: ['teacherId'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) return [];

    const roomIds = new Set<string>();

    for (const link of parent.children) {
      const cls = link.student.class;

      // Curator
      if (cls.curator) {
        roomIds.add(
          buildRoomId('teacher', cls.curator.id, 'parent', parent.id),
        );
        roomIds.add(
          buildRoomId('parent', parent.id, 'teacher', cls.curator.id),
        );
      }

      // Teachers of the child (from TeacherSubject)
      const teacherSubjects = await prisma.teacherSubject.findMany({
        where: { classId: cls.id },
        select: { teacherId: true },
        distinct: ['teacherId'],
      });

      for (const ts of teacherSubjects) {
        roomIds.add(
          buildRoomId('teacher', ts.teacherId, 'parent', parent.id),
        );
        roomIds.add(
          buildRoomId('parent', parent.id, 'teacher', ts.teacherId),
        );
      }
    }

    roomIds.add('admin:broadcast');

    return [...roomIds];
  }

  return [];
}

/**
 * Build a canonical roomId.
 * Format: `{role1}:{id1}::{role2}:{id2}` where role1:id1 < role2:id2 alphabetically
 * to ensure consistency regardless of who initiates the chat.
 */
function buildRoomId(
  role1: string,
  id1: string,
  role2: string,
  id2: string,
): string {
  const a = `${role1}:${id1}`;
  const b = `${role2}:${id2}`;
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Get participant info from a roomId.
 * Returns the "other" person's name, role, and avatar initials.
 */
async function getParticipantInfo(
  roomId: string,
  currentUserId: string,
): Promise<{
  name: string;
  role: string;
  initials: string;
  id: string;
}> {
  if (roomId === 'admin:broadcast') {
    return { name: 'Общий чат', role: 'broadcast', initials: 'BC', id: 'broadcast' };
  }

  // Parse roomId format: role:id::role:id
  const parts = roomId.split('::');
  if (parts.length !== 2) {
    return { name: 'Неизвестный', role: 'unknown', initials: '??', id: '' };
  }

  // Find the participant that is NOT the current user
  for (const part of parts) {
    const [pRole, pId] = part.split(':');

    if (pRole === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { id: pId },
        include: { user: { select: { id: true } } },
      });
      if (teacher && teacher.user.id !== currentUserId) {
        const initials = `${teacher.lastName[0] || ''}${teacher.firstName[0] || ''}`.toUpperCase();
        return {
          name: `${teacher.lastName} ${teacher.firstName}`,
          role: 'teacher',
          initials,
          id: pId,
        };
      }
    }

    if (pRole === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { id: pId },
        include: { user: { select: { id: true } } },
      });
      if (parent && parent.user.id !== currentUserId) {
        const initials = `${parent.lastName[0] || ''}${parent.firstName[0] || ''}`.toUpperCase();
        return {
          name: `${parent.lastName} ${parent.firstName}`,
          role: 'parent',
          initials,
          id: pId,
        };
      }
    }

    if (pRole === 'admin') {
      const adminUser = await prisma.user.findUnique({
        where: { id: pId },
        select: { id: true, login: true, role: true },
      });
      if (adminUser && adminUser.id !== currentUserId) {
        return {
          name: 'Администратор',
          role: 'admin',
          initials: 'АД',
          id: pId,
        };
      }
    }
  }

  // If we couldn't find the other participant, return first one
  return { name: 'Собеседник', role: 'unknown', initials: '??', id: '' };
}
