'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import {
  Affix,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  SegmentedControl,
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
  IconLayoutGrid,
  IconLock,
  IconPlus,
  IconSend,
  IconSparkles,
} from '@tabler/icons-react';
import { BilimosLogo } from '@/shared/components/ui/BilimosLogo';
import {
  ADDON_MODULES,
  CORE_MODULE,
  DEFAULT_PRESET_ID,
  DEFAULT_SCHOOL_SIZE,
  PRESETS,
  SCHOOL_SIZES,
  USD_RATE,
  computeTariff,
  getModuleById,
  resolveModuleIds,
  type PresetId,
  type PricingMode,
  type SchoolSizeId,
  type TariffModule,
} from '@/shared/lib/tariff-config';

type AccentColor = 'teal' | 'bilimosBlue' | 'orange';
type GroupIcon = ComponentType<{ size?: number }>;
type PaymentView = 'annual' | 'monthly';

const DEFAULT_ADDONS = PRESETS.find((preset) => preset.id === DEFAULT_PRESET_ID)?.addonIds ?? [];
const PUBLIC_PRESETS = PRESETS.filter((preset) => !preset.hidden);
const REQUIRED_MODULES = [CORE_MODULE, ...ADDON_MODULES.filter((module) => module.required)];
const OPTIONAL_MODULES = ADDON_MODULES.filter((module) => !module.required);

function formatSom(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} сом`;
}

function formatUsd(value: number) {
  const rounded = Math.round(value / USD_RATE / 100) * 100;
  return `≈ $${new Intl.NumberFormat('ru-RU').format(rounded)}`;
}

function ModuleCard({
  module,
  selected,
  accent,
  badge,
  locked,
  onClick,
}: {
  module: TariffModule;
  selected: boolean;
  accent: AccentColor;
  badge?: string;
  locked?: boolean;
  onClick?: () => void;
}) {
  const theme = useMantineTheme();

  return (
    <UnstyledButton
      className="module-card"
      aria-pressed={selected}
      onClick={onClick}
      disabled={locked}
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
        cursor: locked ? 'default' : 'pointer',
      }}
    >
      <ThemeIcon size={26} radius="xl" variant={selected ? 'filled' : 'light'} color={selected ? accent : 'gray'}>
        {locked ? <IconLock size={14} /> : selected ? <IconCheck size={16} /> : <IconPlus size={16} />}
      </ThemeIcon>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={selected ? 600 : 500} lineClamp={2}>
          {module.label}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {module.description}
        </Text>
      </Box>
      {badge && (
        <Badge variant="light" color={accent} radius="sm">
          {badge}
        </Badge>
      )}
    </UnstyledButton>
  );
}

function ModuleGroup({
  title,
  countText,
  selectedCount,
  accent,
  icon: Icon,
  children,
}: {
  title: string;
  countText: string;
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
          {Boolean(selectedCount) && (
            <Badge variant="filled" color={accent} radius="xl">
              {selectedCount} выбрано
            </Badge>
          )}
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}

function CalculatorContent() {
  const theme = useMantineTheme();
  const [schoolSize, setSchoolSize] = useState<SchoolSizeId>(DEFAULT_SCHOOL_SIZE);
  const [mode, setMode] = useState<PricingMode>('preset');
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const [addonIds, setAddonIds] = useState<Set<string>>(() => new Set(DEFAULT_ADDONS));
  const [paymentView, setPaymentView] = useState<PaymentView>('annual');
  const [aiInterest, setAiInterest] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSchool, setContactSchool] = useState('');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState('');

  const selectedAddonIds = [...addonIds];
  const quote = computeTariff({ schoolSize, mode, presetId, addonIds: selectedAddonIds });
  const selectedSize = SCHOOL_SIZES.find((item) => item.id === schoolSize) ?? SCHOOL_SIZES[1];
  const selectedPreset = PRESETS.find((preset) => preset.id === presetId);
  const summaryTariff =
    mode === 'preset' ? selectedPreset?.label ?? '—' : `Свой набор · ${1 + addonIds.size} модулей`;

  function toggleAddon(id: string) {
    const next = new Set(addonIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAddonIds(next);
  }

  function switchMode(value: string) {
    const nextMode = value as PricingMode;
    setMode(nextMode);
    if (nextMode === 'custom') {
      setAddonIds(new Set(DEFAULT_ADDONS));
    }
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
          schoolSize,
          pricingMode: mode,
          presetId: mode === 'preset' ? presetId : undefined,
          addonIds: mode === 'custom' ? selectedAddonIds : undefined,
          aiInterest,
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
      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg" pb={{ base: 80, lg: 0 }}>
            <Paper
              radius="lg"
              p="xl"
              style={{ background: 'linear-gradient(135deg, var(--mantine-color-bilimosBlue-0), #ffffff)' }}
            >
              <Group justify="space-between" align="flex-start" gap="md">
                <Group gap="md" align="flex-start">
                  <ThemeIcon size={48} radius="md" variant="light" color="bilimosBlue">
                    <IconCalculator size={28} />
                  </ThemeIcon>
                  <Box>
                    <Title order={2}>Калькулятор стоимости Bilim OS</Title>
                    <Text size="sm" c="dimmed">
                      Выберите размер школы и тариф — расчёт обновится сразу
                    </Text>
                  </Box>
                </Group>
                <Badge variant="light" color="gray" size="lg" radius="sm">
                  1$ = {USD_RATE} сом
                </Badge>
              </Group>
            </Paper>

            <Paper withBorder radius="lg" p="lg">
              <Stack gap="md">
                <Box>
                  <Title order={4}>Размер школы</Title>
                  <Text size="xs" c="dimmed">
                    Выберите диапазон по числу учеников
                  </Text>
                </Box>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  {SCHOOL_SIZES.map((size) => {
                    const selected = size.id === schoolSize;
                    return (
                      <UnstyledButton
                        key={size.id}
                        aria-pressed={selected}
                        onClick={() => setSchoolSize(size.id)}
                        style={{
                          borderRadius: 12,
                          border: '1px solid',
                          borderColor: selected ? 'var(--mantine-color-bilimosBlue-4)' : theme.other.surfaceBorder,
                          background: selected ? 'var(--mantine-color-bilimosBlue-0)' : '#fff',
                          padding: 16,
                          minHeight: 84,
                        }}
                      >
                        <Group gap="sm" align="center" wrap="nowrap">
                          <ThemeIcon color={selected ? 'bilimosBlue' : 'gray'} variant={selected ? 'filled' : 'light'}>
                            <IconCheck size={16} />
                          </ThemeIcon>
                          <Text fw={700}>{size.label}</Text>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            </Paper>

            <Paper withBorder radius="lg" p="lg">
              <Stack gap="sm">
                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={switchMode}
                  data={[
                    { value: 'preset', label: 'Тариф' },
                    { value: 'custom', label: 'Свой набор' },
                  ]}
                />
                {mode === 'custom' && (
                  <Text size="sm" c="dimmed">
                    Считается по той же формуле — без наценки
                  </Text>
                )}
              </Stack>
            </Paper>

            {mode === 'preset' ? (
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                {PUBLIC_PRESETS.map((preset) => {
                  const selected = preset.id === presetId;
                  const modules = resolveModuleIds('preset', preset.id);
                  const presetQuote = computeTariff({ schoolSize, mode: 'preset', presetId: preset.id });

                  return (
                    <UnstyledButton
                      key={preset.id}
                      aria-pressed={selected}
                      onClick={() => setPresetId(preset.id)}
                      style={{
                        height: '100%',
                        borderRadius: 12,
                        border: '1px solid',
                        borderColor: selected ? 'var(--mantine-color-bilimosBlue-4)' : theme.other.surfaceBorder,
                        background: selected ? 'var(--mantine-color-bilimosBlue-0)' : '#fff',
                        padding: 18,
                      }}
                    >
                      <Stack gap="sm" h="100%">
                        <Group justify="space-between" align="flex-start" gap="xs">
                          <Title order={4}>{preset.label}</Title>
                          {preset.recommended && (
                            <Badge color="orange" variant="light" radius="sm">
                              Рекомендуем
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" c="dimmed">
                          {preset.description}
                        </Text>
                        <Stack gap={6} style={{ flex: 1 }}>
                          {modules.map((id) => {
                            const module = getModuleById(id);
                            if (!module) return null;
                            return (
                              <Group key={id} gap={6} wrap="nowrap">
                                <IconCheck size={14} color="var(--mantine-color-teal-6)" />
                                <Text size="xs" lineClamp={1}>
                                  {module.label}
                                </Text>
                              </Group>
                            );
                          })}
                        </Stack>
                        <Text fw={800} fz={24} style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatSom(presetQuote.annualLicence)}
                        </Text>
                      </Stack>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
            ) : (
              <ModuleGroup
                title="Свой набор"
                countText="Минимальный административный контур всегда включён"
                selectedCount={addonIds.size}
                accent="bilimosBlue"
                icon={IconApps}
              >
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {REQUIRED_MODULES.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        selected
                        locked
                        accent="teal"
                        badge="Всегда включено"
                      />
                    ))}
                  </SimpleGrid>
                  <Divider />
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {OPTIONAL_MODULES.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        selected={addonIds.has(module.id)}
                        accent="bilimosBlue"
                        badge={`+${formatSom(module.weight * quote.unitPrice)}/год`}
                        onClick={() => toggleAddon(module.id)}
                      />
                    ))}
                  </SimpleGrid>
                </Stack>
              </ModuleGroup>
            )}

            <Paper
              radius="lg"
              p="lg"
              style={{ background: 'linear-gradient(135deg, var(--mantine-color-violet-0), var(--mantine-color-bilimosBlue-0))' }}
            >
              <Group justify="space-between" align="center" gap="md">
                <Group gap="md" align="flex-start">
                  <ThemeIcon color="violet" variant="light" size={40} radius="md">
                    <IconSparkles size={22} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={700}>AI-ассистенты и тьюторы</Text>
                    <Text size="sm" c="dimmed">
                      Отдельный контур, обсуждается индивидуально
                    </Text>
                  </Box>
                </Group>
                <Checkbox
                  label="Интересует AI"
                  checked={aiInterest}
                  onChange={(event) => setAiInterest(event.currentTarget.checked)}
                />
              </Group>
            </Paper>

            <Text size="xs" c="dimmed">
              Предварительный расчёт, не является публичной офертой
            </Text>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box style={{ position: 'sticky', top: 88 }}>
            <Card radius="lg" padding="xl" withBorder shadow="md" visibleFrom="lg">
              <Stack gap="md">
                <Box>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                    Ваш расчёт
                  </Text>
                  <Title order={3}>Bilim OS</Title>
                </Box>

                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Размер</Text>
                    <Text size="sm" fw={600}>
                      {selectedSize.label}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Тариф</Text>
                    <Text size="sm" fw={600} ta="right">
                      {summaryTariff}
                    </Text>
                  </Group>
                </Stack>

                <SegmentedControl
                  fullWidth
                  value={paymentView}
                  onChange={(value) => setPaymentView(value as PaymentView)}
                  data={[
                    { value: 'annual', label: 'Оплата за год' },
                    { value: 'monthly', label: 'Помесячно' },
                  ]}
                />

                <Divider />

                {paymentView === 'annual' ? (
                  <Stack gap={4}>
                    <Text fw={800} fz={30} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatSom(quote.annualLicence)}{' '}
                      <Text component="span" size="sm" c="dimmed">
                        /год
                      </Text>
                    </Text>
                    <Text size="sm" c="dimmed">
                      лицензия, со 2-го года
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatUsd(quote.annualLicence)}
                    </Text>
                    <Text size="sm">
                      Первый год: {formatSom(quote.yearOne)} — включая внедрение, настройку и обучение
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap={4}>
                    <Text fw={800} fz={30} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatSom(quote.monthly)}{' '}
                      <Text component="span" size="sm" c="dimmed">
                        /мес
                      </Text>
                    </Text>
                    <Text size="sm" c="dimmed">
                      при помесячной оплате
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatUsd(quote.monthly)}
                    </Text>
                    <Text size="sm">При оплате за год — {formatSom(quote.annualLicence)}</Text>
                  </Stack>
                )}

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
                Ваш расчёт
              </Text>
              <Text fw={700} size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {paymentView === 'annual' ? formatSom(quote.annualLicence) : formatSom(quote.monthly)}
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
                <Text size="sm">Размер</Text>
                <Text size="sm" fw={600}>
                  {selectedSize.label}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Тариф/набор</Text>
                <Text size="sm" fw={600} ta="right">
                  {summaryTariff}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Лицензия/год</Text>
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatSom(quote.annualLicence)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Год 1</Text>
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatSom(quote.yearOne)}
                </Text>
              </Group>
              {aiInterest && (
                <Group justify="space-between">
                  <Text size="sm">AI</Text>
                  <Badge color="violet" variant="light">
                    интересует
                  </Badge>
                </Group>
              )}
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
