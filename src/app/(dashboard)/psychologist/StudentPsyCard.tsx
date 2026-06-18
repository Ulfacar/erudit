'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Anchor, Avatar, Badge, Box, Button, Card, Divider, Drawer, FileButton, Group,
  Loader, Paper, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import { IconFileText, IconUpload, IconUsers, IconCalendarEvent } from '@tabler/icons-react';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

const RISK: Record<string, { label: string; color: string }> = {
  green: { label: 'Зелёный', color: 'green' }, yellow: { label: 'Жёлтый', color: 'yellow' }, red: { label: 'Красный', color: 'red' },
};
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'Новый', color: 'gray' }, in_progress: { label: 'В работе', color: 'blue' },
  paused: { label: 'Приостановлен', color: 'orange' }, closed: { label: 'Закрыт', color: 'teal' },
};

interface CardData {
  profile: {
    id: string; name: string; className: string; photo: string | null; psyCode: string | null;
    dateOfBirth: string | null; enrolledAt: string | null; supportStart: string | null; supportEnd: string | null;
  };
  parents: { id: string; name: string; phone: string | null; relation: string }[];
  siblings: { id: string; name: string; className: string }[];
  cases: { id: string; title: string; riskLevel: string; status: string; openedAt: string; closedAt: string | null }[];
  parentMeetings: { id: string; date: string; type: string; qualNote: string | null }[];
  documents: { id: string; kind: string; title: string; fileName: string | null; fileUrl: string | null; createdAt: string }[];
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase">{label}</Text>
      <Text fw={500}>{value}</Text>
    </div>
  );
}

export function StudentPsyCard({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [openParent, setOpenParent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const resetRef = useRef<() => void>(null);

  async function load() {
    if (!studentId) return;
    setLoading(true);
    const j = await fetch(`/api/v1/psy/student-card/${studentId}`).then((r) => r.json()).catch(() => null);
    setData(j?.success ? j.data : null);
    setLoading(false);
  }
  useEffect(() => { setData(null); setOpenParent(null); if (studentId) load(); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(file: File | null) {
    if (!file || !studentId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('ownerType', 'student');
    fd.append('ownerId', studentId);
    fd.append('kind', 'документ');
    await fetch('/api/v1/documents/upload', { method: 'POST', body: fd }).catch(() => null);
    resetRef.current?.();
    setUploading(false);
    load();
  }

  const p = data?.profile;

  return (
    <Drawer opened={!!studentId} onClose={onClose} position="right" size="xl" title="Анкета ученика" padding="lg">
      {loading || !data || !p ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : (
        <Stack gap="lg">
          {/* Шапка */}
          <Group gap="md" wrap="nowrap">
            <Avatar src={p.photo ?? undefined} size={64} radius="md" color="grape">
              {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Title order={3}>{p.name}</Title>
              <Group gap="xs" mt={4}>
                <Badge variant="light" color="blue">{p.className}</Badge>
                {p.psyCode && <Badge variant="light" color="grape">№ {p.psyCode}</Badge>}
              </Group>
            </div>
          </Group>

          {/* Родители (кликабельны → работа с родителем) */}
          {data.parents.length > 0 && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">Родитель:</Text>
              {data.parents.map((par) => (
                <Anchor key={par.id} component="button" type="button" size="sm"
                  onClick={() => setOpenParent((cur) => (cur === par.id ? null : par.id))}>
                  {par.name}{par.phone ? ` · ${par.phone}` : ''} ({par.relation})
                </Anchor>
              ))}
            </Group>
          )}
          {openParent && (
            <Paper withBorder radius="md" p="sm" bg="rgba(156,54,181,0.05)">
              <Group gap={6} mb="xs"><IconCalendarEvent size={15} /><Text fw={600} size="sm">Работа с родителем</Text></Group>
              {data.parentMeetings.length === 0 ? (
                <Text size="sm" c="dimmed">Встреч с родителем пока не зафиксировано.</Text>
              ) : (
                <Stack gap={4}>
                  {data.parentMeetings.map((m) => (
                    <Text key={m.id} size="sm">{fmtDate(m.date)} — {m.qualNote || 'встреча с родителем'}</Text>
                  ))}
                </Stack>
              )}
            </Paper>
          )}

          {/* Общие сведения */}
          <Paper withBorder radius="md" p="md">
            <Text fw={600} mb="sm">Общие сведения</Text>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
              <Field label="Персональный №" value={p.psyCode ?? '—'} />
              <Field label="Дата рождения" value={p.dateOfBirth ? fmtDate(p.dateOfBirth) : '—'} />
              <Field label="Дата поступления" value={p.enrolledAt ? fmtDate(p.enrolledAt) : '—'} />
              <Field label="Начало сопровождения" value={p.supportStart ? fmtDate(p.supportStart) : '—'} />
              <Field label="Конец сопровождения" value={p.supportEnd ? fmtDate(p.supportEnd) : '—'} />
            </SimpleGrid>
          </Paper>

          {/* Siblings */}
          <Paper withBorder radius="md" p="md">
            <Group gap={6} mb="sm"><IconUsers size={16} /><Text fw={600}>Братья / сёстры в школе</Text></Group>
            {data.siblings.length === 0 ? (
              <Text size="sm" c="dimmed">Не найдено.</Text>
            ) : (
              <Stack gap={4}>
                {data.siblings.map((s) => (
                  <Group key={s.id} justify="space-between">
                    <Text size="sm">{s.name}</Text>
                    <Badge variant="light" color="blue" size="sm">{s.className}</Badge>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          {/* Документы */}
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Group gap={6}><IconFileText size={16} /><Text fw={600}>Документы</Text></Group>
              <FileButton resetRef={resetRef} onChange={upload}>
                {(props) => <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />} loading={uploading}>Загрузить</Button>}
              </FileButton>
            </Group>
            {data.documents.length === 0 ? (
              <Text size="sm" c="dimmed">Документов нет.</Text>
            ) : (
              <Stack gap={4}>
                {data.documents.map((d) => (
                  <Group key={d.id} justify="space-between" wrap="nowrap">
                    <Anchor href={`/api/v1/documents/file/${d.id}`} target="_blank" size="sm" truncate>
                      {d.title || d.fileName || 'Документ'}
                    </Anchor>
                    <Text size="xs" c="dimmed">{fmtDate(d.createdAt)}</Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          <Divider label="Кейсы / сопровождение" labelPosition="center" />

          {/* Кейсы */}
          {data.cases.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center">Кейсов пока нет.</Text>
          ) : (
            <Stack gap="sm">
              {data.cases.map((c) => (
                <Card key={c.id} withBorder radius="md" padding="sm" component={Link} href={`/psychologist/cases/${c.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={500}>{c.title}</Text>
                    <Group gap="xs" wrap="nowrap">
                      <Badge color={RISK[c.riskLevel]?.color} variant="light">{RISK[c.riskLevel]?.label ?? c.riskLevel}</Badge>
                      <Badge color={STATUS[c.status]?.color} variant="outline">{STATUS[c.status]?.label ?? c.status}</Badge>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    Открыт {fmtDate(c.openedAt)}{c.closedAt ? ` · закрыт ${fmtDate(c.closedAt)}` : ''}
                  </Text>
                </Card>
              ))}
            </Stack>
          )}
          <Box />
        </Stack>
      )}
    </Drawer>
  );
}
