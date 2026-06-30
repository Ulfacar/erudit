'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  Box,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconArrowRight,
  IconLock,
  IconMessageCircle,
  IconSchool,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react';

const DEMO_PASSWORD = 'erudit2025';

const ROLE_TABS = [
  { id: 'admin', label: 'Школа', login: 'admin', emoji: '🏫', color: '#1c7ed6' },
  { id: 'secretary', label: 'Ассистент', login: 'secretary1', emoji: '🗂️', color: '#1098ad' },
  { id: 'teacher', label: 'Учитель', login: 'matematik', emoji: '👩‍🏫', color: '#7048e8' },
  { id: 'student', label: 'Ученик', login: 'student1', emoji: '🎒', color: '#0ca678' },
  { id: 'parent', label: 'Родитель', login: 'parent1', emoji: '👨‍👩‍👧', color: '#e8590c' },
];

// Сотрудники: у каждого свой кабинет (демо «9 доменов — 1 ядро»)
const STAFF_TABS = [
  { id: 'accountant', label: 'Кассир', login: 'accountant1', emoji: '💰', color: '#e8590c' },
  { id: 'chief_accountant', label: 'Бухгалтер', login: 'chief_accountant1', emoji: '📊', color: '#2b8a3e' },
  { id: 'finance_manager', label: 'Финменеджер', login: 'finance_manager1', emoji: '📈', color: '#1864ab' },
  { id: 'psychologist', label: 'Психолог', login: 'psychologist1', emoji: '🧠', color: '#9c36b5' },
  { id: 'doctor', label: 'Врач', login: 'doctor1', emoji: '🩺', color: '#e03131' },
  { id: 'hr', label: 'HR (кадры)', login: 'hr1', emoji: '📋', color: '#2f9e44' },
  { id: 'call_center', label: 'Колл-центр', login: 'callcenter1', emoji: '🎧', color: '#1971c2' },
  { id: 'senior_psychologist', label: 'Ст. психолог', login: 'senior_psy', emoji: '🧩', color: '#ae3ec9' },
  { id: 'safeguarding_lead', label: 'Воспит. работа', login: 'safeguard', emoji: '🎭', color: '#e8590c' },
  { id: 'event_manager', label: 'Ивент-менеджер', login: 'event1', emoji: '🎉', color: '#e64980' },
  { id: 'librarian', label: 'Библиотека', login: 'librarian1', emoji: '📚', color: '#1971c2' },
  { id: 'cook', label: 'Столовая', login: 'cook1', emoji: '🍲', color: '#f08c00' },
  { id: 'zavhoz', label: 'АХЧ', login: 'zavhoz1', emoji: '🔧', color: '#495057' },
  // Завучи (наследуют доступ zavuch)
  { id: 'zavuch_primary', label: 'Завуч (мл.)', login: 'zavuch_primary1', emoji: '🧒', color: '#1c7ed6' },
  { id: 'zavuch_senior', label: 'Завуч (ст.)', login: 'zavuch_senior1', emoji: '🎓', color: '#1c7ed6' },
  { id: 'zavuch_academic', label: 'Завуч (учеб.)', login: 'zavuch_academic1', emoji: '📚', color: '#3b5bdb' },
  { id: 'cambridge_coord', label: 'Кэмбридж', login: 'cambridge1', emoji: '🌐', color: '#7048e8' },
  { id: 'media', label: 'Медиа-центр', login: 'media1', emoji: '🎬', color: '#c2255c' },
  { id: 'founder', label: 'Учредитель', login: 'founder1', emoji: '🏛️', color: '#5f3dc4' },
];

const ALL_TABS = [...ROLE_TABS, ...STAFF_TABS];

const FEATURES = [
  { icon: IconSparkles, title: 'Автоматическая аналитика', desc: 'Тренды успеваемости и группы риска', ml: 0 },
  { icon: IconMessageCircle, title: 'Прямая связь с родителями', desc: 'Уведомления в Telegram и WhatsApp', ml: 32 },
  { icon: IconSchool, title: 'Адаптировано для школ КР', desc: '5-балльная шкала, двуязычие, ЕГСУ', ml: 64 },
];

/** Куда направлять после входа: у каждой роли свой «дом». */
function landingForRole(role?: string): string {
  if (role === 'student' || role === 'parent') return '/diary';
  if (role === 'teacher' || role === 'curator') return '/today';
  // узкие роли сотрудников — сразу в свой кабинет
  const staffHome: Record<string, string> = {
    accountant: '/workspace/accounting',
    psychologist: '/psychologist',
    senior_psychologist: '/psychologist/overview',
    safeguarding_lead: '/safeguarding',
    call_center: '/call-center',
    doctor: '/workspace/medical',
    hr: '/hr',
    librarian: '/library',
    cook: '/workspace/kitchen',
    zavhoz: '/workspace/maintenance',
  };
  if (role && staffHome[role]) return staffHome[role];
  // админ/завуч/секретарь/аналитик/специалист — на «Главную»-хаб (Этап 9)
  return '/home';
}

export default function LoginPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState('admin');

  const form = useForm({
    initialValues: { login: 'admin', password: 'erudit2025' },
    validate: {
      login: (v) => (v.length < 1 ? 'Введите логин' : null),
      password: (v) => (v.length < 1 ? 'Введите пароль' : null),
    },
  });

  if (status === 'authenticated') {
    const role = (session?.user as { role?: string })?.role;
    router.push(landingForRole(role));
    return null;
  }

  async function doLogin(login: string, password: string) {
    setError(null);
    const result = await signIn('credentials', { login, password, redirect: false });
    if (result?.error) {
      setError('Неверный логин или пароль');
    } else if (result?.ok) {
      const res = await fetch('/api/v1/me');
      const me = await res.json().catch(() => null);
      const role = me?.data?.role;
      router.push(landingForRole(role));
    }
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await doLogin(values.login, values.password);
    } catch {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  });

  function selectRole(id: string) {
    setActiveRole(id);
    const tab = ALL_TABS.find((t) => t.id === id);
    if (tab) {
      form.setFieldValue('login', tab.login);
      form.setFieldValue('password', DEMO_PASSWORD);
    }
  }

  if (status === 'loading') return null;

  return (
    <Box style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1.1fr', background: '#fff' }}>
      {/* ═══ LEFT: Form ═══ */}
      <Box style={{ display: 'flex', flexDirection: 'column', padding: '40px 64px', justifyContent: 'space-between', maxWidth: 560, margin: '0 auto', width: '100%' }}>
        {/* Brand */}
        <Group gap={12}>
          <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 18, borderRadius: 10 }}>B</div>
          <div>
            <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>Bilim OS</Text>
            <Text size="xs" c="dimmed" fw={500}>Школьная ERP-система</Text>
          </div>
        </Group>

        {/* Form area */}
        <Box>
          <Text size="sm" c="blue.7" fw={600} style={{ letterSpacing: '0.02em' }} mb={12}>
            Добро пожаловать
          </Text>
          <Text fw={700} style={{ fontSize: 36, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Войдите в свой кабинет
          </Text>
          <Text size="md" c="dimmed" mt={14} style={{ lineHeight: 1.55, maxWidth: 420 }}>
            Цифровой кабинет для директоров, учителей, учеников и родителей школы.
          </Text>

          {/* Выбор роли: основные — карточки с иконками */}
          <Group gap={10} mt={32} wrap="wrap" style={{ maxWidth: 480 }}>
            {ROLE_TABS.map((t) => {
              const active = activeRole === t.id;
              return (
                <Button
                  key={t.id}
                  variant="subtle"
                  onClick={() => selectRole(t.id)}
                  h="auto"
                  p={0}
                  style={{
                    flex: '1 1 100px',
                    borderRadius: 14,
                    border: active ? `2px solid ${t.color}` : '1.5px solid #e3e7ee',
                    background: active ? `${t.color}10` : 'white',
                    boxShadow: active ? `0 6px 16px ${t.color}26` : '0 1px 2px rgba(15,23,42,0.04)',
                    transition: 'all 130ms ease',
                  }}
                >
                  <Stack gap={2} align="center" py={12} px={8} w="100%">
                    <Text style={{ fontSize: 24, lineHeight: 1 }}>{t.emoji}</Text>
                    <Text size="sm" fw={700} c={active ? t.color : '#3b4252'}>
                      {t.label}
                    </Text>
                  </Stack>
                </Button>
              );
            })}
          </Group>

          {/* Сотрудники: у каждого свой кабинет */}
          <Text size="xs" fw={600} c="#9aa3b2" mt={16} mb={6} style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Кабинеты сотрудников
          </Text>
          <Group gap={6} wrap="wrap" style={{ maxWidth: 480 }}>
            {STAFF_TABS.map((t) => {
              const active = activeRole === t.id;
              return (
                <Button
                  key={t.id}
                  variant="subtle"
                  size="compact-sm"
                  onClick={() => selectRole(t.id)}
                  leftSection={<span style={{ fontSize: 15 }}>{t.emoji}</span>}
                  style={{
                    borderRadius: 99,
                    padding: '6px 13px',
                    fontWeight: 600,
                    fontSize: 12.5,
                    border: active ? `1.5px solid ${t.color}` : '1.5px solid #e3e7ee',
                    background: active ? `${t.color}12` : 'white',
                    color: active ? t.color : '#5b6472',
                    transition: 'all 130ms ease',
                  }}
                >
                  {t.label}
                </Button>
              );
            })}
          </Group>

          {/* Form fields */}
          <form onSubmit={handleSubmit}>
            <Stack gap={14} mt={24} maw={420}>
              <TextInput
                label="Логин или email"
                leftSection={<IconUser size={17} />}
                size="md"
                styles={{ label: { fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 } }}
                {...form.getInputProps('login')}
              />
              <Box>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={600} c="#374151">Пароль</Text>
                  <Text size="xs" fw={600} c="blue.7" style={{ cursor: 'pointer' }}>Забыли пароль?</Text>
                </Group>
                <PasswordInput
                  leftSection={<IconLock size={17} />}
                  size="md"
                  {...form.getInputProps('password')}
                />
              </Box>

              <Checkbox
                label="Запомнить меня на этом устройстве"
                defaultChecked
                size="sm"
                mt={4}
                styles={{ label: { fontSize: 13, color: '#374151' } }}
              />

              {error && <Text size="sm" c="red" ta="center">{error}</Text>}

              <Button
                type="submit"
                fullWidth
                size="lg"
                mt={6}
                loading={loading}
                rightSection={<IconArrowRight size={17} />}
                style={{ fontWeight: 600 }}
              >
                Войти в кабинет
              </Button>

            </Stack>
          </form>
        </Box>

        {/* Footer */}
        <Group justify="space-between" style={{ fontSize: 12, color: '#9ba2ad' }}>
          <span>© 2026 Bilim OS · Разработано Asystem</span>
        </Group>
      </Box>

      {/* ═══ RIGHT: Visual panel ═══ */}
      <Box
        style={{
          background: 'linear-gradient(135deg, #1864ab 0%, #1971c2 35%, #228be6 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 48,
          color: 'white',
        }}
        visibleFrom="md"
      >
        {/* Decorative grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }} preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <Box style={{ position: 'absolute', right: -180, top: -160, width: 520, height: 520, background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)', borderRadius: '50%' }} />
        <Box style={{ position: 'absolute', left: -140, bottom: -200, width: 480, height: 480, background: 'radial-gradient(circle, rgba(116,192,252,0.32), transparent 70%)', borderRadius: '50%' }} />

        <Box style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560 }}>
          <Box style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '4px 12px', width: 'fit-content', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#69db7c' }} />
            Новое в этом году
          </Box>

          <Text fw={700} style={{ fontSize: 40, letterSpacing: '-0.025em', lineHeight: 1.15, marginTop: 18 }}>
            Школа, в&nbsp;которой всё&nbsp;на&nbsp;своих местах.
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 1.55, marginTop: 18, color: 'rgba(255,255,255,0.85)', maxWidth: 480 }}>
            Журналы, расписание, аналитика и связь с родителями — единая платформа для школ Кыргызстана.
          </Text>

          {/* Feature cards */}
          <Stack gap={14} mt={48} maw={420}>
            {FEATURES.map((f, i) => (
              <Box
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 14,
                  padding: 16,
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginLeft: f.ml,
                }}
              >
                <Box style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center' }}>
                  <f.icon size={20} />
                </Box>
                <div>
                  <Text fw={600} style={{ fontSize: 14.5 }}>{f.title}</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{f.desc}</Text>
                </div>
              </Box>
            ))}
          </Stack>

          {/* Stats */}
          <Group gap={32} mt={48}>
            {[
              { val: '140+', label: 'школ в системе' },
              { val: '87K', label: 'учеников' },
              { val: '99.9%', label: 'uptime' },
            ].map((s) => (
              <div key={s.val}>
                <Text fw={700} style={{ fontSize: 32, letterSpacing: '-0.02em' }}>{s.val}</Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{s.label}</Text>
              </div>
            ))}
          </Group>
        </Box>
      </Box>
    </Box>
  );
}
