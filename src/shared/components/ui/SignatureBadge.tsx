'use client';

import { Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconSignature } from '@tabler/icons-react';
import { ROLE_LABELS, type AppRole } from '@/shared/constants/roles';

interface SignatureBadgeProps {
  name?: string | null;
  role?: string | null;
  date?: string | Date | null;
  label?: string;
}

function formatSignatureDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRole(role: string | null | undefined) {
  if (!role) return null;
  return role in ROLE_LABELS ? ROLE_LABELS[role as AppRole] : role;
}

export function SignatureBadge({ name, role, date, label = 'Подписал' }: SignatureBadgeProps) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const roleLabel = formatRole(role);
  const formattedDate = formatSignatureDate(date);

  if (!normalizedName) {
    return (
      <Group
        gap="xs"
        wrap="nowrap"
        px="xs"
        py={6}
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-default)',
        }}
      >
        <ThemeIcon variant="light" color="gray" size="sm" radius="sm">
          <IconSignature size={14} />
        </ThemeIcon>
        <Text size="xs" c="dimmed">
          Не подписано
        </Text>
      </Group>
    );
  }

  return (
    <Group
      gap="xs"
      wrap="nowrap"
      align="flex-start"
      px="xs"
      py={6}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'var(--mantine-color-body)',
      }}
    >
      <ThemeIcon variant="light" color="teal" size="sm" radius="sm">
        <IconSignature size={14} />
      </ThemeIcon>
      <Stack gap={1}>
        <Text size="xs" fw={600} lh={1.25}>
          {label}: {normalizedName}
        </Text>
        {(roleLabel || formattedDate) && (
          <Text size="xs" c="dimmed" lh={1.25}>
            {[roleLabel, formattedDate].filter(Boolean).join(' / ')}
          </Text>
        )}
      </Stack>
    </Group>
  );
}
