'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPencil, IconPlus, IconSchool, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

/* ── Dark theme tokens ── */
const SURFACE = 'var(--mantine-color-default)';
const SURFACE_BORDER = 'var(--mantine-color-default-border)';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

/* ── Types ── */
interface SchoolLevel {
  id: string;
  name: string;
  fromGrade: number;
  toGrade: number;
  classCount: number;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
}

interface ClassItem {
  id: string;
  grade: number;
  letter: string;
  levelId: string;
  level: { id: string; name: string; fromGrade: number; toGrade: number };
  curator: Teacher | null;
  studentCount: number;
}

/* ── Table styles (matching dashboard) ── */
const thStyle: React.CSSProperties = {
  color: TEXT_SEC,
  fontSize: 12,
  fontWeight: 600,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  padding: '8px 12px',
  background: 'transparent',
};

const tdStyle: React.CSSProperties = {
  color: 'var(--mantine-color-text)',
  fontSize: 13,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  padding: '8px 12px',
};

/* ── Helpers ── */
function curatorName(curator: Teacher | null): string {
  if (!curator) return '---';
  const mid = curator.middleName ? ` ${curator.middleName}` : '';
  return `${curator.lastName} ${curator.firstName}${mid}`;
}

/* ── Component ── */
export default function ClassesPage() {
  const [levels, setLevels] = useState<SchoolLevel[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [formGrade, setFormGrade] = useState<number | string>(1);
  const [formLetter, setFormLetter] = useState('');
  const [formLevelId, setFormLevelId] = useState<string | null>(null);
  const [formCuratorId, setFormCuratorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editClassId, setEditClassId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [levelsRes, classesRes] = await Promise.all([
        fetch('/api/v1/school-levels'),
        fetch('/api/v1/classes'),
      ]);
      const levelsData = await levelsRes.json();
      const classesData = await classesRes.json();

      if (levelsData.success) {
        setLevels(levelsData.data);
        if (!activeTab && levelsData.data.length > 0) {
          setActiveTab(levelsData.data[0].id);
        }
      }
      if (classesData.success) {
        setClasses(classesData.data);
      }
    } catch {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClasses = classes.filter((c) => c.levelId === activeTab);

  const openCreateModal = () => {
    setFormGrade(1);
    setFormLetter('');
    setFormLevelId(activeTab);
    setFormCuratorId(null);
    setFormError('');
    setEditClassId(null);
    setModalOpen(true);
  };

  const fetchClasses = fetchData;

  const handleCreate = async () => {
    if (!formLetter.trim() || !formLevelId) {
      setFormError('Заполните все обязательные поля');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const url = editClassId ? `/api/v1/classes/${editClassId}` : '/api/v1/classes';
      const method = editClassId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: Number(formGrade),
          letter: formLetter.trim().toUpperCase(),
          levelId: formLevelId,
          curatorId: formCuratorId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setModalOpen(false);
        setEditClassId(null);
        fetchData();
        notifications.show({ color: 'green', title: 'Готово', message: editClassId ? 'Класс обновлён' : 'Класс создан' });
      } else {
        setFormError(data.error?.message || 'Ошибка');
      }
    } catch {
      setFormError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader color="eruditBlue" />
      </Box>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap={8}>
          <IconSchool size={24} color="#228be6" stroke={1.5} />
          <Title order={3} c="var(--mantine-color-text)">
            Классы
          </Title>
          <Badge variant="light" color="gray" size="lg" radius="sm">
            {classes.length}
          </Badge>
        </Group>
        <Button leftSection={<IconPlus size={16} />} size="sm" onClick={openCreateModal}>
          Добавить класс
        </Button>
      </Group>

      {/* Tabs by school level */}
      {levels.length > 0 ? (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            {levels.map((level) => (
              <Tabs.Tab key={level.id} value={level.id}>
                {level.name}
                <Badge ml={8} size="xs" variant="light" color="gray" radius="sm">
                  {level.classCount}
                </Badge>
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {levels.map((level) => (
            <Tabs.Panel key={level.id} value={level.id} pt="md">
              <Paper
                style={{
                  background: SURFACE,
                  border: `1px solid ${SURFACE_BORDER}`,
                }}
                radius="sm"
              >
                {filteredClasses.length === 0 ? (
                  <Box p="xl" style={{ textAlign: 'center' }}>
                    <Text c="dimmed" size="sm">
                      Нет классов для уровня &laquo;{level.name}&raquo;
                    </Text>
                  </Box>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={thStyle}>Класс</Table.Th>
                        <Table.Th style={thStyle}>Уровень</Table.Th>
                        <Table.Th style={thStyle}>Кол-во учеников</Table.Th>
                        <Table.Th style={thStyle}>Классный руководитель</Table.Th>
                        <Table.Th style={thStyle} ta="center">Действия</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredClasses.map((cls) => (
                        <Table.Tr key={cls.id}>
                          <Table.Td style={tdStyle}>
                            <Text fw={600} size="sm" c="var(--mantine-color-text)">
                              {cls.grade}
                              {cls.letter}
                            </Text>
                          </Table.Td>
                          <Table.Td style={tdStyle}>
                            <Badge variant="light" color="blue" size="sm" radius="sm">
                              {cls.level.name}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={tdStyle}>
                            <Badge
                              variant="light"
                              color={cls.studentCount > 0 ? 'teal' : 'gray'}
                              size="sm"
                              radius="sm"
                            >
                              {cls.studentCount} чел.
                            </Badge>
                          </Table.Td>
                          <Table.Td style={tdStyle}>
                            <Text size="sm" c={cls.curator ? 'var(--mantine-color-text)' : 'dimmed'}>
                              {curatorName(cls.curator)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={tdStyle} ta="center">
                            <Group gap={4} justify="center">
                              <Button
                                variant="subtle"
                                size="compact-xs"
                                color="blue"
                                leftSection={<IconPencil size={14} />}
                                onClick={() => {
                                  setFormGrade(cls.grade);
                                  setFormLetter(cls.letter);
                                  setFormLevelId(cls.levelId);
                                  setFormCuratorId(cls.curator?.id || '');
                                  setEditClassId(cls.id);
                                  setModalOpen(true);
                                }}
                              >
                                Изменить
                              </Button>
                              <Button
                                variant="subtle"
                                size="compact-xs"
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={async () => {
                                  if (cls.studentCount > 0) {
                                    notifications.show({ color: 'red', title: 'Ошибка', message: `Нельзя удалить класс ${cls.grade}${cls.letter} — в нём ${cls.studentCount} учеников` });
                                    return;
                                  }
                                  if (!confirm(`Удалить класс ${cls.grade}${cls.letter}?`)) return;
                                  try {
                                    const res = await fetch(`/api/v1/classes/${cls.id}`, { method: 'DELETE' });
                                    if (res.ok) {
                                      notifications.show({ color: 'green', title: 'Готово', message: `Класс ${cls.grade}${cls.letter} удалён` });
                                      fetchClasses();
                                    }
                                  } catch {}
                                }}
                              >
                                Удалить
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <Paper
          style={{
            background: SURFACE,
            border: `1px solid ${SURFACE_BORDER}`,
          }}
          p="xl"
          radius="sm"
        >
          <Text c="dimmed" ta="center">
            Уровни обучения не настроены. Добавьте уровни (Начальная / Средняя / Старшая) в базе данных.
          </Text>
        </Paper>
      )}

      {/* Create Class Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editClassId ? "Редактировать класс" : "Добавить класс"}
        centered
        styles={{
          header: { background: SURFACE, borderBottom: `1px solid ${SURFACE_BORDER}` },
          body: { background: SURFACE },
          content: { background: SURFACE },
        }}
      >
        <Stack gap="md">
          <NumberInput
            label="Номер класса"
            placeholder="Например: 5"
            min={1}
            max={12}
            value={formGrade}
            onChange={(val) => setFormGrade(val)}
            required
          />
          <TextInput
            label="Буква класса"
            placeholder="Например: А"
            maxLength={2}
            value={formLetter}
            onChange={(e) => setFormLetter(e.currentTarget.value)}
            required
          />
          <Select
            label="Уровень обучения"
            placeholder="Выберите уровень"
            data={levels.map((l) => ({ value: l.id, label: `${l.name} (${l.fromGrade}-${l.toGrade} кл.)` }))}
            value={formLevelId}
            onChange={setFormLevelId}
            required
          />
          <TextInput
            label="ID куратора (необязательно)"
            placeholder="ID преподавателя"
            value={formCuratorId || ''}
            onChange={(e) => setFormCuratorId(e.currentTarget.value || null)}
          />

          {formError && (
            <Text c="red" size="sm">
              {formError}
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} loading={submitting}>
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
