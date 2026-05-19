'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconMessageCircle,
  IconPaperclip,
  IconSearch,
  IconSend,
} from '@tabler/icons-react';

/* -- Theme-aware colors -- */
const SURFACE = 'var(--mantine-color-default)';
const SURFACE_BORDER = 'var(--mantine-color-default-border)';
const TEXT_SEC = 'var(--mantine-color-dimmed)';
const TEXT_PRIMARY = 'var(--mantine-color-text)';
const MSG_OWN_BG = '#228be6';
const MSG_OTHER_BG = 'var(--mantine-color-default-hover)';
const INPUT_BG = 'var(--mantine-color-default-hover)';
const HEADER_BG = 'var(--mantine-color-default-hover)';

/* -- Types -- */
interface ChatRoom {
  roomId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  participant: {
    name: string;
    role: string;
    initials: string;
    id: string;
  };
}

interface ChatMessageItem {
  id: string;
  senderId: string;
  roomId: string;
  content: string;
  fileUrl: string | null;
  createdAt: string;
  sender: {
    name: string;
    initials: string;
    role: string;
  };
}

/* -- Helpers -- */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Вчера';
  }

  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    teacher: 'Учитель',
    curator: 'Куратор',
    parent: 'Родитель',
    admin: 'Админ',
    super_admin: 'Админ',
    zavuch: 'Завуч',
    secretary: 'Секретарь',
    specialist: 'Специалист',
    broadcast: 'Общий',
  };
  return map[role] || role;
}

function avatarColor(role: string): string {
  const map: Record<string, string> = {
    teacher: 'blue',
    curator: 'cyan',
    parent: 'green',
    admin: 'red',
    super_admin: 'red',
    zavuch: 'violet',
    secretary: 'orange',
    specialist: 'teal',
    broadcast: 'gray',
  };
  return map[role] || 'gray';
}

/* -- Main Component -- */
export default function ChatsPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTimeRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/chats');
      const json = await res.json();
      if (json.success) {
        setRooms(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Fetch messages for active room
  const fetchMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/v1/chats/${encodeURIComponent(roomId)}?perPage=100`);
      const json = await res.json();
      if (json.success) {
        // Reverse to show oldest first
        const msgs = (json.data as ChatMessageItem[]).reverse();
        setMessages(msgs);
        if (msgs.length > 0) {
          lastMessageTimeRef.current = msgs[msgs.length - 1].createdAt;
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Select room
  const selectRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      setMessages([]);
      lastMessageTimeRef.current = null;
      fetchMessages(roomId);
    },
    [fetchMessages],
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!activeRoomId) return;

    pollingRef.current = setInterval(async () => {
      if (!lastMessageTimeRef.current || !activeRoomId) return;
      try {
        const res = await fetch(
          `/api/v1/chats/${encodeURIComponent(activeRoomId)}/messages?after=${encodeURIComponent(lastMessageTimeRef.current)}`,
        );
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          const newMsgs = json.data as ChatMessageItem[];
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = newMsgs.filter((m) => !existingIds.has(m.id));
            return [...prev, ...unique];
          });
          lastMessageTimeRef.current = newMsgs[newMsgs.length - 1].createdAt;

          // Also refresh rooms to update last message previews
          fetchRooms();
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeRoomId, fetchRooms]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!activeRoomId || !messageInput.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/chats/${encodeURIComponent(activeRoomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageInput.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        const newMsg = json.data as ChatMessageItem;
        setMessages((prev) => [...prev, newMsg]);
        lastMessageTimeRef.current = newMsg.createdAt;
        setMessageInput('');
        fetchRooms();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [activeRoomId, messageInput, sending, fetchRooms]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Filter rooms by search
  const filteredRooms = rooms.filter((room) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      room.participant.name.toLowerCase().includes(q) ||
      room.lastMessage.toLowerCase().includes(q)
    );
  });

  const activeRoom = rooms.find((r) => r.roomId === activeRoomId);

  return (
    <Box
      style={{
        display: 'flex',
        height: 'calc(100vh - 130px)',
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid ${SURFACE_BORDER}`,
        background: SURFACE,
      }}
    >
      {/* Left Panel - Conversation List */}
      <Box
        style={{
          width: 320,
          flexShrink: 0,
          borderRight: `1px solid ${SURFACE_BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          background: SURFACE,
        }}
      >
        {/* Search header */}
        <Box
          style={{
            padding: '12px 12px 8px',
            borderBottom: `1px solid ${SURFACE_BORDER}`,
          }}
        >
          <Group gap={8} mb={8}>
            <IconMessageCircle size={20} color="#228be6" stroke={1.5} />
            <Text fw={600} size="sm" c="var(--mantine-color-text)">
              Чаты
            </Text>
          </Group>
          <TextInput
            placeholder="Поиск..."
            leftSection={<IconSearch size={14} />}
            size="xs"
            radius="sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            styles={{
              input: { backgroundColor: INPUT_BG, borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' },
            }}
          />
        </Box>

        {/* Room list */}
        <ScrollArea type="scroll" style={{ flex: 1 }}>
          {loadingRooms ? (
            <Box
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: 24,
              }}
            >
              <Loader size="sm" color="blue" />
            </Box>
          ) : filteredRooms.length === 0 ? (
            <Text c={TEXT_SEC} size="xs" ta="center" p="xl">
              {rooms.length === 0
                ? 'Нет активных чатов'
                : 'Ничего не найдено'}
            </Text>
          ) : (
            <Stack gap={0}>
              {filteredRooms.map((room) => (
                <ConversationItem
                  key={room.roomId}
                  room={room}
                  isActive={room.roomId === activeRoomId}
                  onClick={() => selectRoom(room.roomId)}
                />
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Box>

      {/* Right Panel - Message Thread */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--mantine-color-body)',
        }}
      >
        {activeRoom ? (
          <>
            {/* Chat header */}
            <Box
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${SURFACE_BORDER}`,
                background: HEADER_BG,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar
                size={36}
                radius="xl"
                color={avatarColor(activeRoom.participant.role)}
                variant="filled"
              >
                {activeRoom.participant.initials}
              </Avatar>
              <Box>
                <Text fw={500} size="sm" c="var(--mantine-color-text)" lh={1.3}>
                  {activeRoom.participant.name}
                </Text>
                <Text size="xs" c={TEXT_SEC} lh={1.3}>
                  {roleLabel(activeRoom.participant.role)}
                </Text>
              </Box>
            </Box>

            {/* Messages area */}
            <ScrollArea
              type="scroll"
              style={{ flex: 1 }}
              viewportRef={viewportRef}
              p="md"
            >
              {loadingMessages ? (
                <Box
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    padding: 48,
                  }}
                >
                  <Loader size="sm" color="blue" />
                </Box>
              ) : messages.length === 0 ? (
                <Box
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    padding: 48,
                  }}
                >
                  <Stack align="center" gap={8}>
                    <IconMessageCircle size={48} color={TEXT_SEC} stroke={1} />
                    <Text c={TEXT_SEC} size="sm">
                      Начните диалог
                    </Text>
                  </Stack>
                </Box>
              ) : (
                <Stack gap={8}>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.senderId === currentUserId}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </Stack>
              )}
            </ScrollArea>

            {/* Input area */}
            <Box
              style={{
                padding: '10px 16px',
                borderTop: `1px solid ${SURFACE_BORDER}`,
                background: HEADER_BG,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                radius="sm"
                title="Прикрепить файл"
              >
                <IconPaperclip size={18} stroke={1.5} />
              </ActionIcon>
              <TextInput
                placeholder="Введите сообщение..."
                size="sm"
                radius="sm"
                style={{ flex: 1 }}
                value={messageInput}
                onChange={(e) => setMessageInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                styles={{
                  input: {
                    backgroundColor: INPUT_BG,
                    borderColor: SURFACE_BORDER,
                    color: 'var(--mantine-color-text)',
                  },
                }}
              />
              <ActionIcon
                variant="filled"
                color="blue"
                size="lg"
                radius="sm"
                onClick={sendMessage}
                disabled={!messageInput.trim() || sending}
                loading={sending}
              >
                <IconSend size={18} stroke={1.5} />
              </ActionIcon>
            </Box>
          </>
        ) : (
          /* No room selected placeholder */
          <Box
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Stack align="center" gap={12}>
              <IconMessageCircle size={64} color={TEXT_SEC} stroke={1} />
              <Text c={TEXT_SEC} size="sm">
                Выберите чат для начала переписки
              </Text>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* -- Conversation list item -- */
function ConversationItem({
  room,
  isActive,
  onClick,
}: {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: isActive ? '#228be620' : 'transparent',
        borderLeft: isActive ? '3px solid #228be6' : '3px solid transparent',
        transition: 'background 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--mantine-color-default-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Avatar
        size={40}
        radius="xl"
        color={avatarColor(room.participant.role)}
        variant="filled"
        style={{ flexShrink: 0 }}
      >
        {room.participant.initials}
      </Avatar>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" gap={4} wrap="nowrap">
          <Text
            fw={500}
            size="sm"
            c="var(--mantine-color-text)"
            lineClamp={1}
            style={{ flex: 1 }}
          >
            {room.participant.name}
          </Text>
          <Text size="xs" c={TEXT_SEC} style={{ flexShrink: 0 }}>
            {formatTime(room.lastMessageAt)}
          </Text>
        </Group>
        <Group justify="space-between" gap={4} wrap="nowrap" mt={2}>
          <Text
            size="xs"
            c={TEXT_SEC}
            lineClamp={1}
            style={{ flex: 1 }}
          >
            {room.lastMessage}
          </Text>
          {room.unreadCount > 0 && (
            <Badge
              size="sm"
              circle
              color="blue"
              variant="filled"
              style={{ flexShrink: 0 }}
            >
              {room.unreadCount > 99 ? '99+' : room.unreadCount}
            </Badge>
          )}
        </Group>
      </Box>
    </UnstyledButton>
  );
}

/* -- Message bubble -- */
function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessageItem;
  isOwn: boolean;
}) {
  return (
    <Box
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        paddingLeft: isOwn ? 48 : 0,
        paddingRight: isOwn ? 0 : 48,
      }}
    >
      <Box
        style={{
          display: 'flex',
          gap: 8,
          flexDirection: isOwn ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          maxWidth: '75%',
        }}
      >
        {!isOwn && (
          <Avatar
            size={28}
            radius="xl"
            color={avatarColor(message.sender.role)}
            variant="filled"
            style={{ flexShrink: 0 }}
          >
            <Text size="xs">{message.sender.initials}</Text>
          </Avatar>
        )}
        <Box>
          {!isOwn && (
            <Text size="xs" c={TEXT_SEC} mb={2} ml={4}>
              {message.sender.name}
            </Text>
          )}
          <Box
            style={{
              background: isOwn ? MSG_OWN_BG : MSG_OTHER_BG,
              borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '8px 12px',
            }}
          >
            <Text
              size="sm"
              c={isOwn ? '#fff' : TEXT_PRIMARY}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {message.content}
            </Text>
            {message.fileUrl && (
              <Text
                size="xs"
                c={isOwn ? '#ffffffaa' : TEXT_SEC}
                mt={4}
                component="a"
                href={message.fileUrl}
                target="_blank"
                style={{ textDecoration: 'underline' }}
              >
                Прикрепленный файл
              </Text>
            )}
          </Box>
          <Text
            size="xs"
            c={TEXT_SEC}
            mt={2}
            style={{ textAlign: isOwn ? 'right' : 'left' }}
            mx={4}
          >
            {formatMessageTime(message.createdAt)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
