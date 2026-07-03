'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Affix,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
  Transition,
} from '@mantine/core';
import { IconPlus, IconSend, IconSparkles, IconX } from '@tabler/icons-react';
import { useRole } from '@/shared/hooks/useRole';
import { ASSISTANT_STARTERS } from './starters';

/**
 * Плавающий виджет ассистента ядра — доступен на каждой странице каждой роли.
 * Директор спрашивает про всю школу, родитель — про своего ребёнка,
 * учитель — про свои классы. Зона доступа инфорсится на сервере.
 */

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AssistantWidget() {
  const { role } = useRole();
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  // При первом открытии — подтянуть последний диалог («помнит чат»)
  useEffect(() => {
    if (!opened || historyLoaded) return;
    let active = true;
    (async () => {
      try {
        const convRes = await fetch('/api/v1/assistant/conversations');
        const convJson = await convRes.json();
        const latest = convJson?.success && convJson.data?.[0];
        if (latest && active) {
          const msgRes = await fetch(`/api/v1/assistant/conversations/${latest.id}/messages`);
          const msgJson = await msgRes.json();
          if (msgJson?.success && active) {
            setConversationId(latest.id);
            setMessages(
              (msgJson.data as Array<{ role: string; content: string }>).map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
              })),
            );
            scrollToBottom();
          }
        }
      } catch {
        /* история не критична */
      } finally {
        if (active) setHistoryLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [opened, historyLoaded, scrollToBottom]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setLoading(true);
      scrollToBottom();
      try {
        const res = await fetch('/api/v1/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId }),
        });
        const json = await res.json();
        if (json?.success) {
          setConversationId(json.data.conversationId);
          setMessages((prev) => [...prev, { role: 'assistant', content: json.data.reply }]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: json?.error?.message ?? 'Что-то пошло не так, попробуйте ещё раз.' },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Нет соединения с сервером. Попробуйте ещё раз.' },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [conversationId, loading, scrollToBottom],
  );

  const newChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  const starters = ASSISTANT_STARTERS[role ?? ''] ?? [];

  return (
    <>
      <Affix position={{ bottom: 20, right: 20 }} zIndex={300}>
        <Transition mounted={!opened} transition="pop">
          {(styles) => (
            <Tooltip label="Ассистент школы" position="left">
              <ActionIcon
                style={{
                  ...styles,
                  boxShadow: '0 6px 20px rgba(34, 99, 235, 0.45)',
                }}
                size={56}
                radius="xl"
                variant="gradient"
                gradient={{ from: '#2263eb', to: '#7c3aed', deg: 135 }}
                onClick={() => setOpened(true)}
                aria-label="Открыть ассистента"
              >
                <IconSparkles size={28} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          )}
        </Transition>
      </Affix>

      <Affix position={{ bottom: 20, right: 20 }} zIndex={310}>
        <Transition mounted={opened} transition="pop-bottom-right" duration={200}>
          {(styles) => (
            <Paper
              style={{
                ...styles,
                width: 'min(390px, calc(100vw - 32px))',
                height: 'min(580px, calc(100vh - 100px))',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
              }}
              radius="lg"
              withBorder
            >
              {/* Шапка */}
              <Group
                justify="space-between"
                px="md"
                py={10}
                style={{
                  background: 'linear-gradient(135deg, #2263eb 0%, #7c3aed 100%)',
                  flexShrink: 0,
                }}
              >
                <Group gap={8}>
                  <IconSparkles size={20} color="white" />
                  <Box>
                    <Text size="sm" fw={600} c="white" lh={1.2}>
                      Ассистент школы
                    </Text>
                    <Text size="xs" c="rgba(255,255,255,0.75)" lh={1.2}>
                      ядро Bilim OS · знает всё в рамках вашей роли
                    </Text>
                  </Box>
                </Group>
                <Group gap={4}>
                  <Tooltip label="Новый диалог">
                    <ActionIcon variant="subtle" color="white" onClick={newChat} aria-label="Новый диалог">
                      <IconPlus size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <ActionIcon variant="subtle" color="white" onClick={() => setOpened(false)} aria-label="Закрыть">
                    <IconX size={18} />
                  </ActionIcon>
                </Group>
              </Group>

              {/* Сообщения */}
              <ScrollArea style={{ flex: 1 }} viewportRef={viewportRef} px="sm" py="xs">
                {messages.length === 0 && !loading ? (
                  <Stack gap="xs" pt="md" px="xs">
                    <Text size="sm" c="dimmed" ta="center">
                      Задайте вопрос о школе — отвечу по реальным данным в рамках вашей роли.
                    </Text>
                    {starters.map((s) => (
                      <Button
                        key={s}
                        variant="light"
                        size="xs"
                        radius="md"
                        fullWidth
                        styles={{ inner: { justifyContent: 'flex-start' }, label: { whiteSpace: 'normal', textAlign: 'left' } }}
                        onClick={() => send(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </Stack>
                ) : (
                  <Stack gap="xs" py={4}>
                    {messages.map((m, idx) => (
                      <Box
                        key={idx}
                        style={{
                          alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                        }}
                      >
                        <Paper
                          px="sm"
                          py={8}
                          radius="lg"
                          style={{
                            backgroundColor: m.role === 'user' ? '#2263eb' : '#f1f3f7',
                            color: m.role === 'user' ? 'white' : 'inherit',
                          }}
                        >
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.content}
                          </Text>
                        </Paper>
                      </Box>
                    ))}
                    {loading && (
                      <Group gap={8} px="sm" py={4}>
                        <Loader size="xs" type="dots" />
                        <Text size="xs" c="dimmed">
                          смотрю данные школы…
                        </Text>
                      </Group>
                    )}
                  </Stack>
                )}
              </ScrollArea>

              {/* Ввод */}
              <Group gap={8} p="sm" style={{ borderTop: '1px solid #eef0f4', flexShrink: 0 }} align="flex-end">
                <Textarea
                  style={{ flex: 1 }}
                  placeholder="Спросите про школу…"
                  autosize
                  minRows={1}
                  maxRows={4}
                  radius="md"
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  disabled={loading}
                />
                <ActionIcon
                  size={36}
                  radius="md"
                  variant="filled"
                  color="bilimosBlue"
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  aria-label="Отправить"
                >
                  <IconSend size={18} />
                </ActionIcon>
              </Group>
            </Paper>
          )}
        </Transition>
      </Affix>
    </>
  );
}
