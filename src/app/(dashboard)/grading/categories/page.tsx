'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconSettings } from '@tabler/icons-react';

/* ── Theme-aware colors ── */
const SURFACE = 'var(--mantine-color-default)';
const SURFACE_BORDER = 'var(--mantine-color-default-border)';
const TEXT_SEC = 'var(--mantine-color-dimmed)';
const CELL_BG = 'var(--mantine-color-default-hover)';

/* ── Weight color map ── */
function weightColor(w: number): string {
  if (w >= 4) return '#40c057';
  if (w >= 3) return '#228be6';
  if (w >= 2) return '#fab005';
  return TEXT_SEC;
}

/* ── Types ── */
interface CategoryRow {
  id: string;
  name: string;
  weight: number;
  order: number;
}

/* ── Table cell styles ── */
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

export default function GradeCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Edit modal ──
  const [editModal, setEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editWeight, setEditWeight] = useState<number | ''>(1);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/grading/categories');
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function openEditModal(cat: CategoryRow) {
    setEditingCategory(cat);
    setEditWeight(cat.weight);
    setEditModal(true);
  }

  async function saveWeight() {
    if (!editingCategory || !editWeight) return;

    try {
      const res = await fetch('/api/v1/grading/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCategory.id, weight: editWeight }),
      });
      const json = await res.json();
      if (json.success) {
        setEditModal(false);
        setEditingCategory(null);
        fetchCategories();
      }
    } catch (err) {
      console.error('Failed to update weight:', err);
    }
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap={8}>
          <IconSettings size={24} color="#228be6" stroke={1.5} />
          <Title order={3} c="var(--mantine-color-text)">
            Категории оценок
          </Title>
          <Badge variant="light" color="gray" size="lg" radius="sm">
            {categories.length}
          </Badge>
        </Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          size="sm"
          color="gray"
          component="a"
          href="/grading"
        >
          Назад к журналу
        </Button>
      </Group>

      {/* Info block */}
      <Paper
        style={{
          background: 'rgba(34,139,230,0.08)',
          border: '1px solid rgba(34,139,230,0.2)',
          padding: 12,
        }}
      >
        <Text size="sm" c="#228be6">
          Удельный вес определяет значимость категории при расчёте средневзвешенной оценки.
          Чем выше вес (от 1 до 5), тем больше влияние оценки данной категории на итоговый балл.
        </Text>
      </Paper>

      {/* Table */}
      <Paper
        style={{
          background: SURFACE,
          border: `1px solid ${SURFACE_BORDER}`,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <Text c={TEXT_SEC}>Загрузка...</Text>
          </Box>
        ) : categories.length === 0 ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <Text c={TEXT_SEC}>Категории не найдены</Text>
          </Box>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ ...thStyle, width: 50 }}>№</Table.Th>
                  <Table.Th style={thStyle}>Категория</Table.Th>
                  <Table.Th style={{ ...thStyle, width: 140, textAlign: 'center' }}>
                    Удельный вес
                  </Table.Th>
                  <Table.Th style={{ ...thStyle, width: 100, textAlign: 'center' }}>
                    Порядок
                  </Table.Th>
                  <Table.Th style={{ ...thStyle, width: 80 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {categories.map((cat) => (
                  <Table.Tr
                    key={cat.id}
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Table.Td style={{ ...tdStyle, color: TEXT_SEC }}>{cat.order}</Table.Td>
                    <Table.Td style={{ ...tdStyle, color: '#fff', fontWeight: 500 }}>
                      {cat.name}
                    </Table.Td>
                    <Table.Td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Badge
                        size="lg"
                        radius="sm"
                        variant="light"
                        style={{
                          color: weightColor(cat.weight),
                          borderColor: weightColor(cat.weight),
                          fontWeight: 700,
                          minWidth: 36,
                        }}
                      >
                        {cat.weight}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ ...tdStyle, textAlign: 'center', color: TEXT_SEC }}>
                      {cat.order}
                    </Table.Td>
                    <Table.Td style={tdStyle}>
                      <Button
                        variant="subtle"
                        size="xs"
                        color="gray"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => openEditModal(cat)}
                      >
                        Изм.
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Paper>

      {/* Edit modal */}
      <Modal
        opened={editModal}
        onClose={() => {
          setEditModal(false);
          setEditingCategory(null);
        }}
        title={
          <Text fw={600} c="var(--mantine-color-text)">
            Редактировать удельный вес
          </Text>
        }
        centered
        size="sm"
        styles={{
          content: { backgroundColor: 'var(--mantine-color-default)', border: `1px solid ${SURFACE_BORDER}` },
          header: { backgroundColor: 'var(--mantine-color-default)' },
          body: { backgroundColor: 'var(--mantine-color-default)' },
        }}
      >
        <Stack gap="md">
          {editingCategory && (
            <Text size="sm" c="var(--mantine-color-text)" fw={500}>
              {editingCategory.name}
            </Text>
          )}

          <NumberInput
            label="Удельный вес (1-5)"
            value={editWeight}
            onChange={(v) => setEditWeight(typeof v === 'number' ? v : '')}
            min={1}
            max={5}
            size="sm"
            styles={{
              input: { backgroundColor: CELL_BG, borderColor: SURFACE_BORDER, color: '#fff' },
              label: { color: TEXT_SEC },
            }}
          />

          <Group justify="flex-end" gap="sm" mt="sm">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setEditModal(false);
                setEditingCategory(null);
              }}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={saveWeight} disabled={!editWeight}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
