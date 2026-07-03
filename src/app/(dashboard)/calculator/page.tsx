'use client';

import { useState } from 'react';
import { Badge, Box, Button, Card, Checkbox, Divider, Grid, Group, Modal, Paper, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalculator } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['super_admin', 'founder', 'analyst'] as const;

const USD_RATE = 89;

const CORE = {
  name: 'Ядро платформы',
  setup: 89000,
  license: 89000,
} as const;

const STANDARD_MODULES = [
  'Домашние задания',
  'Тесты и контрольные',
  'Учебный план ученика',
  'КТП / учебная программа',
  'Планы уроков',
  'База знаний',
  'Портфолио',
  'Олимпиады',
  'Презентации / материалы урока',
  'Физнормативы',
  'Кружки и студии',
  'Экскурсии и поездки',
  'Питание',
  'Библиотека (учёт)',
  'Бюро находок',
  'Медиа-галерея',
  'Мероприятия / календарь',
  'Документы',
  'Согласия',
  'Опросы',
  'Заявления',
  'Отчёты',
  'Запись к директору',
  'HR-онбординг + анкеты',
  'Учёт часов учителя',
  'Отпуска и отгулы',
  'Замены уроков',
  'Закупки / хоз-заявки',
  'Достижения',
  'Выбытие / отчисления',
  'Групповые переводы',
  'Резерв / бронирование',
] as const;

const HEAVY_MODULES = [
  'AI-агент (ассистенты по ролям)',
  'Аналитика / BI',
  'Колл-центр / CRM обращений',
  'Приёмка и поступление',
  'Психолог (кейсы, DAP)',
  'Безопасность (инциденты + срочные)',
  'Мультифилиальность (филиалы + учредитель)',
] as const;

const STANDARD_SETUP = 6000;
const STANDARD_LICENSE = 8000;
const HEAVY_SETUP = 12000;
const HEAVY_LICENSE = 16000;

function formatSom(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} сом`;
}

function formatUsd(value: number) {
  const rounded = Math.round(value / USD_RATE / 100) * 100;
  return `≈ $${new Intl.NumberFormat('ru-RU').format(rounded)}`;
}

function CalculatorContent() {
  const [standardSelected, setStandardSelected] = useState<Set<string>>(new Set());
  const [heavySelected, setHeavySelected] = useState<Set<string>>(new Set());
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSchool, setContactSchool] = useState('');
  const [comment, setComment] = useState('');

  const standardCount = standardSelected.size;
  const heavyCount = heavySelected.size;
  const setupTotal = CORE.setup + STANDARD_SETUP * standardCount + HEAVY_SETUP * heavyCount;
  const licenseTotal = CORE.license + STANDARD_LICENSE * standardCount + HEAVY_LICENSE * heavyCount;

  function toggle(setter: (next: Set<string>) => void, current: Set<string>, name: string) {
    const next = new Set(current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setter(next);
  }

  function selectCoreOnly() {
    setStandardSelected(new Set());
    setHeavySelected(new Set());
  }

  function selectAllStandard() {
    setStandardSelected(new Set(STANDARD_MODULES));
    setHeavySelected(new Set());
  }

  function selectAll() {
    setStandardSelected(new Set(STANDARD_MODULES));
    setHeavySelected(new Set(HEAVY_MODULES));
  }

  function resetLeadForm() {
    setContactName('');
    setContactPhone('');
    setContactSchool('');
    setComment('');
  }

  async function submitLead() {
    if (!contactName.trim() || !contactPhone.trim()) {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Заполните имя контакта и телефон' });
      return;
    }

    setLeadSaving(true);
    try {
      const res = await fetch('/api/v1/tariff-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactSchool: contactSchool.trim() || undefined,
          comment: comment.trim() || undefined,
          standardModules: [...standardSelected],
          heavyModules: [...heavySelected],
          setupTotal,
          licenseTotal,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать заявку');
      notifications.show({ color: 'green', title: 'Заявка отправлена', message: 'Лид появился в заявках на тариф' });
      setLeadOpen(false);
      resetLeadForm();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось создать заявку',
      });
    } finally {
      setLeadSaving(false);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" gap="md">
        <Group gap="xs">
          <IconCalculator size={26} color="#1971c2" />
          <Title order={2}>Калькулятор тарифов</Title>
        </Group>
        <Badge variant="light" color="bilimosBlue" radius="sm">
          1$ = {USD_RATE} сом
        </Badge>
      </Group>

      <Group gap="xs">
        <Button size="xs" variant="light" color="gray" onClick={selectCoreOnly}>
          Только ядро
        </Button>
        <Button size="xs" variant="light" color="bilimosBlue" onClick={selectAllStandard}>
          Все обычные
        </Button>
        <Button size="xs" color="bilimosBlue" onClick={selectAll}>
          Выбрать всё
        </Button>
      </Group>

      <Grid gutter="md" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" gap="sm">
                <Title order={4}>Ядро</Title>
                <Badge variant="light" color="green" radius="sm">
                  Всегда включено
                </Badge>
              </Group>
              <Checkbox
                checked
                disabled
                label={CORE.name}
                description={`${formatSom(CORE.setup)} setup · ${formatSom(CORE.license)}/год`}
              />
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Stack gap="md">
              <Group justify="space-between" gap="sm">
                <Title order={4}>Обычные модули</Title>
                <Badge variant="light" color="blue" radius="sm">
                  {formatSom(STANDARD_SETUP)} setup · {formatSom(STANDARD_LICENSE)}/год
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {STANDARD_MODULES.map((name) => (
                  <Checkbox
                    key={name}
                    label={name}
                    checked={standardSelected.has(name)}
                    onChange={() => toggle(setStandardSelected, standardSelected, name)}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Stack gap="md">
              <Group justify="space-between" gap="sm">
                <Title order={4}>Тяжёлые модули</Title>
                <Badge variant="light" color="orange" radius="sm">
                  {formatSom(HEAVY_SETUP)} setup · {formatSom(HEAVY_LICENSE)}/год
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {HEAVY_MODULES.map((name) => (
                  <Checkbox
                    key={name}
                    label={name}
                    checked={heavySelected.has(name)}
                    onChange={() => toggle(setHeavySelected, heavySelected, name)}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box style={{ position: 'sticky', top: 16 }}>
            <Card withBorder radius="md" padding="lg">
              <Stack gap="md">
                <div>
                  <Text size="sm" c="dimmed">
                    Живой итог
                  </Text>
                  <Title order={3}>Тариф Bilim OS</Title>
                </div>

                <SimpleGrid cols={2} spacing="sm">
                  <Paper withBorder radius="sm" p="sm">
                    <Text size="xs" c="dimmed">
                      Обычных
                    </Text>
                    <Text fw={700} size="xl">
                      {standardCount}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="sm" p="sm">
                    <Text size="xs" c="dimmed">
                      Тяжёлых
                    </Text>
                    <Text fw={700} size="xl">
                      {heavyCount}
                    </Text>
                  </Paper>
                </SimpleGrid>

                <Divider />

                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    Setup
                  </Text>
                  <Text fw={800} size="xl">
                    {formatSom(setupTotal)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatUsd(setupTotal)}
                  </Text>
                </Stack>

                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    Лицензия
                  </Text>
                  <Text fw={800} size="xl">
                    {formatSom(licenseTotal)}/год
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatUsd(licenseTotal)}
                  </Text>
                </Stack>

                <Button color="bilimosBlue" onClick={() => setLeadOpen(true)}>
                  Отправить заявку
                </Button>
              </Stack>
            </Card>
          </Box>
        </Grid.Col>
      </Grid>

      <Modal opened={leadOpen} onClose={() => setLeadOpen(false)} title="Отправить заявку" centered radius="lg">
        <Stack gap="sm">
          <TextInput
            label="Имя контакта"
            required
            value={contactName}
            onChange={(event) => setContactName(event.currentTarget.value)}
          />
          <TextInput
            label="Телефон"
            required
            value={contactPhone}
            onChange={(event) => setContactPhone(event.currentTarget.value)}
          />
          <TextInput
            label="Школа"
            value={contactSchool}
            onChange={(event) => setContactSchool(event.currentTarget.value)}
          />
          <Textarea
            label="Комментарий"
            minRows={3}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />

          <Paper withBorder radius="sm" p="sm">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Итог
              </Text>
              <Text size="sm">Модулей: {standardCount + heavyCount}</Text>
              <Text size="sm">Setup: {formatSom(setupTotal)}</Text>
              <Text size="sm">Лицензия: {formatSom(licenseTotal)}/год</Text>
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLeadOpen(false)}>
              Отмена
            </Button>
            <Button loading={leadSaving} onClick={submitLead}>
              Отправить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function CalculatorPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <CalculatorContent />
    </RoleGate>
  );
}
