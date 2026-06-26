'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AuthGuard } from '@/shared/components/auth/AuthGuard';
import { AssistantWidget } from '@/shared/components/assistant/AssistantWidget';
import { PwaRegister } from '@/shared/components/pwa/PwaRegister';
import {
  ActionIcon,
  AppShell,
  Burger,
  Avatar,
  Badge,
  Box,
  Group,
  Indicator,
  Menu,
  NavLink,
  ScrollArea,
  Text,
} from '@mantine/core';
import { EruditeLogo } from '@/shared/components/ui/EruditeLogo';
import { UniversalSearch } from '@/shared/components/ui/UniversalSearch';
import { BranchSelector } from '@/shared/components/ui/BranchSelector';
import { useRole } from '@/shared/hooks/useRole';
import {
  SIDEBAR_NAV,
  filterNavByRole,
  flattenNavLeaves,
  type NavRoute,
} from '@/shared/lib/nav-config';
import { IconBell, IconChevronDown, IconLogout } from '@tabler/icons-react';
import { SIDEBAR_ICONS } from '@/shared/lib/sidebar-icons';


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
  accountant: 'Бухгалтер',
  psychologist: 'Психолог',
  doctor: 'Врач',
  hr: 'Кадровик',
  librarian: 'Библиотекарь',
  cook: 'Повар',
  zavhoz: 'Завхоз',
  zavuch_primary: 'Завуч по младшим классам',
  zavuch_senior: 'Завуч по старшим классам',
  zavuch_academic: 'Завуч по учебной части',
  cambridge_coord: 'Кэмбридж-координатор',
};

/** Домашняя страница узких ролей — их собственный кабинет. */
const ROLE_HOME: Record<string, string> = {
  accountant: '/workspace/accounting',
  psychologist: '/workspace/psychologist',
  doctor: '/workspace/medical',
  hr: '/staff',
  librarian: '/library',
  cook: '/workspace/kitchen',
  zavhoz: '/workspace/maintenance',
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
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [agentCount, setAgentCount] = useState(0);

  // Счётчик непрочитанных элементов Панели агента (колокольчик)
  useEffect(() => {
    let active = true;
    const fetchCount = () => {
      fetch('/api/v1/agent/items')
        .then((r) => r.json())
        .then((j) => { if (active && j.success) setAgentCount(j.data.newCount ?? 0); })
        .catch(() => {});
    };
    fetchCount();
    const t = setInterval(fetchCount, 60000);
    return () => { active = false; clearInterval(t); };
  }, [pathname]);

  // Student/parent → дневник; узкие роли → их кабинет (вместо общего дашборда)
  useEffect(() => {
    if ((role === 'student' || role === 'parent') && pathname === '/dashboard') {
      router.replace('/diary');
    } else if (role && ROLE_HOME[role] && pathname === '/dashboard') {
      router.replace(ROLE_HOME[role]);
    }
  }, [role, pathname, router]);

  const visibleSidebar = useMemo(() => filterNavByRole(SIDEBAR_NAV, role), [role]);

  // Заголовок страницы в шапке — ищем активный лист (в т.ч. внутри сворачиваемых разделов).
  const pageTitle = useMemo(() => {
    const leaves = flattenNavLeaves(visibleSidebar);
    const exact = leaves.find((l) => pathname === l.href);
    if (exact) return exact.label;
    const prefix = leaves
      .filter((l) => pathname.startsWith(l.href + '/'))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return prefix?.label ?? 'Bilim OS';
  }, [visibleSidebar, pathname]);

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
                {pageTitle}
              </Text>
            </Group>

            <Group gap="md">
              <Box visibleFrom="sm"><BranchSelector /></Box>
              <Box visibleFrom="sm"><UniversalSearch /></Box>
              <Indicator
                color="red" size={16} offset={4} disabled={agentCount === 0}
                label={agentCount > 9 ? '9+' : agentCount} visibleFrom="sm"
              >
                <ActionIcon
                  component={Link} href="/agent" variant="subtle"
                  color={agentCount > 0 ? 'blue' : 'gray'} size="lg"
                  aria-label="Панель агента"
                >
                  <IconBell size={20} stroke={1.5} />
                </ActionIcon>
              </Indicator>
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
                    <Box visibleFrom="sm" component="span"><IconChevronDown size={14} stroke={1.5} style={{ color: 'var(--mantine-color-dimmed)' }} /></Box>
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
              <div className="brand-mark">B</div>
              <div>
                <Text fw={700} size="sm" lh={1.2} style={{ letterSpacing: '-0.02em' }}>Bilim OS</Text>
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
                const childOpen = item.children!.some(
                  (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
                );
                return (
                  <NavLink
                    key={item.href}
                    label={item.label}
                    leftSection={ItemIcon ? <ItemIcon size={16} stroke={1.5} /> : undefined}
                    defaultOpened={childOpen || (!item.group && isActive)}
                    childrenOffset={28}
                  >
                    {/* у раздела-обёртки (group) своей страницы нет — self-link не рендерим */}
                    {!item.group && (
                      <NavLink
                        component={Link}
                        href={item.href}
                        label={item.label}
                        active={pathname === item.href}
                        fz={12}
                        onClick={closeMobile}
                      />
                    )}
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
          <AssistantWidget />
          <PwaRegister />
        </AppShell.Main>
      </AppShell>
    </AuthGuard>
  );
}
