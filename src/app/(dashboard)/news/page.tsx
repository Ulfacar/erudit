'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconNews,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

/* -- Theme-aware colors -- */
const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';
const CELL_BG = '#fbfcfd';

/* -- Types -- */
interface NewsItem {
  id: string;
  title: string;
  content: string;
  type: 'school' | 'staff' | 'class_note';
  authorId: string;
  authorName: string;
  classId: string | null;
  class: { id: string; grade: number; letter: string } | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClassOption {
  id: string;
  grade: number;
  letter: string;
}

const TYPE_LABELS: Record<string, string> = {
  school: 'Школьная',
  staff: 'Для сотрудников',
  class_note: 'Для класса',
};

const TYPE_COLORS: Record<string, string> = {
  school: 'blue',
  staff: 'yellow',
  class_note: 'green',
};

export default function NewsPage() {
  const { data: session } = useSession();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal state
  const [createModal, setCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<string | null>('school');
  const [newClassId, setNewClassId] = useState<string | null>(null);

  const userRole = session?.user?.role;
  const userId = session?.user?.id;

  const canCreate =
    userRole === 'super_admin' ||
    userRole === 'zavuch' ||
    userRole === 'teacher' ||
    userRole === 'curator';

  // Fetch classes for the class_note selector
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch('/api/v1/classes');
        const json = await res.json();
        if (json.success) setClasses(json.data);
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      }
    }
    fetchClasses();
  }, []);

  // Fetch news
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/news');
      const json = await res.json();
      if (json.success) {
        setNews(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Filter news by active tab
  const filteredNews = useMemo(() => {
    if (activeTab === 'all') return news;
    return news.filter((n) => n.type === activeTab);
  }, [news, activeTab]);

  const classOptions = useMemo(() => {
    return classes
      .map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [classes]);

  // Available type options for create (depends on role)
  const typeOptions = useMemo(() => {
    if (userRole === 'super_admin' || userRole === 'zavuch') {
      return [
        { value: 'school', label: 'Школьная новость' },
        { value: 'staff', label: 'Для сотрудников' },
        { value: 'class_note', label: 'Для класса' },
      ];
    }
    // teacher/curator can only create class_note
    return [{ value: 'class_note', label: 'Для класса' }];
  }, [userRole]);

  async function createNews() {
    if (!newTitle || !newContent || !newType) return;
    if (newType === 'class_note' && !newClassId) return;

    try {
      const res = await fetch('/api/v1/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          type: newType,
          classId: newType === 'class_note' ? newClassId : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCreateModal(false);
        resetForm();
        fetchNews();
      }
    } catch (err) {
      console.error('Failed to create news:', err);
    }
  }

  async function deleteNews(id: string) {
    if (!window.confirm('Удалить новость? Действие нельзя отменить.')) return;
    try {
      const res = await fetch(`/api/v1/news/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setNews((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete news:', err);
    }
  }

  function resetForm() {
    setNewTitle('');
    setNewContent('');
    setNewType('school');
    setNewClassId(null);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function canDelete(item: NewsItem) {
    return userRole === 'super_admin' || item.authorId === userId;
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap={8}>
          <IconNews size={24} color="#228be6" stroke={1.5} />
          <Title order={3} c="var(--mantine-color-text)">
            Новости
          </Title>
        </Group>
        {canCreate && (
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={() => setCreateModal(true)}
          >
            Создать новость
          </Button>
        )}
      </Group>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          root: { borderColor: SURFACE_BORDER },
          tab: { color: TEXT_SEC, '&[dataActive]': { color: '#fff' } },
          list: { borderColor: SURFACE_BORDER },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="all">Все</Tabs.Tab>
          <Tabs.Tab value="school">Школьные</Tabs.Tab>
          {userRole && !['student', 'parent'].includes(userRole) && (
            <Tabs.Tab value="staff">Для сотрудников</Tabs.Tab>
          )}
          <Tabs.Tab value="class_note">Для класса</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* News cards */}
      {loading ? (
        <Text c={TEXT_SEC} ta="center" p="xl">
          Загрузка...
        </Text>
      ) : filteredNews.length === 0 ? (
        <Paper
          style={{
            background: SURFACE,
            border: `1px solid ${SURFACE_BORDER}`,
            padding: 40,
          }}
        >
          <Text c={TEXT_SEC} ta="center">
            Нет новостей
          </Text>
        </Paper>
      ) : (
        <AnimatePresence mode="popLayout">
          {filteredNews.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              layout
            >
            <Paper
              style={{
                background: SURFACE,
                border: `1px solid ${SURFACE_BORDER}`,
                padding: 20,
                cursor: 'pointer',
              }}
              onClick={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
            >
              {/* Card header */}
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={6} style={{ flex: 1 }}>
                  <Group gap={8}>
                    <Badge
                      color={TYPE_COLORS[item.type]}
                      variant="light"
                      size="sm"
                    >
                      {TYPE_LABELS[item.type]}
                    </Badge>
                    {item.class && (
                      <Badge color="gray" variant="outline" size="sm">
                        {item.class.grade}
                        {item.class.letter}
                      </Badge>
                    )}
                  </Group>
                  <Text c="var(--mantine-color-text)" fw={600} size="lg">
                    {item.title}
                  </Text>
                  {expandedId !== item.id && (
                    <Text c="var(--mantine-color-text)" size="sm" lineClamp={2}>
                      {item.content.length > 200
                        ? item.content.slice(0, 200) + '...'
                        : item.content}
                    </Text>
                  )}
                </Stack>

                <Group gap={4} wrap="nowrap">
                  {canDelete(item) && (
                    <Tooltip label="Удалить">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNews(item.id);
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <ActionIcon variant="subtle" color="gray" size="sm">
                    {expandedId === item.id ? (
                      <IconChevronUp size={16} />
                    ) : (
                      <IconChevronDown size={16} />
                    )}
                  </ActionIcon>
                </Group>
              </Group>

              {/* Expanded content */}
              <Collapse in={expandedId === item.id}>
                <Text
                  c="var(--mantine-color-text)"
                  size="sm"
                  mt="md"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {item.content}
                </Text>
              </Collapse>

              {/* Footer */}
              <Group justify="space-between" mt="sm">
                <Text size="xs" c={TEXT_SEC}>
                  {item.authorName}
                </Text>
                <Text size="xs" c={TEXT_SEC}>
                  {formatDate(item.createdAt)}
                </Text>
              </Group>
            </Paper>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {/* Create modal */}
      <Modal
        opened={createModal}
        onClose={() => {
          setCreateModal(false);
          resetForm();
        }}
        title={
          <Text fw={600} c="var(--mantine-color-text)">
            Новая новость
          </Text>
        }
        centered
        size="lg"
        styles={{
          content: {
            backgroundColor: '#ffffff',
            border: `1px solid ${SURFACE_BORDER}`,
          },
          header: { backgroundColor: '#ffffff' },
          body: { backgroundColor: '#ffffff' },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Заголовок"
            placeholder="Введите заголовок новости"
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
            styles={{
              input: {
                backgroundColor: CELL_BG,
                borderColor: SURFACE_BORDER,
                color: '#fff',
              },
              label: { color: TEXT_SEC },
            }}
          />
          <Select
            label="Тип новости"
            data={typeOptions}
            value={newType}
            onChange={setNewType}
            styles={{
              input: {
                backgroundColor: CELL_BG,
                borderColor: SURFACE_BORDER,
                color: '#fff',
              },
              label: { color: TEXT_SEC },
            }}
          />
          {newType === 'class_note' && (
            <Select
              label="Класс"
              placeholder="Выберите класс"
              data={classOptions}
              value={newClassId}
              onChange={setNewClassId}
              searchable
              styles={{
                input: {
                  backgroundColor: CELL_BG,
                  borderColor: SURFACE_BORDER,
                  color: '#fff',
                },
                label: { color: TEXT_SEC },
              }}
            />
          )}
          <Textarea
            label="Содержание"
            placeholder="Текст новости..."
            value={newContent}
            onChange={(e) => setNewContent(e.currentTarget.value)}
            minRows={6}
            autosize
            maxRows={12}
            styles={{
              input: {
                backgroundColor: CELL_BG,
                borderColor: SURFACE_BORDER,
                color: '#fff',
              },
              label: { color: TEXT_SEC },
            }}
          />
          <Group justify="flex-end" gap="sm" mt="sm">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setCreateModal(false);
                resetForm();
              }}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={createNews}
              disabled={
                !newTitle ||
                !newContent ||
                !newType ||
                (newType === 'class_note' && !newClassId)
              }
            >
              Опубликовать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
