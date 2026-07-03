'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import {
  Affix,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconApps,
  IconCalculator,
  IconCheck,
  IconCircleDot,
  IconFlame,
  IconLayoutGrid,
  IconLock,
  IconPlus,
  IconSend,
  IconStack2,
  IconStars,
} from '@tabler/icons-react';
import { BilimosLogo } from '@/shared/components/ui/BilimosLogo';
import {
  CORE,
  HEAVY_LICENSE,
  HEAVY_MODULES,
  HEAVY_SETUP,
  STANDARD_LICENSE,
  STANDARD_MODULES,
  STANDARD_SETUP,
  USD_RATE,
  computeTotals,
} from '@/shared/lib/tariff-config';

type AccentColor = 'teal' | 'bilimosBlue' | 'orange';
type GroupIcon = ComponentType<{ size?: number }>;

function formatSom(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} сом`;
}

function formatUsd(value: number) {
  const rounded = Math.round(value / USD_RATE / 100) * 100;
  return `≈ $${new Intl.NumberFormat('ru-RU').format(rounded)}`;
}

function ModuleCard({
  name,
  selected,
  accent,
  onClick,
}: {
  name: string;
  selected: boolean;
  accent: AccentColor;
  onClick: () => void;
}) {
  const theme = useMantineTheme();

  return (
    <UnstyledButton
      className="module-card"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        borderRadius: 12,
        padding: '10px 12px',
        border: '1px solid',
        borderColor: selected ? `var(--mantine-color-${accent}-4)` : theme.other.surfaceBorder,
        background: selected ? `var(--mantine-color-${accent}-0)` : '#fff',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        width: '100%',
        transition: 'all .15s ease',
      }}
    >
      <ThemeIcon size={26} radius="xl" variant={selected ? 'filled' : 'light'} color={selected ? accent : 'gray'}>
        {selected ? <IconCheck size={16} /> : <IconPlus size={16} />}
      </ThemeIcon>
      <Text size="sm" fw={selected ? 600 : 500} lineClamp={2}>
        {name}
      </Text>
    </UnstyledButton>
  );
}

function ModuleGroup({
  title,
  countText,
  priceText,
  selectedCount,
  accent,
  icon: Icon,
  children,
}: {
  title: string;
  countText: string;
  priceText?: string;
  selectedCount?: number;
  accent: AccentColor;
  icon: GroupIcon;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Group gap="sm" align="flex-start">
            <ThemeIcon variant="light" color={accent} size={34} radius="md">
              <Icon size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4}>{title}</Title>
              <Text size="xs" c="dimmed">
                {countText}
              </Text>
            </Box>
          </Group>
          <Group gap="xs" justify="flex-end">
            {priceText && (
              <Badge variant="light" color={accent} size="lg" radius="sm">
                {priceText}
              </Badge>
            )}
            {Boolean(selectedCount) && (
              <Badge variant="filled" color={accent} radius="xl">
                {selectedCount} выбрано
              </Badge>
            )}
          </Group>
        </Group>
        {children}
      </Stack>
    </Paper>
  );
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
  const [website, setWebsite] = useState('');

  const standardModules = [...standardSelected];
  const heavyModules = [...heavySelected];
  const standardCount = standardModules.length;
  const heavyCount = heavyModules.length;
  const { setupTotal, licenseTotal } = computeTotals(standardModules, heavyModules);

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
    setWebsite('');
  }

  async function submitLead() {
    if (!contactName.trim() || !contactPhone.trim()) {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Заполните имя контакта и телефон' });
      return;
    }

    setLeadSaving(true);
    try {
      const res = await fetch('/api/v1/public/tariff-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactSchool: contactSchool.trim() || undefined,
          comment: comment.trim() || undefined,
          standardModules,
          heavyModules,
          website,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось отправить заявку');
      notifications.show({
        color: 'green',
        title: 'Заявка отправлена',
        message: 'Спасибо! Мы свяжемся с вами в ближайшее время',
      });
      setLeadOpen(false);
      resetLeadForm();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось отправить заявку',
      });
    } finally {
      setLeadSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      <Paper
        radius="lg"
        p="xl"
        style={{ background: 'linear-gradient(135deg, var(--mantine-color-bilimosBlue-0), #fff5f0)' }}
      >
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="md" align="flex-start">
            <ThemeIcon size={48} radius="md" variant="light" color="bilimosBlue">
              <IconCalculator size={28} />
            </ThemeIcon>
            <Box>
              <Title order={2}>Калькулятор тарифов</Title>
              <Text size="sm" c="dimmed">
                Соберите комплектацию Bilim OS — цена пересчитывается сразу
              </Text>
            </Box>
          </Group>
          <Badge variant="light" color="gray" size="lg" radius="sm">
            1$ = {USD_RATE} сом
          </Badge>
        </Group>
      </Paper>

      <Button.Group>
        <Button
          variant="default"
          size="sm"
          radius="md"
          leftSection={<IconCircleDot size={16} />}
          onClick={selectCoreOnly}
        >
          Только ядро
        </Button>
        <Button
          variant="default"
          size="sm"
          radius="md"
          leftSection={<IconStack2 size={16} />}
          onClick={selectAllStandard}
        >
          Все обычные
        </Button>
        <Button variant="default" size="sm" radius="md" leftSection={<IconStars size={16} />} onClick={selectAll}>
          Выбрать всё
        </Button>
      </Button.Group>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg" pb={{ base: 80, lg: 0 }}>
            <ModuleGroup title="Ядро" countText="1 модуль" accent="teal" icon={IconLayoutGrid}>
              <UnstyledButton
                className="module-card"
                aria-pressed
                style={{
                  borderRadius: 12,
                  padding: '10px 12px',
                  border: '1px solid',
                  borderColor: 'var(--mantine-color-teal-4)',
                  background: 'var(--mantine-color-teal-0)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  width: '100%',
                  transition: 'all .15s ease',
                  cursor: 'default',
                }}
              >
                <ThemeIcon size={26} radius="xl" variant="filled" color="teal">
                  <IconLock size={14} />
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Text size="sm" fw={600} lineClamp={2}>
                    {CORE.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatSom(CORE.setup)} setup · {formatSom(CORE.license)}/год
                  </Text>
                </Box>
                <Badge variant="light" color="teal" radius="sm">
                  Всегда включено
                </Badge>
              </UnstyledButton>
            </ModuleGroup>

            <ModuleGroup
              title="Обычные"
              countText={`${STANDARD_MODULES.length} модулей`}
              priceText={`+${formatSom(STANDARD_SETUP)} setup · +${formatSom(STANDARD_LICENSE)}/год за модуль`}
              selectedCount={standardCount}
              accent="bilimosBlue"
              icon={IconApps}
            >
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="xs">
                {STANDARD_MODULES.map((name) => (
                  <ModuleCard
                    key={name}
                    name={name}
                    selected={standardSelected.has(name)}
                    accent="bilimosBlue"
                    onClick={() => toggle(setStandardSelected, standardSelected, name)}
                  />
                ))}
              </SimpleGrid>
            </ModuleGroup>

            <ModuleGroup
              title="Тяжёлые"
              countText={`${HEAVY_MODULES.length} модулей`}
              priceText={`+${formatSom(HEAVY_SETUP)} setup · +${formatSom(HEAVY_LICENSE)}/год за модуль`}
              selectedCount={heavyCount}
              accent="orange"
              icon={IconFlame}
            >
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="xs">
                {HEAVY_MODULES.map((name) => (
                  <ModuleCard
                    key={name}
                    name={name}
                    selected={heavySelected.has(name)}
                    accent="orange"
                    onClick={() => toggle(setHeavySelected, heavySelected, name)}
                  />
                ))}
              </SimpleGrid>
            </ModuleGroup>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box style={{ position: 'sticky', top: 88 }}>
            <Card radius="lg" padding="xl" withBorder shadow="md" visibleFrom="lg">
              <Stack gap="md">
                <Box>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                    Ваш тариф
                  </Text>
                  <Title order={3}>Bilim OS</Title>
                </Box>

                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Ядро — 1</Text>
                    <Badge variant="light" color="teal">
                      1
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Обычные — {standardCount}</Text>
                    <Badge variant="light" color="bilimosBlue">
                      {standardCount}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Тяжёлые — {heavyCount}</Text>
                    <Badge variant="light" color="orange">
                      {heavyCount}
                    </Badge>
                  </Group>
                </Stack>

                <Divider />

                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    Setup (разово)
                  </Text>
                  <Text fw={800} fz={28} style={{ fontVariantNumeric: 'tabular-nums' }}>
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
                  <Text fw={800} fz={28} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSom(licenseTotal)}{' '}
                    <Text component="span" size="sm" c="dimmed">
                      /год
                    </Text>
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatUsd(licenseTotal)}
                  </Text>
                </Stack>

                <Button
                  size="lg"
                  radius="md"
                  fullWidth
                  color="bilimosBlue"
                  leftSection={<IconSend size={18} />}
                  onClick={() => setLeadOpen(true)}
                >
                  Отправить заявку
                </Button>
                <Text size="xs" c="dimmed" ta="center">
                  Расчёт предварительный, без учёта скидок
                </Text>
              </Stack>
            </Card>
          </Box>
        </Grid.Col>
      </Grid>

      <Affix position={{ bottom: 0, left: 0, right: 0 }} hiddenFrom="lg">
        <Paper p="md" shadow="lg" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Group justify="space-between" gap="sm">
            <Box>
              <Text size="xs" c="dimmed">
                Setup / Лицензия
              </Text>
              <Text fw={700} size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatSom(setupTotal)} · {formatSom(licenseTotal)}/год
              </Text>
            </Box>
            <Button size="sm" color="bilimosBlue" onClick={() => setLeadOpen(true)}>
              Заявка
            </Button>
          </Group>
        </Paper>
      </Affix>

      <Modal
        opened={leadOpen}
        onClose={() => setLeadOpen(false)}
        size="md"
        radius="lg"
        centered
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" size={30}>
              <IconSend size={16} />
            </ThemeIcon>
            <Text fw={700}>Заявка на тариф</Text>
          </Group>
        }
      >
        <Stack gap="sm">
          <input
            name="website"
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.currentTarget.value)}
          />
          <TextInput
            label="Имя контакта"
            placeholder="Айгуль Асанова"
            required
            radius="md"
            value={contactName}
            onChange={(event) => setContactName(event.currentTarget.value)}
          />
          <TextInput
            label="Телефон"
            placeholder="+996 ..."
            required
            radius="md"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.currentTarget.value)}
          />
          <TextInput
            label="Школа"
            placeholder="Intellect School"
            radius="md"
            value={contactSchool}
            onChange={(event) => setContactSchool(event.currentTarget.value)}
          />
          <Textarea
            label="Комментарий"
            placeholder="Пожелания, сроки..."
            minRows={3}
            radius="md"
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />

          <Paper radius="md" p="md" style={{ background: 'var(--mantine-color-bilimosBlue-0)' }}>
            <Stack gap="xs">
              <Text size="sm" c="dimmed" fw={600}>
                Итог
              </Text>
              <Group justify="space-between">
                <Text size="sm">Модулей</Text>
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {standardCount + heavyCount}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Setup</Text>
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatSom(setupTotal)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Лицензия/год</Text>
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatSom(licenseTotal)}
                </Text>
              </Group>
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setLeadOpen(false)}>
              Отмена
            </Button>
            <Button color="bilimosBlue" leftSection={<IconSend size={18} />} loading={leadSaving} onClick={submitLead}>
              Отправить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export function PublicCalculator() {
  return (
    <Box bg="gray.0" mih="100vh">
      <Box
        component="header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: '#fff',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <Container size="xl" py="sm">
          <Group justify="space-between" align="center">
            <Box component="a" href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              <BilimosLogo size="md" />
            </Box>
            <Button component="a" href="/login" variant="subtle" color="bilimosBlue">
              Вход для школ
            </Button>
          </Group>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <CalculatorContent />
      </Container>

      <Box component="footer" py="lg">
        <Text ta="center" size="sm" c="dimmed">
          © Bilim OS · bilimos.kg
        </Text>
      </Box>
    </Box>
  );
}
