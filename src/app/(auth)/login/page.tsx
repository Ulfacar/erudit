'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  Box,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconUser } from '@tabler/icons-react';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      login: '',
      password: '',
    },
    validate: {
      login: (value) => (value.length < 1 ? 'Введите логин' : null),
      password: (value) => (value.length < 1 ? 'Введите пароль' : null),
    },
  });

  // If already authenticated, redirect to dashboard
  if (status === 'authenticated') {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        login: values.login,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Неверный логин или пароль');
      } else if (result?.ok) {
        router.push('/dashboard');
      }
    } catch {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  });

  // Show nothing while checking session
  if (status === 'loading') {
    return null;
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Box
        style={{
          width: 400,
          background: 'var(--mantine-color-default)',
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
          padding: 40,
        }}
      >
        <Stack align="center" gap={4} mb={32}>
          <Text fw={900} style={{ fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>
            <span style={{ color: 'var(--mantine-color-text)' }}>ER</span>
            <span style={{ color: '#e91e8c' }}>U</span>
            <span style={{ color: 'var(--mantine-color-text)' }}>DITE</span>
          </Text>
          <Text size="sm" c="dimmed" mt={8}>
            Система управления школой
          </Text>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Логин"
              placeholder="Введите логин"
              leftSection={<IconUser size={16} />}
              size="sm"
              styles={{
                label: { color: 'var(--mantine-color-dimmed)', fontSize: 13, marginBottom: 4 },
                input: {
                  backgroundColor: 'var(--mantine-color-body)',
                  borderColor: 'var(--mantine-color-default-border)',
                  color: 'var(--mantine-color-text)',
                },
              }}
              {...form.getInputProps('login')}
            />

            <PasswordInput
              label="Пароль"
              placeholder="Введите пароль"
              leftSection={<IconLock size={16} />}
              size="sm"
              styles={{
                label: { color: 'var(--mantine-color-dimmed)', fontSize: 13, marginBottom: 4 },
                input: {
                  backgroundColor: 'var(--mantine-color-body)',
                  borderColor: 'var(--mantine-color-default-border)',
                  color: 'var(--mantine-color-text)',
                },
              }}
              {...form.getInputProps('password')}
            />

            {error && (
              <Text size="sm" c="red" ta="center">
                {error}
              </Text>
            )}

            <Button
              type="submit"
              fullWidth
              mt="sm"
              size="sm"
              color="eruditBlue"
              radius="sm"
              loading={loading}
              styles={{
                root: { fontWeight: 600 },
              }}
            >
              Войти
            </Button>
          </Stack>
        </form>

        <Text size="xs" c="dimmed" ta="center" mt={24}>
          ERUDIT ERP v0.1.0
        </Text>
      </Box>
    </Box>
  );
}
