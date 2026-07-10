'use client';

/**
 * «Главная» — хаб быстрых ссылок (Этап 9, по встрече с Эмиром).
 * Карточки-иконки из пунктов меню текущей роли: быстрый вход вместо длинного сайдбара.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { Paper, SimpleGrid, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { IconLayoutGrid } from '@tabler/icons-react';
import { useRole } from '@/shared/hooks/useRole';
import { SIDEBAR_NAV, filterNavByRole, flattenNavLeaves } from '@/shared/lib/nav-config';
import { SIDEBAR_ICONS } from '@/shared/lib/sidebar-icons';

// Личные «ленты» роли (дневник/сегодня) и сама «Главная» в хабе не нужны — это вход в разделы.
const SKIP = new Set(['/home', '/diary', '/today']);

export default function HomePage() {
  const { role, grantedModules } = useRole();

  // Разворачиваем сворачиваемые разделы в плоские листья — хаб остаётся гранулярным.
  // Под-страницы (напр. /schedule/bells) скрываем, если их родитель-лист уже показан.
  const items = useMemo(() => {
    const leaves = flattenNavLeaves(filterNavByRole(SIDEBAR_NAV, role, grantedModules)).filter((r) => !SKIP.has(r.href));
    return leaves.filter((l) => !leaves.some((p) => p !== l && l.href.startsWith(p.href + '/')));
  }, [role, grantedModules]);

  return (
    <Stack gap="lg" p="md">
      <Title order={2}>Главная</Title>
      <Text c="dimmed" size="sm">Быстрый переход в разделы. Полное меню — слева.</Text>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
        {items.map((item) => {
          const Icon = SIDEBAR_ICONS[item.href] ?? IconLayoutGrid;
          return (
            <Paper
              key={item.href}
              component={Link}
              href={item.href}
              withBorder
              radius="md"
              p="md"
              style={{ textDecoration: 'none', color: 'inherit', transition: 'box-shadow .15s, transform .15s' }}
              className="home-card"
            >
              <Stack gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="bilimosBlue" size={42} radius="md">
                  <Icon size={24} />
                </ThemeIcon>
                <Text fw={600} size="sm">{item.label}</Text>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>

      <style>{`.home-card:hover{box-shadow:0 4px 14px rgba(0,0,0,.08);transform:translateY(-2px);}`}</style>
    </Stack>
  );
}
