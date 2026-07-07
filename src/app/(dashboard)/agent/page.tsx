'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Card, Group, Loader, Stack, Switch, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconRobot, IconAlertTriangle, IconChecklist, IconBulb, IconMail, IconCheck, IconX, IconPlayerPlay,
  IconBrandTelegram, IconSend,
} from '@tabler/icons-react';
import { EnablePushButton } from '@/shared/components/pwa/EnablePushButton';

interface Item {
  id: string; ruleKey: string | null; kind: string; severity: string;
  title: string; body: string; status: string; studentId: string | null; createdAt: string;
  payload?: { documentId?: string } | null;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  alert: <IconAlertTriangle size={18} />,
  task: <IconChecklist size={18} />,
  suggestion: <IconBulb size={18} />,
  draft: <IconMail size={18} />,
};
const SEV_COLOR: Record<string, string> = { info: 'blue', warn: 'orange', urgent: 'red' };
const KIND_LABEL: Record<string, string> = { alert: 'Алерт', task: 'Задача', suggestion: 'Совет', draft: 'Черновик' };

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function AgentPanelPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tg, setTg] = useState<{ configured: boolean; linked: boolean; url: string | null } | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [recommendationUrls, setRecommendationUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/agent/items${showAll ? '?status=all' : ''}`);
    const json = await res.json();
    if (json.success) setItems(json.data.items);
    setLoading(false);
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/v1/integrations/telegram/link')
      .then((r) => r.json())
      .then((j) => { if (j.success) setTg(j.data); })
      .catch(() => {});
  }, []);

  const act = useCallback(async (id: string, status: string) => {
    setBusy(id);
    try {
      await fetch(`/api/v1/agent/items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  const approve = useCallback(async (id: string, message: string) => {
    setBusy(id);
    try {
      await fetch(`/api/v1/agent/items/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  const fulfillRecommendation = useCallback(async (item: Item) => {
    const documentId = item.payload?.documentId;
    const fileUrl = recommendationUrls[item.id]?.trim();
    if (!documentId || !fileUrl) return;
    setBusy(item.id);
    try {
      const res = await fetch(`/api/v1/cc/documents/${documentId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        notifications.show({
          color: 'red',
          title: 'Ошибка',
          message: json.error?.message ?? 'Не удалось загрузить рекомендацию',
        });
        return;
      }
      setRecommendationUrls((prev) => ({ ...prev, [item.id]: '' }));
      await load();
    } catch {
      notifications.show({
        color: 'red',
        title: 'РћС€РёР±РєР°',
        message: 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЂРµРєРѕРјРµРЅРґР°С†РёСЋ',
      });
    } finally {
      setBusy(null);
    }
  }, [load, recommendationUrls]);

  const isClosed = (s: string) => s === 'done' || s === 'dismissed';

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconRobot size={26} color="var(--mantine-color-blue-6)" />
          <div>
            <Title order={2}>Панель агента</Title>
            <Text c="dimmed" size="sm">ИИ-ассистент следит за событиями и подсказывает, что сделать.</Text>
          </div>
        </Group>
        <Group gap="sm">
          <EnablePushButton />
          <Switch label="Показать закрытые" checked={showAll} onChange={(e) => setShowAll(e.currentTarget.checked)} />
        </Group>
      </Group>

      {tg?.configured && !tg.linked && tg.url && (
        <Alert color="blue" variant="light" icon={<IconBrandTelegram size={18} />}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">Получайте важные оповещения в Telegram — не нужно заходить на сайт.</Text>
            <Button size="xs" component="a" href={tg.url} target="_blank" leftSection={<IconBrandTelegram size={16} />}>
              Подключить Telegram
            </Button>
          </Group>
        </Alert>
      )}
      {tg?.linked && (
        <Group gap={6}><IconBrandTelegram size={16} color="var(--mantine-color-blue-6)" /><Text size="xs" c="dimmed">Telegram подключён — оповещения дублируются в чат.</Text></Group>
      )}

      {loading ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : items.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" ta="center">Пока всё спокойно — агенту нечего предложить.</Text>
        </Card>
      ) : (
        <Stack gap="xs">
          {items.map((it) => {
            const closed = isClosed(it.status);
            return (
              <Card key={it.id} withBorder radius="md" padding="sm" style={{ opacity: closed ? 0.6 : 1 }}>
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
                    <Badge color={SEV_COLOR[it.severity] ?? 'gray'} variant="light" leftSection={KIND_ICON[it.kind]}>
                      {KIND_LABEL[it.kind] ?? it.kind}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <Text fw={600}>{it.title}</Text>
                      {it.kind !== 'draft' && <Text size="sm" c="dimmed">{it.body}</Text>}
                      <Text size="xs" c="dimmed" mt={4}>{fmt(it.createdAt)}{it.status !== 'new' ? ` · ${it.status}` : ''}</Text>
                    </div>
                  </Group>
                  {!closed && it.kind !== 'draft' && (
                    <Group gap={4} wrap="nowrap">
                      {it.status === 'new' && (
                        <ActionIcon variant="subtle" color="blue" title="В работу" loading={busy === it.id} onClick={() => act(it.id, 'in_progress')}>
                          <IconPlayerPlay size={18} />
                        </ActionIcon>
                      )}
                      <ActionIcon variant="subtle" color="green" title="Готово" loading={busy === it.id} onClick={() => act(it.id, 'done')}>
                        <IconCheck size={18} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="gray" title="Скрыть" loading={busy === it.id} onClick={() => act(it.id, 'dismissed')}>
                        <IconX size={18} />
                      </ActionIcon>
                    </Group>
                  )}
                </Group>
                {!closed && it.kind === 'draft' && (
                  <Stack gap="xs" mt="sm">
                    <Textarea
                      autosize minRows={3}
                      value={edits[it.id] ?? it.body}
                      onChange={(e) => setEdits((p) => ({ ...p, [it.id]: e.currentTarget.value }))}
                    />
                    <Group justify="flex-end" gap="xs">
                      <Button variant="default" size="xs" leftSection={<IconX size={14} />} loading={busy === it.id} onClick={() => act(it.id, 'dismissed')}>
                        Отклонить
                      </Button>
                      <Button size="xs" color="green" leftSection={<IconSend size={14} />} loading={busy === it.id} onClick={() => approve(it.id, edits[it.id] ?? it.body)}>
                        Согласовать и отправить
                      </Button>
                    </Group>
                  </Stack>
                )}
                {!closed && it.ruleKey === 'cc-recommendation-requested' && it.payload?.documentId && (
                  <Stack gap="xs" mt="sm">
                    <TextInput
                      size="xs"
                      placeholder="Ссылка на файл"
                      value={recommendationUrls[it.id] ?? ''}
                      onChange={(e) => setRecommendationUrls((prev) => ({ ...prev, [it.id]: e.currentTarget.value }))}
                    />
                    <Group justify="flex-end">
                      <Button
                        size="xs"
                        loading={busy === it.id}
                        disabled={!recommendationUrls[it.id]?.trim()}
                        onClick={() => fulfillRecommendation(it)}
                      >
                        Загрузить рекомендацию
                      </Button>
                    </Group>
                  </Stack>
                )}
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
