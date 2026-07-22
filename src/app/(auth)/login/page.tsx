'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconArrowRight,
  IconBolt,
  IconLock,
  IconMessageCircle,
  IconSchool,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react';
import OrganismHero from './OrganismHero';
import { CLUSTERS, getRoleLabel } from '@/shared/constants/role-clusters';

// Демо-вход (pre-fill + чипы ролей) только на публичном демо-развёртывании: строго
// NEXT_PUBLIC_DEMO_LOGIN_ENABLED === '1'. По умолчанию/при любом ином значении демо скрыт,
// а демо-пароль берётся из NEXT_PUBLIC_DEMO_LOGIN_PASSWORD — в проде школы переменная не
// задана, поэтому статический пароль вообще не попадает в клиентский bundle.
const DEMO_LOGIN_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === '1';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_LOGIN_PASSWORD ?? '';
const WARM_TEXT = '#2b2118';
const WARM_BORDER = '#eadfce';
const WARM_ACCENT = '#e8590c';
const WARM_AMBER = '#f08c00';

type LoginTab = {
  id: string;
  label: string;
  login: string;
  emoji: string;
  color: string;
};

const ROLE_TABS: LoginTab[] = [
  { id: 'super_admin', label: 'Школа', login: 'admin', emoji: '🏫', color: '#ffd43b' },
  { id: 'secretary', label: 'Ассистент', login: 'secretary1', emoji: '🗂️', color: '#1098ad' },
  { id: 'teacher', label: 'Учитель', login: 'matematik', emoji: '👩‍🏫', color: '#ff922b' },
  { id: 'student', label: 'Ученик', login: 'student1', emoji: '🎒', color: '#51cf66' },
  { id: 'parent', label: 'Родитель', login: 'parent1', emoji: '👨‍👩‍👧', color: '#e8590c' },
];

const FEATURES = [
  { icon: IconSparkles, title: 'Сигналы без ручной сборки', desc: 'Риски, события и задачи сходятся в одном ядре' },
  { icon: IconMessageCircle, title: 'Связь вокруг ученика', desc: 'Команды, семья и модули видят общий контекст' },
  { icon: IconSchool, title: 'Кабинеты по ролям', desc: 'Каждый сотрудник открывает свой рабочий контур' },
];

type ClusterRole = (typeof CLUSTERS)[number]['roles'][number];

function hasDemoLogin(role: ClusterRole): role is ClusterRole & { readonly demoLogin: string } {
  return 'demoLogin' in role && typeof role.demoLogin === 'string';
}

function buildDemoRoles() {
  return CLUSTERS.flatMap((cluster) =>
    cluster.roles
      .filter(hasDemoLogin)
      .map((role) => ({ ...role, cluster, label: getRoleLabel(role.role) })),
  );
}

function landingForRole(role?: string): string {
  if (role === 'student' || role === 'parent') return '/diary';
  if (role === 'teacher' || role === 'curator') return '/today';
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
  return '/home';
}

export default function LoginPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState('super_admin');
  const [staffOpen, setStaffOpen] = useState(false);
  const demoRoles = useMemo(buildDemoRoles, []);
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const loginByRole = useMemo(
    () => new Map([...ROLE_TABS.map((tab) => [tab.id, tab.login] as const), ...demoRoles.map((role) => [role.role, role.demoLogin!] as const)]),
    [demoRoles],
  );

  const form = useForm({
    initialValues: {
      login: DEMO_LOGIN_ENABLED ? 'admin' : '',
      password: DEMO_LOGIN_ENABLED ? DEMO_PASSWORD : '',
    },
    validate: {
      login: (v) => (v.length < 1 ? 'Введите логин' : null),
      password: (v) => (v.length < 1 ? 'Введите пароль' : null),
    },
  });

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(landingForRole(sessionRole));
    }
  }, [router, sessionRole, status]);

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
    const login = loginByRole.get(id);
    setActiveRole(id);
    if (login) {
      form.setFieldValue('login', login);
      form.setFieldValue('password', DEMO_PASSWORD);
    }
  }

  if (status === 'loading' || status === 'authenticated') return null;

  const staffGroups = (
    <Stack gap={12}>
      {CLUSTERS.map((cluster) => {
        const roles = cluster.roles.filter(hasDemoLogin);
        if (roles.length === 0) return null;

        return (
          <Group key={cluster.id} align="flex-start" gap={14} wrap="nowrap">
            <Group gap={7} w={104} pt={8} wrap="nowrap">
              <Box style={{ width: 6, height: 6, borderRadius: '50%', background: cluster.color, flex: '0 0 auto' }} />
              <Text
                size="11px"
                fw={800}
                tt="uppercase"
                style={{ color: cluster.color, lineHeight: 1.15, letterSpacing: 0 }}
              >
                {cluster.shortLabel}
              </Text>
            </Group>
            <Group gap={6} wrap="wrap" style={{ flex: 1 }}>
              {roles.map((role) => {
                const active = activeRole === role.role;
                const roleLabel = role.role === 'college_counselor' ? 'Колледж' : getRoleLabel(role.role);
                return (
                  <Button
                    key={role.role}
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => selectRole(role.role)}
                    leftSection={<span style={{ fontSize: 14 }}>{role.emoji}</span>}
                    style={{
                      borderRadius: 10,
                      padding: '7px 11px',
                      fontWeight: 700,
                      fontSize: 12.5,
                      border: active ? `1.5px solid ${role.color}` : `1px solid ${WARM_BORDER}`,
                      background: active ? `${cluster.color}16` : '#fff',
                      color: active ? role.color : '#6b5f52',
                      transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                      transform: active ? 'translateY(-1px)' : 'none',
                    }}
                  >
                    {roleLabel}
                  </Button>
                );
              })}
            </Group>
          </Group>
        );
      })}
    </Stack>
  );

  return (
    <>
      <style>{`
        .login-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          background: #faf6ef;
        }

        @media (min-width: 62em) {
          .login-shell {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
          }
        }
      `}</style>
      <Box className="login-shell">
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '40px clamp(24px, 5vw, 64px)',
          justifyContent: 'space-between',
          maxWidth: 620,
          margin: '0 auto',
          width: '100%',
          color: WARM_TEXT,
        }}
      >
        <Group gap={12}>
          <Box
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${WARM_AMBER}, ${WARM_ACCENT})`,
              color: '#fff7e6',
              display: 'grid',
              placeItems: 'center',
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            B
          </Box>
          <div>
            <Text fw={800} size="lg" style={{ letterSpacing: 0 }}>
              Bilim OS
            </Text>
            <Text size="xs" fw={600} style={{ color: '#7a6b5d' }}>
              Школьная ERP-система
            </Text>
          </div>
        </Group>

        <Box py={34}>
          <Text size="sm" fw={800} mb={12} style={{ color: WARM_ACCENT, letterSpacing: '0.02em' }}>
            Добро пожаловать
          </Text>
          <Text fw={800} style={{ fontSize: 36, letterSpacing: 0, lineHeight: 1.15 }}>
            Войдите в свой кабинет
          </Text>
          <Text size="md" mt={14} style={{ lineHeight: 1.55, maxWidth: 440, color: '#6b5f52' }}>
            {DEMO_LOGIN_ENABLED
              ? 'Выберите роль, чтобы подставить демо-логин, или введите свои данные вручную.'
              : 'Введите логин и пароль вашего кабинета.'}
          </Text>

          {DEMO_LOGIN_ENABLED && (
            <>
          <SimpleGrid cols={{ base: 2, xs: 3, sm: 5 }} spacing={10} mt={30} style={{ maxWidth: 520 }}>
            {ROLE_TABS.map((tab) => {
              const active = activeRole === tab.id;
              return (
                <Button
                  key={tab.id}
                  variant="subtle"
                  onClick={() => selectRole(tab.id)}
                  h="auto"
                  p={0}
                  style={{
                    borderRadius: 16,
                    border: active ? `2px solid ${tab.color}` : `1.5px solid ${WARM_BORDER}`,
                    background: active ? `${tab.color}14` : '#fff',
                    boxShadow: active ? `0 10px 24px ${tab.color}30` : '0 1px 2px rgba(43,33,24,0.04)',
                    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                    transform: active ? 'translateY(-2px)' : 'none',
                  }}
                >
                  <Stack gap={3} align="center" py={13} px={8} w="100%">
                    <Text style={{ fontSize: 23, lineHeight: 1 }}>{tab.emoji}</Text>
                    <Text size="sm" fw={800} style={{ color: active ? tab.color : WARM_TEXT }}>
                      {tab.label}
                    </Text>
                  </Stack>
                </Button>
              );
            })}
          </SimpleGrid>

          <Group justify="space-between" align="center" mt={18} mb={8}>
            <Text size="xs" fw={800} style={{ color: '#9a7251', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Кабинеты сотрудников
            </Text>
            <Button
              hiddenFrom="md"
              size="compact-xs"
              variant="subtle"
              onClick={() => setStaffOpen((open) => !open)}
              style={{ color: WARM_ACCENT, fontWeight: 800 }}
            >
              Все кабинеты ({demoRoles.length})
            </Button>
          </Group>
          <Box visibleFrom="md">{staffGroups}</Box>
          <Box hiddenFrom="md">
            <Collapse in={staffOpen}>{staffGroups}</Collapse>
          </Box>
            </>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap={14} mt={24} maw={430}>
              <TextInput
                label="Логин или email"
                leftSection={<IconUser size={17} />}
                size="md"
                radius={10}
                styles={{
                  label: { fontSize: 12.5, fontWeight: 700, color: WARM_TEXT, marginBottom: 6 },
                  input: { background: '#fff', borderColor: WARM_BORDER, color: WARM_TEXT, '--input-bd-focus': WARM_AMBER },
                }}
                {...form.getInputProps('login')}
              />
              <Box>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={700} style={{ color: WARM_TEXT }}>
                    Пароль
                  </Text>
                  <Text size="xs" fw={700} style={{ color: WARM_ACCENT, cursor: 'pointer' }}>
                    Забыли пароль?
                  </Text>
                </Group>
                <PasswordInput
                  leftSection={<IconLock size={17} />}
                  size="md"
                  radius={10}
                  styles={{ input: { background: '#fff', borderColor: WARM_BORDER, color: WARM_TEXT, '--input-bd-focus': WARM_AMBER } }}
                  {...form.getInputProps('password')}
                />
              </Box>

              <Checkbox
                label="Запомнить меня на этом устройстве"
                defaultChecked
                size="sm"
                mt={4}
                color="orange"
                styles={{ label: { fontSize: 13, color: WARM_TEXT } }}
              />

              {error && (
                <Text size="sm" c="red" ta="center">
                  {error}
                </Text>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                mt={6}
                loading={loading}
                radius={12}
                rightSection={<IconArrowRight size={17} />}
                variant="gradient"
                gradient={{ from: WARM_AMBER, to: WARM_ACCENT, deg: 135 }}
                style={{ fontWeight: 800, boxShadow: '0 12px 26px rgba(232,89,12,0.22)' }}
              >
                Войти в кабинет
              </Button>
            </Stack>
          </form>
        </Box>

        <Text size="xs" style={{ color: '#9a8b7b' }}>
          © 2026 Bilim OS · Разработано Asystem
        </Text>
      </Box>

      <Box
        visibleFrom="md"
        style={{
          background: 'radial-gradient(900px at 60% 40%, #2a1a12 0%, #1a1114 55%, #120d16 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '52px clamp(42px, 5vw, 72px)',
          color: '#f7efe4',
        }}
      >
        <OrganismHero />
        <Box style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <Group
            gap={8}
            w="fit-content"
            style={{
              background: 'rgba(255,214,165,0.10)',
              border: '1px solid rgba(255,214,165,0.16)',
              borderRadius: 999,
              padding: '6px 12px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <IconBolt size={14} color="#ffd8a8" />
            <Text size="xs" fw={800} style={{ color: '#ffd8a8' }}>
              Живое ядро
            </Text>
          </Group>

          <Text fw={800} mt={18} style={{ fontSize: 38, letterSpacing: 0, lineHeight: 1.12, color: '#f7efe4' }}>
            Школа — единый организм.
          </Text>
          <Text mt={18} style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(247,239,228,0.75)', maxWidth: 500 }}>
            29 ролей, 15 модулей и каждый ученик связаны одним ядром данных.
          </Text>

          <Group gap={26} mt={34}>
            {[
              { val: '29', label: 'ролей' },
              { val: '15', label: 'модулей' },
              { val: 'live', label: 'события' },
            ].map((stat) => (
              <div key={stat.label}>
                <Text fw={800} style={{ fontSize: 30, color: '#ffd8a8', lineHeight: 1 }}>
                  {stat.val}
                </Text>
                <Text mt={5} style={{ fontSize: 13, color: 'rgba(247,239,228,0.7)' }}>
                  {stat.label}
                </Text>
              </div>
            ))}
          </Group>

          <Stack gap={14} mt={40} maw={440}>
            {FEATURES.map((feature) => (
              <Box
                key={feature.title}
                style={{
                  background: 'rgba(255,214,165,0.08)',
                  border: '1px solid rgba(255,214,165,0.16)',
                  borderRadius: 12,
                  padding: 16,
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <Box
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(255,169,77,0.15)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#ffd8a8',
                    flex: '0 0 auto',
                  }}
                >
                  <feature.icon size={20} />
                </Box>
                <div>
                  <Text fw={700} style={{ fontSize: 14.5, color: '#f7efe4' }}>
                    {feature.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(247,239,228,0.72)', marginTop: 2 }}>
                    {feature.desc}
                  </Text>
                </div>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
      </Box>
    </>
  );
}
