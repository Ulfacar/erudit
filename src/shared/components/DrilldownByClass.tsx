'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconChevronRight, IconUsers } from '@tabler/icons-react';

export interface DrillItem {
  id: string;
  /** Ссылка на профиль/деталь (если переход — навигация). */
  href?: string;
  /** Либо обработчик клика по строке (если переход — модалка и т.п.). */
  onClick?: () => void;
  primary: string;
  secondary?: string;
  /** Контент справа (бейдж суммы, статус и т.п.). */
  right?: ReactNode;
  /** Дополнительное действие справа (кнопка). */
  action?: ReactNode;
}

export interface DrillGroup {
  key: string;
  /** Заголовок группы (название класса). */
  title: string;
  /** Подзаголовок (напр. сумма долга / куратор). */
  subtitle?: string;
  /** Число для бейджа на карточке класса. */
  count: number;
  /** Цвет бейджа. */
  countColor?: string;
  items: DrillItem[];
}

/**
 * Двухуровневый дрилл-даун по классам: сетка карточек классов →
 * клик → список учеников этого класса со ссылкой в профиль.
 * Переиспользуется колл-центром (должники) и психологом (кейсы).
 */
export function DrilldownByClass({ groups, emptyText = 'Нет данных' }: { groups: DrillGroup[]; emptyText?: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = groups.find((g) => g.key === openKey) ?? null;

  if (groups.length === 0) return <Text c="dimmed" ta="center" py="xl">{emptyText}</Text>;

  if (open) {
    return (
      <Stack gap="sm">
        <Group justify="space-between">
          <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconArrowLeft size={15} />} onClick={() => setOpenKey(null)}>
            Все классы
          </Button>
          <Group gap="xs"><Text fw={600}>{open.title}</Text>{open.subtitle && <Text size="sm" c="dimmed">· {open.subtitle}</Text>}</Group>
        </Group>
        <Stack gap={6}>
          {open.items.map((it) => (
            <Card key={it.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ minWidth: 0 }}>
                  {it.href ? (
                    <Link href={it.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Text fw={500} truncate>{it.primary}</Text>
                    </Link>
                  ) : (
                    <Text fw={500} truncate style={{ cursor: it.onClick ? 'pointer' : 'default' }} onClick={it.onClick}>{it.primary}</Text>
                  )}
                  {it.secondary && <Text size="xs" c="dimmed">{it.secondary}</Text>}
                </Box>
                <Group gap="xs" wrap="nowrap">
                  {it.right}
                  {it.action}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    );
  }

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
      {groups.map((g) => (
        <Card key={g.key} withBorder radius="md" padding="md" style={{ cursor: 'pointer' }} onClick={() => setOpenKey(g.key)}>
          <Group justify="space-between" mb={4}>
            <Text fw={700} size="lg">{g.title}</Text>
            <Badge color={g.countColor ?? 'blue'} variant="light" leftSection={<IconUsers size={11} />}>{g.count}</Badge>
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" truncate>{g.subtitle ?? ''}</Text>
            <IconChevronRight size={15} color="var(--mantine-color-dimmed)" />
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
