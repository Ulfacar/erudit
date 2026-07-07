'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Anchor, Badge, Card, Drawer, Group, Loader, Paper, Stack, Text, Title,
} from '@mantine/core';
import { IconBriefcase, IconCalendarEvent, IconUsers } from '@tabler/icons-react';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

type SubjectCardType = 'parent' | 'teacher';

interface SubjectCardData {
  type: SubjectCardType;
  cases: { id: string; title: string; stage: string; riskLevel: string; status: string }[];
  appointments: { at: string; topic: string; kind: string; status: string; trainingType: string | null }[];
  children?: { studentId: string; name: string; className: string }[];
}

const ROLE_LABEL: Record<SubjectCardType, string> = {
  parent: 'Родитель',
  teacher: 'Учитель',
};

const TRAINING_LABEL: Record<string, string> = {
  consultation: 'Консультация',
  seminar: 'Семинар',
  online_module: 'Онлайн-модуль',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  paused: 'Приостановлен',
  closed: 'Закрыт',
  scheduled: 'Запланировано',
  done: 'Проведено',
  cancelled: 'Отменено',
};

function Empty() {
  return <Text size="sm" c="dimmed">—</Text>;
}

export function SubjectPsyCard({
  subjectType,
  subjectId,
  subjectName,
  onClose,
}: {
  subjectType: SubjectCardType | null;
  subjectId: string | null;
  subjectName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<SubjectCardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!subjectType || !subjectId) return;

    setLoading(true);
    fetch(`/api/v1/psy/subject-card?type=${subjectType}&id=${encodeURIComponent(subjectId)}`)
      .then((r) => r.json())
      .then((j) => setData(j?.success ? j.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [subjectType, subjectId]);

  return (
    <Drawer opened={!!subjectType && !!subjectId} onClose={onClose} position="right" size="lg" title="Карточка субъекта" padding="lg">
      {loading || !data || !subjectType ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : (
        <Stack gap="lg">
          <div>
            <Title order={3}>{subjectName}</Title>
            <Badge variant="light" color={subjectType === 'parent' ? 'grape' : 'blue'} mt={6}>
              {ROLE_LABEL[subjectType]}
            </Badge>
          </div>

          {subjectType === 'parent' && (
            <Paper withBorder radius="md" p="md">
              <Group gap={6} mb="sm"><IconUsers size={16} /><Text fw={600}>Дети в школе</Text></Group>
              {!data.children?.length ? (
                <Empty />
              ) : (
                <Stack gap={4}>
                  {data.children.map((child) => (
                    <Group key={child.studentId} justify="space-between" wrap="nowrap">
                      <Anchor component={Link} href={`/students/${child.studentId}`} size="sm">
                        {child.name}
                      </Anchor>
                      <Badge variant="light" color="blue" size="sm">{child.className}</Badge>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          )}

          <Paper withBorder radius="md" p="md">
            <Group gap={6} mb="sm"><IconBriefcase size={16} /><Text fw={600}>Кейсы</Text></Group>
            {data.cases.length === 0 ? (
              <Empty />
            ) : (
              <Stack gap="xs">
                {data.cases.map((c) => (
                  <Card key={c.id} withBorder radius="sm" padding="sm" component={Link} href={`/psychologist/cases/${c.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text fw={500}>{c.title}</Text>
                      <Group gap="xs" wrap="nowrap">
                        <Badge variant="light">{c.stage}</Badge>
                        <Badge variant="outline">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Group gap={6} mb="sm"><IconCalendarEvent size={16} /><Text fw={600}>Консультации и тренинги</Text></Group>
            {data.appointments.length === 0 ? (
              <Empty />
            ) : (
              <Stack gap="xs">
                {data.appointments.map((a, idx) => {
                  const trainingType = a.trainingType || (a.kind === 'group' ? 'seminar' : 'consultation');
                  return (
                    <Card key={`${a.at}-${idx}`} withBorder radius="sm" padding="sm">
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <div style={{ minWidth: 0 }}>
                          <Text fw={500}>{a.topic}</Text>
                          <Text size="xs" c="dimmed">{fmtDate(a.at)}</Text>
                        </div>
                        <Group gap="xs" wrap="nowrap">
                          <Badge variant="light">{TRAINING_LABEL[trainingType] ?? trainingType}</Badge>
                          <Badge variant="outline">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                        </Group>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}
    </Drawer>
  );
}
