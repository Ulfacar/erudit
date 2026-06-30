'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Group, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconQrcode } from '@tabler/icons-react';
import { printQrLabels } from '@/shared/lib/qr-print';

type QrMode = 'fix' | 'film';

interface Props {
  mode: QrMode;
  defaultLocation?: string;
  label?: string;
}

interface QrConfig {
  configured: boolean;
  botUsername: string | null;
}

export function TelegramQrPrint({ mode, defaultLocation = '', label = 'QR для Telegram' }: Props) {
  const [config, setConfig] = useState<QrConfig | null>(null);
  const [location, setLocation] = useState(defaultLocation);
  const payload = useMemo(() => buildPayload(mode, location), [mode, location]);
  const link = config?.botUsername && payload ? `https://t.me/${config.botUsername}?start=${payload}` : null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/integrations/telegram/qr-config')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setConfig(json.data);
      })
      .catch(() => {
        if (!cancelled) setConfig({ configured: false, botUsername: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config?.configured) return null;

  async function print() {
    if (!link || !location.trim()) {
      notifications.show({ color: 'red', title: 'Нужно место', message: 'Укажите кабинет или локацию для QR.' });
      return;
    }
    try {
      await printQrLabels([{ code: link, caption: `${label}: ${location.trim()}` }], `${label} - ${location.trim()}`);
    } catch {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Не удалось сгенерировать QR.' });
    }
  }

  return (
    <Group gap="xs" align="end">
      <TextInput
        size="xs"
        label={label}
        placeholder="Кабинет 204"
        leftSection={<IconQrcode size={14} />}
        value={location}
        onChange={(event) => setLocation(event.currentTarget.value)}
        w={220}
      />
      <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={print}>
        Печать QR
      </Button>
    </Group>
  );
}

function buildPayload(mode: QrMode, location: string): string | null {
  const safeLocation = location
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 50);
  if (!safeLocation) return null;
  return `${mode}_${safeLocation}`;
}
