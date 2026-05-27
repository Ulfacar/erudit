'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AuthGuard } from '@/shared/components/auth/AuthGuard';
import {
  ActionIcon,
  AppShell,
  Burger,
  Avatar,
  Badge,
  Box,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { EruditeLogo } from '@/shared/components/ui/EruditeLogo';
import { UniversalSearch } from '@/shared/components/ui/UniversalSearch';
import { useRole } from '@/shared/hooks/useRole';
import {
  SIDEBAR_NAV,
  filterNavByRole,
  type NavRoute,
} from '@/shared/lib/nav-config';
import {
  IconArrowsExchange,
  IconBell,
  IconBook,
  IconBooks,
  IconCalendar,
  IconCalendarEvent,
  IconChalkboard,
  IconChevronDown,
  IconLogout,
  IconChartBar,
  IconChartDots,
  IconClipboardList,
  IconFile,
  IconFolder,
  IconHome,
  IconId,
  IconMedal,
  IconMessage,
  IconMoon,
  IconNews,
  IconNotebook,
  IconPalette,
  IconSchool,
  IconShield,
  IconStar,
  IconSun,
  IconTable,
  IconTrophy,
  IconUsers,
  IconBus,
  IconAlertTriangle,
  IconFlame,
  IconBrain,
  IconCalculator,
  IconMedicalCross,
  IconSpeakerphone,
  IconTool,
  IconToolsKitchen2,
  IconUsersGroup,
} from '@tabler/icons-react';

const SIDEBAR_ICONS: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  '/diary': IconNotebook,
  '/dashboard': IconHome,
  '/calendar': IconCalendar,
  '/classes': IconSchool,
  '/academic-periods': IconCalendarEvent,
  '/substitutions': IconArrowsExchange,
  '/curriculum-plan': IconClipboardList,
  '/study-plan': IconBook,
  '/schedule': IconTable,
  '/grading': IconStar,
  '/homework': IconNotebook,
  '/students': IconUsers,
  '/teachers': IconChalkboard,
  '/roles': IconShield,
  '/chats': IconMessage,
  '/reports': IconChartBar,
  '/achievements': IconTrophy,
  '/olympiads': IconMedal,
  '/portfolio': IconFolder,
  '/events': IconCalendarEvent,
  '/studios': IconPalette,
  '/trips': IconBus,
  '/staff': IconId,
  '/documents': IconFile,
  '/news': IconNews,
  '/urgent-issues': IconAlertTriangle,
  '/incidents': IconFlame,
  '/library': IconBooks,
  '/analytics': IconChartDots,
  '/workspace/speech': IconSpeakerphone,
  '/workspace/psychologist': IconBrain,
  '/workspace/medical': IconMedicalCross,
  '/workspace/parents': IconUsers,
};


const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Суперадмин',
  analyst: 'Аналитик',
  zavuch: 'Завуч',
  secretary: 'Секретарь',
  teacher: 'Педагог',
  curator: 'Куратор',
  specialist: 'Специалист',
  student: 'Ученик',
  parent: 'Родитель',
};

const WEEKDAY_LABEL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

function formatToday() {
  const today = new Date();
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    label: formatter.format(today),
    weekday: WEEKDAY_LABEL[today.getDay()],
  };
}

function getInitials(login: string | null): string {
  if (!login) return '??';
  const trimmed = login.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, login } = useRole();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();

  // Student/parent → redirect to diary instead of dashboard
  useEffect(() => {
    if ((role === 'student' || role === 'parent') && pathname === '/dashboard') {
      router.replace('/diary');
    }
  }, [role, pathname, router]);

  const visibleSidebar = useMemo(() => filterNavByRole(SIDEBAR_NAV, role), [role]);

  const today = formatToday();

  return (
    <AuthGuard>
      <AppShell
        header={{ height: { base: 50, sm: 64 } }}
        navbar={{ width: 256, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
        padding="md"
        styles={{
          navbar: {
            borderRight: '1px solid #e6e9ee',
            backgroundColor: '#ffffff',
          },
          header: {
            borderBottom: '1px solid #e6e9ee',
            backgroundColor: '#ffffff',
          },
          main: {
            backgroundColor: '#f8f9fb',
          },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="md">
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
              <Text size="lg" fw={600} c="var(--mantine-color-gray-9)" style={{ letterSpacing: '-0.01em' }}>
                {visibleSidebar.find((s) => pathname === s.href || pathname.startsWith(s.href + '/'))?.label ?? 'ERUDIT'}
              </Text>
            </Group>

            <Group gap="md">
              <Box visibleFrom="sm"><UniversalSearch /></Box>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => toggleColorScheme()}
                title="Переключить тему"
                visibleFrom="sm"
              >
                {colorScheme === 'dark' ? <IconSun size={20} stroke={1.5} /> : <IconMoon size={20} stroke={1.5} />}
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" size="lg" visibleFrom="sm">
                <IconBell size={20} stroke={1.5} />
              </ActionIcon>
              <Menu shadow="md" width={220} position="bottom-end" withArrow>
                <Menu.Target>
                  <Group gap={8} style={{ cursor: 'pointer' }}>
                    <Avatar size={32} radius="xl" color="eruditBlue" variant="filled">
                      {getInitials(login)}
                    </Avatar>
                    <Box visibleFrom="sm">
                      <Text size="xs" fw={500} lh={1.2}>{login ?? '—'}</Text>
                      <Text size="xs" c="dimmed" lh={1.2}>{role ? ROLE_LABEL[role] ?? role : '—'}</Text>
                    </Box>
                    <IconChevronDown size={14} stroke={1.5} style={{ color: 'var(--mantine-color-dimmed)' }} visibleFrom="sm" />
                  </Group>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{login ?? '—'} · {role ? ROLE_LABEL[role] ?? role : '—'}</Menu.Label>
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} stroke={1.5} />}
                    onClick={() => signOut({ callbackUrl: '/login' })}
                  >
                    Выйти
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          {/* Top tabs removed — navigation via sidebar */}
        </AppShell.Header>

        <AppShell.Navbar p="xs">
          {/* Brand */}
          <Box px="sm" py="md" mb="xs" style={{ borderBottom: '1px solid #eef0f4' }}>
            <Group gap={10}>
              <div className="brand-mark">E</div>
              <div>
                <Text fw={700} size="sm" lh={1.2} style={{ letterSpacing: '-0.02em' }}>ERUDIT</Text>
                <Text size="xs" c="dimmed" lh={1.2} fw={500}>Система управления школой</Text>
              </div>
            </Group>
          </Box>

          <Text size="xs" fw={600} c="dimmed" px="sm" mb={4} style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
            Меню
          </Text>

          <AppShell.Section grow component={ScrollArea}>
            {visibleSidebar.map((item: NavRoute) => {
              const hasChildren = item.children && item.children.length > 0;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const ItemIcon = SIDEBAR_ICONS[item.href];

              if (hasChildren) {
                return (
                  <NavLink
                    key={item.href}
                    label={item.label}
                    leftSection={ItemIcon ? <ItemIcon size={16} stroke={1.5} /> : undefined}
                    defaultOpened={isActive}
                    childrenOffset={28}
                  >
                    <NavLink
                      component={Link}
                      href={item.href}
                      label={item.label}
                      active={pathname === item.href}
                      fz={12}
                      onClick={closeMobile}
                    />
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.href}
                        component={Link}
                        href={child.href}
                        label={child.label}
                        active={pathname === child.href}
                        fz={12}
                        onClick={closeMobile}
                      />
                    ))}
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  leftSection={ItemIcon ? <ItemIcon size={16} stroke={1.5} /> : undefined}
                  rightSection={item.badge ? (
                    <Badge size="xs" variant="light" color="blue" radius="sm">{item.badge}</Badge>
                  ) : undefined}
                  active={isActive}
                  onClick={closeMobile}
                />
              );
            })}
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main>
          {children}
        </AppShell.Main>
      </AppShell>
    </AuthGuard>
  );
}
