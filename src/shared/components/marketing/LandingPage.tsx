'use client';

import Link from 'next/link';
import {
  Anchor,
  Box,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowRight,
  IconArrowsExchange,
  IconCheck,
  IconLock,
  IconStethoscope,
  IconTable,
} from '@tabler/icons-react';

const INK = '#211c17';
const PAPER = '#faf6f0';
const MUTED = '#7a7068';
const LINE = '#ece3d6';
const ACCENT = '#1864ab';
const SERIF = "var(--font-playfair), Georgia, 'Times New Roman', serif";

const STATS: Array<[string, string]> = [
  ['9', 'ролей с разграничением'],
  ['20+', 'рабочих модулей'],
  ['2 уровня', 'модерации оценок'],
  ['100%', 'доступ проверен тестами'],
];

const FEATURES = [
  {
    img: '/landing/classroom.jpg',
    eyebrow: 'Контроль качества',
    title: 'Двухуровневая модерация оценок',
    text: 'Важные оценки попадают в дневник только после проверки: учитель выставляет — завуч утверждает — аналитик публикует. Каждое изменение фиксируется в журнале аудита: кто, когда и что изменил.',
  },
  {
    img: '/landing/teacher.jpg',
    eyebrow: 'Связь с семьёй',
    title: 'Дневник для учеников и родителей',
    text: 'Мобильный дневник с переключателем детей. Родитель видит только своего ребёнка и только опубликованные оценки, посещаемость и домашние задания — меньше звонков в школу.',
  },
  {
    img: '/landing/students.jpg',
    eyebrow: 'Для руководства',
    title: 'Аналитика по школе в реальном времени',
    text: 'Дашборд и отчёты по успеваемости и посещаемости с экспортом в Excel. У директора всегда есть общая картина — без сбора данных вручную по таблицам.',
  },
];

const MORE = [
  { icon: IconTable, title: 'Расписание и замены', text: 'Сетка, звонки, авто-генерация и проверка конфликтов.' },
  { icon: IconArrowsExchange, title: 'Нагрузка и передача', text: 'Декрет, болезнь, увольнение — нагрузка переходит одной операцией.' },
  { icon: IconStethoscope, title: 'Кабинеты специалистов', text: 'Логопед, психолог, медкабинет — профильные записи.' },
];

const MODULES: Array<{ group: string; items: string[] }> = [
  { group: 'Учебный процесс', items: ['Электронный журнал', 'Оценивание (4 шкалы)', 'Модерация оценок', 'Периоды и категории', 'Домашние задания', 'Посещаемость'] },
  { group: 'Расписание и нагрузка', items: ['Расписание и звонки', 'Авто-генерация + конфликты', 'Замены уроков', 'Нагрузка педагогов', 'Передача нагрузки'] },
  { group: 'Люди и доступ', items: ['Классы, группы, переводы', 'Карточки учеников', 'Дескрипторы педагогов', '9 ролей + изоляция данных'] },
  { group: 'Дневник и общение', items: ['Дневник ученика и родителя', 'Происшествия', 'Срочные вопросы', 'Новости', 'Чаты'] },
  { group: 'Специалисты', items: ['Психолог', 'Логопед', 'Медкабинет', 'Кабинет родителей'] },
  { group: 'Аналитика и отчёты', items: ['Дашборд', 'Отчёты + экспорт в Excel', 'Аналитика с графиками', 'Поиск'] },
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

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <Text className="landing-eyebrow" style={{ color: light ? 'rgba(255,255,255,0.75)' : ACCENT }}>
      {children}
    </Text>
  );
}

function Serif({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <Box className="landing-serif" component="h2" style={{ margin: 0, fontWeight: 600, color: INK, letterSpacing: '-0.01em', ...style }}>{children}</Box>;
}

export default function LandingPage() {
  return (
    <Box style={{ background: PAPER, color: INK }}>
      {/* ===== NAV ===== */}
      <Box className="landing-nav">
        <Container size="lg" py={14}>
          <Group justify="space-between">
            <Group gap={10}>
              <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 15, borderRadius: 9 }}>B</div>
              <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em', color: INK }}>Bilim OS</Text>
            </Group>
            <Group gap={28} visibleFrom="sm">
              <Anchor href="#features" c="#46403a" fw={600} size="sm" underline="never">Возможности</Anchor>
              <Anchor href="#modules" c="#46403a" fw={600} size="sm" underline="never">Модули</Anchor>
              <Anchor href="#how" c="#46403a" fw={600} size="sm" underline="never">Как это работает</Anchor>
              <Anchor href="#pricing" c="#46403a" fw={600} size="sm" underline="never">Цена</Anchor>
            </Group>
            <Group gap={8}>
              <Button component={Link} href="/login" variant="default" size="sm" visibleFrom="xs" styles={{ label: { color: INK } }}>Войти</Button>
              <Button component={Link} href="/login" size="sm" color="eruditBlue" rightSection={<IconArrowRight size={16} />}>Смотреть демо</Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* ===== HERO ===== */}
      <Box
        className="landing-photoband"
        style={{ backgroundImage: 'url(/landing/hero.jpg)', minHeight: 'clamp(540px, 82vh, 780px)', display: 'flex', alignItems: 'center' }}
      >
        <div className="landing-scrim" />
        <Container size="lg" style={{ position: 'relative', width: '100%' }} py={64}>
          <Stack gap="lg" maw={720}>
            <Eyebrow light>Школьная ERP · Бишкек</Eyebrow>
            <Box className="landing-serif" component="h1" style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 'clamp(40px, 6.4vw, 76px)', lineHeight: 1.04, letterSpacing: '-0.02em' }}>
              Вся школа — в одной системе
            </Box>
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.55, maxWidth: 560 }}>
              Журнал, оценки, расписание, аналитика и общение — в одном месте,
              с доступом строго по ролям. Рабочее ядро работает уже сегодня.
            </Text>
            <Group gap="sm" mt="xs">
              <Button component={Link} href="/login" size="md" color="eruditBlue" rightSection={<IconArrowRight size={18} />}>
                Смотреть демо
              </Button>
              <Button component="a" href="#pricing" size="md" variant="white" styles={{ label: { color: INK, fontWeight: 600 } }}>
                Цена и условия
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* ===== STATS ===== */}
      <Box style={{ borderBottom: `1px solid ${LINE}` }}>
        <Container size="lg" py={40}>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl">
            {STATS.map(([v, l]) => (
              <Stack key={l} gap={4} align="center">
                <Box className="landing-serif" style={{ fontSize: 'clamp(34px, 4vw, 46px)', fontWeight: 700, color: INK, lineHeight: 1 }}>{v}</Box>
                <Text size="sm" c={MUTED} ta="center">{l}</Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== POSITIONING ===== */}
      <Box style={{ background: '#fff', borderBottom: `1px solid ${LINE}` }}>
        <Container size="lg" py={{ base: 56, md: 96 }}>
          <Stack gap="lg" maw={820} mx="auto" align="center">
            <Eyebrow>Зачем это школе</Eyebrow>
            <Serif style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', lineHeight: 1.22, textAlign: 'center', fontWeight: 500 }}>
              Вместо бумаги, Excel и разрозненных таблиц — одна система, где каждый
              видит ровно то, что нужно для его работы.
            </Serif>
            <Text c={MUTED} ta="center" style={{ maxWidth: 620, fontSize: 17, lineHeight: 1.6 }}>
              Директор получает общую картину, учитель экономит время, завуч контролирует
              качество оценок, а родитель видит честную успеваемость ребёнка.
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* ===== FEATURE ROWS ===== */}
      <Container size="lg" py={{ base: 24, md: 40 }} id="features">
        <Stack gap={80} py={{ base: 32, md: 48 }}>
          {FEATURES.map((f, i) => {
            const imageFirst = i % 2 === 0;
            const photo = (
              <Box className="landing-frame" style={{ aspectRatio: '4 / 3' }}>
                <img src={f.img} alt={f.title} className="landing-photo" loading="lazy" />
              </Box>
            );
            const copy = (
              <Stack gap="md" justify="center">
                <Eyebrow>{f.eyebrow}</Eyebrow>
                <Serif style={{ fontSize: 'clamp(24px, 3vw, 34px)', lineHeight: 1.18 }}>{f.title}</Serif>
                <Text c={MUTED} style={{ fontSize: 17, lineHeight: 1.65 }}>{f.text}</Text>
              </Stack>
            );
            return (
              <SimpleGrid key={f.title} cols={{ base: 1, md: 2 }} spacing={{ base: 28, md: 64 }} style={{ alignItems: 'center' }}>
                {imageFirst ? <>{photo}{copy}</> : <><Box hiddenFrom="md">{photo}</Box>{copy}<Box visibleFrom="md">{photo}</Box></>}
              </SimpleGrid>
            );
          })}
        </Stack>

        {/* compact trio */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" pb={{ base: 40, md: 64 }}>
          {MORE.map((m) => (
            <Card key={m.title} className="landing-card" padding="lg" radius="md" withBorder style={{ borderColor: LINE, background: '#fff' }}>
              <ThemeIcon size={42} radius="md" variant="light" color="eruditBlue" mb="sm">
                <m.icon size={22} stroke={1.7} />
              </ThemeIcon>
              <Text fw={700} mb={4} style={{ color: INK }}>{m.title}</Text>
              <Text size="sm" c={MUTED} style={{ lineHeight: 1.55 }}>{m.text}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* ===== MODULES ===== */}
      <Box style={{ background: '#fff', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <Container size="lg" py={{ base: 56, md: 88 }} id="modules">
          <Stack gap={8} align="center" mb={44}>
            <Eyebrow>Модули</Eyebrow>
            <Serif style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', textAlign: 'center' }}>Более 20 рабочих модулей</Serif>
            <Text c={MUTED} ta="center" style={{ maxWidth: 560 }}>Всё перечисленное работает уже сегодня — это не дорожная карта.</Text>
          </Stack>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl">
            {MODULES.map((m) => (
              <Box key={m.group} style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
                <Text fw={700} mb="sm" style={{ color: INK }}>{m.group}</Text>
                <Stack gap={7}>
                  {m.items.map((it) => (
                    <Group key={it} gap={8} wrap="nowrap" align="center">
                      <IconCheck size={15} color={ACCENT} style={{ flexShrink: 0 }} />
                      <Text size="sm" c={MUTED}>{it}</Text>
                    </Group>
                  ))}
                </Stack>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== HOW IT WORKS ===== */}
      <Container size="lg" py={{ base: 56, md: 88 }} id="how">
        <Stack gap={8} align="center" mb={44}>
          <Eyebrow>Как это работает</Eyebrow>
          <Serif style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', textAlign: 'center' }}>От демо до запуска</Serif>
        </Stack>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={{ base: 24, md: 40 }}>
          {STEPS.map((s) => (
            <Box key={s.n} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 20 }}>
              <Box className="landing-serif" style={{ fontSize: 40, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>{s.n}</Box>
              <Text fw={700} size="lg" mt="sm" mb={4} style={{ color: INK }}>{s.title}</Text>
              <Text c={MUTED} size="sm" style={{ lineHeight: 1.6 }}>{s.text}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Container>

      {/* ===== SECURITY ===== */}
      <Box style={{ background: '#fff', borderTop: `1px solid ${LINE}` }}>
        <Container size="lg" py={{ base: 56, md: 88 }} id="security">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 32, md: 64 }} style={{ alignItems: 'center' }}>
            <Stack gap="md">
              <Eyebrow>Безопасность данных</Eyebrow>
              <Serif style={{ fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.18 }}>
                Доступ под контролем — это факт, а не обещание
              </Serif>
              <Text c={MUTED} style={{ fontSize: 17, lineHeight: 1.65 }}>
                Каждый видит только то, что нужно для его работы. Чувствительные данные
                разграничены, а корректность подтверждена автоматическими тестами.
              </Text>
            </Stack>
            <Card padding="xl" radius="md" withBorder style={{ borderColor: LINE, background: PAPER }}>
              <Stack gap="sm">
                {SECURITY.map((s) => (
                  <Group key={s} gap={12} wrap="nowrap" align="flex-start">
                    <ThemeIcon size={26} radius="xl" variant="light" color="teal">
                      <IconLock size={15} stroke={1.8} />
                    </ThemeIcon>
                    <Text size="sm" style={{ lineHeight: 1.5, color: INK }}>{s}</Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== PRICING ===== */}
      <Container size="lg" py={{ base: 56, md: 88 }} id="pricing">
        <Stack gap={8} align="center" mb={44}>
          <Eyebrow>Цена</Eyebrow>
          <Serif style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', textAlign: 'center' }}>Прозрачно и без сюрпризов</Serif>
        </Stack>
        <Card padding={0} radius="md" withBorder maw={560} mx="auto" style={{ borderColor: LINE, overflow: 'hidden', background: '#fff' }}>
          <Box p="xl" className="landing-dark" style={{ color: '#fff' }}>
            <Text style={{ opacity: 0.82 }}>Всё рабочее ядро включено</Text>
            <Group align="flex-end" gap={10} mt={8}>
              <Box className="landing-serif" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>30 000 сом</Box>
              <Text pb={6} style={{ opacity: 0.82 }}>/ месяц</Text>
            </Group>
            <Text mt={8} style={{ opacity: 0.82 }}>+ установка $1000 разово</Text>
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
                <IconCheck size={18} color={ACCENT} style={{ marginTop: 2, flexShrink: 0 }} />
                <Text size="sm" style={{ lineHeight: 1.5, color: INK }}>{b}</Text>
              </Group>
            ))}
            <Button component={Link} href="/login" size="md" color="eruditBlue" mt="sm" fullWidth rightSection={<IconArrowRight size={18} />}>
              Смотреть демо
            </Button>
          </Stack>
        </Card>
      </Container>

      {/* ===== CTA BAND ===== */}
      <Box className="landing-photoband" style={{ backgroundImage: 'url(/landing/students.jpg)' }}>
        <div className="landing-scrim" />
        <Container size="lg" py={{ base: 64, md: 96 }} style={{ position: 'relative' }}>
          <Stack align="center" gap="lg">
            <Box className="landing-serif" component="h2" style={{ margin: 0, color: '#fff', fontWeight: 700, textAlign: 'center', fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1, maxWidth: 680 }}>
              Посмотрите, как это работает в вашей школе
            </Box>
            <Text ta="center" style={{ color: 'rgba(255,255,255,0.82)', maxWidth: 520 }}>
              Живое демо, без установки. Откройте и попробуйте прямо в браузере.
            </Text>
            <Group gap="sm">
              <Button component={Link} href="/login" size="md" color="eruditBlue" rightSection={<IconArrowRight size={18} />}>Открыть демо</Button>
              <Button component="a" href="#features" size="md" variant="white" styles={{ label: { color: INK, fontWeight: 600 } }}>Узнать больше</Button>
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
              <Text fw={700} size="sm" style={{ letterSpacing: '-0.02em', color: INK }}>Bilim OS</Text>
              <Text size="xs" c={MUTED}>Система управления школой</Text>
            </Stack>
          </Group>
          <Text size="xs" c={MUTED} ta="right">© 2026 Bilim OS · Разработано Asystem</Text>
        </Group>
        <hr className="landing-rule" style={{ margin: '16px 0' }} />
        <Group gap={8}>
          <Text size="xs" c={MUTED}>Контакт для школ:</Text>
          <Anchor href="tel:+996700144043" size="xs" c={MUTED} underline="hover">+996 700 144 043</Anchor>
          <Text size="xs" c={MUTED}>·</Text>
          <Anchor href="mailto:Asystem@gmail.com" size="xs" c={MUTED} underline="hover">Asystem@gmail.com</Anchor>
        </Group>
      </Container>
    </Box>
  );
}
