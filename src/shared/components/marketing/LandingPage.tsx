'use client';

import Link from 'next/link';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconArrowsExchange,
  IconChartBar,
  IconCheck,
  IconLock,
  IconNotebook,
  IconShieldCheck,
  IconStar,
  IconTable,
} from '@tabler/icons-react';

const BLUE = '#228be6';
const DARK = '#0f172a';

const FEATURES = [
  {
    icon: IconStar,
    title: 'Журнал и оценивание',
    text: 'Категории оценок, комментарии, средневзвешенный балл. Всё, что школа использует каждый день.',
  },
  {
    icon: IconShieldCheck,
    title: 'Модерация оценок + аудит',
    text: 'Важные оценки видны семье только после проверки: учитель → завуч → публикация. Каждое изменение зафиксировано.',
  },
  {
    icon: IconTable,
    title: 'Расписание и замены',
    text: 'Сетка уроков, звонки, замены. Понятно учителям, ученикам и родителям.',
  },
  {
    icon: IconArrowsExchange,
    title: 'Нагрузка и передача',
    text: 'Декрет, болезнь, увольнение — нагрузка переходит одной операцией. История сохраняется.',
  },
  {
    icon: IconNotebook,
    title: 'Дневник ученика и родителя',
    text: 'Родитель видит только своего ребёнка и только опубликованные оценки. Честно и понятно.',
  },
  {
    icon: IconChartBar,
    title: 'Аналитика для руководства',
    text: 'Картина по школе в реальном времени — успеваемость, посещаемость, нагрузка.',
  },
];

const STEPS = [
  { n: '01', title: 'Демонстрация', text: 'Онлайн или у вас в школе, около 30 минут — на живой системе.' },
  { n: '02', title: 'Пилот', text: 'Запускаем на одном-двух классах с вашими данными.' },
  { n: '03', title: 'Запуск', text: 'Разворачиваем на школу, обучаем персонал. Сопровождение включено.' },
];

const SECURITY = [
  '9 ролей с разграничением доступа',
  'Ученик и родитель видят только своё',
  'Корректность проверена автотестами',
  'Журнал аудита: кто, когда, что изменил',
  'Хостинг Vercel · база Neon Postgres',
];

function NavLinkA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Anchor href={href} c="dimmed" fw={500} size="sm" underline="never" style={{ letterSpacing: '-0.01em' }}>
      {children}
    </Anchor>
  );
}

export default function LandingPage() {
  return (
    <Box bg="white">
      {/* ===== NAV ===== */}
      <Box className="landing-nav">
        <Container size="lg" py={14}>
          <Group justify="space-between">
            <Group gap={10}>
              <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 15, borderRadius: 9 }}>B</div>
              <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>Bilim OS</Text>
            </Group>
            <Group gap={28} visibleFrom="sm">
              <NavLinkA href="#features">Возможности</NavLinkA>
              <NavLinkA href="#how">Как это работает</NavLinkA>
              <NavLinkA href="#security">Безопасность</NavLinkA>
              <NavLinkA href="#pricing">Цена</NavLinkA>
            </Group>
            <Group gap={8}>
              <Button component={Link} href="/login" variant="subtle" color="gray" size="sm" visibleFrom="xs">
                Войти
              </Button>
              <Button component={Link} href="/login" size="sm" rightSection={<IconArrowRight size={16} />}>
                Смотреть демо
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* ===== HERO ===== */}
      <Box className="landing-hero">
        <Container size="lg" pt={{ base: 56, md: 90 }} pb={{ base: 48, md: 80 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 40, md: 56 }} verticalSpacing={40} style={{ alignItems: 'center' }}>
            <Stack gap="lg">
              <Badge size="lg" radius="sm" variant="light" color="eruditBlue" style={{ alignSelf: 'flex-start' }}>
                Школьная ERP · Бишкек
              </Badge>
              <Title order={1} style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 800 }}>
                Вся школа —{' '}
                <span className="landing-gradient-text">в одной системе</span>
              </Title>
              <Text size="xl" c="dimmed" style={{ maxWidth: 520, lineHeight: 1.5 }}>
                Журнал, оценки, расписание, аналитика и общение — в одном месте,
                с доступом строго по ролям. Рабочее ядро работает уже сегодня.
              </Text>
              <Group gap="sm" mt="xs">
                <Button component={Link} href="/login" size="md" rightSection={<IconArrowRight size={18} />}>
                  Смотреть демо
                </Button>
                <Button component="a" href="#pricing" size="md" variant="default">
                  Цена и условия
                </Button>
              </Group>
              <Group gap={18} mt="xs" c="dimmed">
                <Group gap={6}><IconCheck size={16} color={BLUE} /><Text size="sm">Без установки</Text></Group>
                <Group gap={6}><IconCheck size={16} color={BLUE} /><Text size="sm">Работает в браузере</Text></Group>
                <Group gap={6}><IconCheck size={16} color={BLUE} /><Text size="sm">Живое демо</Text></Group>
              </Group>
            </Stack>

            {/* product mock */}
            <HeroMock />
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== STATS ===== */}
      <Box style={{ borderTop: '1px solid #eef0f4', borderBottom: '1px solid #eef0f4', background: '#fbfcfe' }}>
        <Container size="lg" py={26}>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
            {[
              ['9', 'ролей с разграничением'],
              ['20+', 'рабочих разделов'],
              ['2 уровня', 'модерации оценок'],
              ['100%', 'доступ проверен тестами'],
            ].map(([v, l]) => (
              <Stack key={l} gap={2} align="center">
                <Text fw={800} style={{ fontSize: 28, letterSpacing: '-0.03em' }} className="landing-gradient-text">{v}</Text>
                <Text size="sm" c="dimmed" ta="center">{l}</Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== FEATURES ===== */}
      <Container size="lg" py={{ base: 56, md: 84 }} id="features">
        <Stack gap={8} align="center" mb={44}>
          <Badge variant="light" color="eruditBlue" radius="sm">Возможности</Badge>
          <Title order={2} ta="center" style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', letterSpacing: '-0.025em' }}>
            Рабочее ядро — с первого дня
          </Title>
          <Text c="dimmed" ta="center" style={{ maxWidth: 580 }}>
            Не обещание будущего, а инструмент, которым школа пользуется каждый день.
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {FEATURES.map((f) => (
            <Card key={f.title} className="landing-card" padding="lg" radius="lg" withBorder style={{ borderColor: '#e6e9ee' }}>
              <ThemeIcon size={44} radius="md" variant="light" color="eruditBlue" mb="md">
                <f.icon size={24} stroke={1.7} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6} style={{ letterSpacing: '-0.01em' }}>{f.title}</Text>
              <Text c="dimmed" size="sm" style={{ lineHeight: 1.55 }}>{f.text}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* ===== HOW IT WORKS ===== */}
      <Box style={{ background: '#fbfcfe', borderTop: '1px solid #eef0f4', borderBottom: '1px solid #eef0f4' }}>
        <Container size="lg" py={{ base: 56, md: 84 }} id="how">
          <Stack gap={8} align="center" mb={44}>
            <Badge variant="light" color="eruditBlue" radius="sm">Как это работает</Badge>
            <Title order={2} ta="center" style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', letterSpacing: '-0.025em' }}>
              От демо до запуска
            </Title>
          </Stack>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {STEPS.map((s) => (
              <Card key={s.n} padding="xl" radius="lg" withBorder style={{ borderColor: '#e6e9ee' }}>
                <Text fw={800} className="landing-gradient-text" style={{ fontSize: 32, letterSpacing: '-0.03em' }}>{s.n}</Text>
                <Text fw={700} size="lg" mt="sm" mb={4}>{s.title}</Text>
                <Text c="dimmed" size="sm" style={{ lineHeight: 1.55 }}>{s.text}</Text>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== SECURITY ===== */}
      <Container size="lg" py={{ base: 56, md: 84 }} id="security">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 32, md: 56 }} style={{ alignItems: 'center' }}>
          <Stack gap="md">
            <Badge variant="light" color="eruditBlue" radius="sm" style={{ alignSelf: 'flex-start' }}>Безопасность данных</Badge>
            <Title order={2} style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', letterSpacing: '-0.025em' }}>
              Доступ под контролем — это не обещание, а факт
            </Title>
            <Text c="dimmed" style={{ lineHeight: 1.6 }}>
              Каждый видит только то, что нужно для его работы. Чувствительные данные
              разграничены, а корректность подтверждена автоматическими тестами.
            </Text>
          </Stack>
          <Card padding="xl" radius="lg" withBorder style={{ borderColor: '#e6e9ee' }}>
            <Stack gap="sm">
              {SECURITY.map((s) => (
                <Group key={s} gap={12} wrap="nowrap" align="flex-start">
                  <ThemeIcon size={26} radius="xl" variant="light" color="teal">
                    <IconLock size={15} stroke={1.8} />
                  </ThemeIcon>
                  <Text size="sm" style={{ lineHeight: 1.5 }}>{s}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>
      </Container>

      {/* ===== PRICING ===== */}
      <Box style={{ background: '#fbfcfe', borderTop: '1px solid #eef0f4' }}>
        <Container size="lg" py={{ base: 56, md: 84 }} id="pricing">
          <Stack gap={8} align="center" mb={44}>
            <Badge variant="light" color="eruditBlue" radius="sm">Цена</Badge>
            <Title order={2} ta="center" style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', letterSpacing: '-0.025em' }}>
              Прозрачно и без сюрпризов
            </Title>
          </Stack>
          <Card padding={0} radius="lg" withBorder maw={560} mx="auto" style={{ borderColor: '#cfe2f7', overflow: 'hidden' }}>
            <Box p="xl" style={{ background: 'linear-gradient(135deg, #228be6 0%, #1864ab 100%)', color: 'white' }}>
              <Text fw={600} style={{ opacity: 0.9 }}>Всё рабочее ядро включено</Text>
              <Group align="flex-end" gap={8} mt={6}>
                <Text fw={800} style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.03em' }}>30 000 сом</Text>
                <Text pb={6} style={{ opacity: 0.9 }}>/ месяц</Text>
              </Group>
              <Text mt={6} style={{ opacity: 0.9 }}>+ установка $1000 разово</Text>
            </Box>
            <Stack p="xl" gap="sm">
              {[
                'Журнал, оценки, модерация, аудит',
                'Расписание, замены, нагрузка и передача',
                'Дневник, посещаемость, отчёты, аналитика',
                'Кабинеты специалистов и 9 ролей',
                'Ранний партнёр: новые модули — без доплат',
              ].map((b) => (
                <Group key={b} gap={10} wrap="nowrap" align="flex-start">
                  <IconCheck size={18} color={BLUE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text size="sm" style={{ lineHeight: 1.5 }}>{b}</Text>
                </Group>
              ))}
              <Button component={Link} href="/login" size="md" mt="sm" fullWidth rightSection={<IconArrowRight size={18} />}>
                Смотреть демо
              </Button>
            </Stack>
          </Card>
        </Container>
      </Box>

      {/* ===== CTA BAND ===== */}
      <Box className="landing-dark">
        <Container size="lg" py={{ base: 56, md: 76 }}>
          <Stack align="center" gap="lg">
            <Title order={2} ta="center" c="white" style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', letterSpacing: '-0.025em', maxWidth: 640 }}>
              Посмотрите, как это работает в вашей школе
            </Title>
            <Text ta="center" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 520 }}>
              Живое демо, без установки. Откройте и попробуйте прямо в браузере.
            </Text>
            <Group gap="sm">
              <Button component={Link} href="/login" size="md" rightSection={<IconArrowRight size={18} />}>
                Открыть демо
              </Button>
              <Button component="a" href="#features" size="md" variant="white" color="dark">
                Узнать больше
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* ===== FOOTER ===== */}
      <Container size="lg" py={36}>
        <Group justify="space-between" align="center">
          <Group gap={10}>
            <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 14, borderRadius: 8 }}>B</div>
            <Stack gap={0}>
              <Text fw={700} size="sm" style={{ letterSpacing: '-0.02em' }}>Bilim OS</Text>
              <Text size="xs" c="dimmed">Система управления школой</Text>
            </Stack>
          </Group>
          <Text size="xs" c="dimmed" ta="right">© 2026 Bilim OS · Разработано Asystem</Text>
        </Group>
        <Divider my="md" color="#eef0f4" />
        <Group gap={8} mt={2}>
          <Text size="xs" c="dimmed">Контакт для школ:</Text>
          <Anchor href="tel:+996700144043" size="xs" c="dimmed" underline="hover">+996 700 144 043</Anchor>
          <Text size="xs" c="dimmed">·</Text>
          <Anchor href="mailto:Asystem@gmail.com" size="xs" c="dimmed" underline="hover">Asystem@gmail.com</Anchor>
        </Group>
      </Container>
    </Box>
  );
}

/* ---------- Hero product preview (reuses product visual language) ---------- */
function HeroMock() {
  const grades: Array<{ v: string; g: string }> = [
    { v: '5', g: 'g5' }, { v: '4', g: 'g4' }, { v: '5', g: 'g5' },
    { v: '4', g: 'g4' }, { v: '3', g: 'g3' }, { v: '5', g: 'g5' },
  ];
  const strips = [
    { t: 'Математика · 08:30', c: '#e7f5ff', tc: '#1864ab' },
    { t: 'Русский язык · 09:25', c: '#e6fcf5', tc: '#0c8599' },
    { t: 'История · 10:20', c: '#fff0f6', tc: '#c2255c' },
  ];
  return (
    <Box className="landing-mock">
      <div className="landing-mock-bar">
        <span className="landing-dot" style={{ background: '#ff5f57' }} />
        <span className="landing-dot" style={{ background: '#febc2e' }} />
        <span className="landing-dot" style={{ background: '#28c840' }} />
        <span className="landing-pill">bilim-os · 7А · журнал</span>
      </div>
      <Box p="lg">
        <SimpleGrid cols={3} spacing="sm" mb="md">
          {[['Ср. балл', '4.6'], ['Посещ.', '94%'], ['Учеников', '28']].map(([l, v]) => (
            <Card key={l} padding="sm" radius="md" withBorder style={{ borderColor: '#eef0f4' }}>
              <Text size="xs" c="dimmed">{l}</Text>
              <Text className="kpi-value" style={{ fontSize: 22 }}>{v}</Text>
            </Card>
          ))}
        </SimpleGrid>

        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8} style={{ letterSpacing: '0.04em' }}>Оценки за неделю</Text>
        <Group gap={8} mb="md">
          {grades.map((g, i) => (
            <span key={i} className={`grade-chip ${g.g}`}>{g.v}</span>
          ))}
        </Group>

        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8} style={{ letterSpacing: '0.04em' }}>Расписание</Text>
        <Stack gap={8}>
          {strips.map((s) => (
            <div key={s.t} className="landing-strip" style={{ background: s.c, color: s.tc }}>{s.t}</div>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
