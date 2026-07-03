'use client';

import Link from 'next/link';
import { Box, Button, Stack, Text } from '@mantine/core';
import { IconHammer } from '@tabler/icons-react';

interface ComingSoonProps {
  title: string;
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
      }}
    >
      <Box
        style={{
          background: 'var(--mantine-color-default)',
          borderRadius: 12,
          border: '1px solid var(--mantine-color-default-border)',
          padding: 48,
          textAlign: 'center',
          maxWidth: 420,
          width: '100%',
        }}
      >
        <Stack align="center" gap="md">
          <IconHammer size={48} stroke={1.5} color="#5c5f66" />
          <Text fw={700} size="xl" c="var(--mantine-color-text)">
            {title}
          </Text>
          <Text size="sm" c="var(--mantine-color-dimmed)">
            Этот раздел находится в разработке
          </Text>
          <Button
            component={Link}
            href="/dashboard"
            variant="light"
            color="bilimosBlue"
            radius="sm"
            mt="md"
          >
            Вернуться на главную
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
