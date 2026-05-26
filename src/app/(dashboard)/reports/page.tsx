'use client';

import { Group, Paper, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { IconChartBar, IconCalendarStats, IconArrowRight } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

import { RoleGate } from '@/shared/components/auth/RoleGate';

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const reports = [
  {
    href: '/reports/grades',
    icon: IconChartBar,
    color: 'blue',
    title: 'Успеваемость',
    description: 'Матрица оценок по классу и предмету. Средневзвешенный балл, экспорт в Excel.',
  },
  {
    href: '/reports/attendance',
    icon: IconCalendarStats,
    color: 'teal',
    title: 'Посещаемость',
    description: 'Сводка посещаемости по классу за период. Пропуски, опоздания, процент явки.',
  },
];

export default function ReportsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'curator', 'teacher']}>
      <motion.div variants={pageVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          <Title order={2}>Отчёты</Title>

          <Group grow align="stretch">
            {reports.map((r) => (
              <Paper
                key={r.href}
                component={Link}
                href={r.href}
                p="xl"
                radius="md"
                withBorder
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <Stack gap="md">
                  <Group justify="space-between">
                    <ThemeIcon size={48} radius="md" color={r.color} variant="light">
                      <r.icon size={24} />
                    </ThemeIcon>
                    <IconArrowRight size={20} style={{ opacity: 0.4 }} />
                  </Group>
                  <div>
                    <Text fw={600} size="lg">{r.title}</Text>
                    <Text size="sm" c="dimmed" mt={4}>{r.description}</Text>
                  </div>
                </Stack>
              </Paper>
            ))}
          </Group>
        </Stack>
      </motion.div>
    </RoleGate>
  );
}
