'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from '@/shared/components/auth/AuthGuard';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Group,
  NavLink,
  ScrollArea,
  Tabs,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { EruditeLogo } from '@/shared/components/ui/EruditeLogo';
import { UniversalSearch } from '@/shared/components/ui/UniversalSearch';
import { useRole } from '@/shared/hooks/useRole';
import {
  SIDEBAR_NAV,
  TOP_TABS,
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
  IconChartBar,
  IconChartDots,
  IconClipboardList,
  IconFile,
  IconFolder,
  IconGridDots,
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
};

const TOP_TAB_ICONS: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  schedule: IconCalendar,
  classes: IconSchool,
  teachers: IconUsersGroup,
  logoped: IconSpeakerphone,
  psychologist: IconBrain,
  medical: IconMedicalCross,
  parents: IconUsers,
  accounting: IconCalculator,
  maintenance: IconTool,
  kitchen: IconToolsKitchen2,
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

  const visibleSidebar = useMemo(() => filterNavByRole(SIDEBAR_NAV, role), [role]);
  const visibleTabs = useMemo(() => filterNavByRole(TOP_TABS, role), [role]);

  const initialTab = visibleTabs.find((t) => pathname.startsWith(t.href))?.value ?? visibleTabs[0]?.value ?? '';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string | null) => {
    if (!value) return;
    setActiveTab(value);
    const tab = visibleTabs.find((t) => t.value === value);
    if (tab) router.push(tab.href);
  };

  const today = formatToday();

  return (
    <AuthGuard>
      <AppShell
        header={{ height: 90 }}
        navbar={{ width: 220, breakpoint: 'sm' }}
        padding="md"
      >
        <AppShell.Header>
          <Group h={50} px="md" justify="space-between">
            <Group gap="md">
              <Box w={180}>
                <EruditeLogo size="md" />
              </Box>
              <Group gap={8}>
                <Text size="sm" c="dimmed">{today.label}</Text>
                <Badge variant="light" color="gray" size="sm" radius="sm">{today.weekday}</Badge>
              </Group>
            </Group>

            <Group gap="md">
              <UniversalSearch />
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => toggleColorScheme()}
                title="Переключить тему"
              >
                {colorScheme === 'dark' ? <IconSun size={20} stroke={1.5} /> : <IconMoon size={20} stroke={1.5} />}
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" size="lg">
                <IconBell size={20} stroke={1.5} />
              </ActionIcon>
              <Group gap={8}>
                <Avatar size={32} radius="xl" color="eruditBlue" variant="filled">
                  {getInitials(login)}
                </Avatar>
                <Box>
                  <Text size="xs" fw={500} lh={1.2}>{login ?? '—'}</Text>
                  <Text size="xs" c="dimmed" lh={1.2}>{role ? ROLE_LABEL[role] ?? role : '—'}</Text>
                </Box>
              </Group>
            </Group>
          </Group>

          <Group h={40} px="md" gap="md">
            <Box w={180}>
              <ActionIcon variant="filled" color="blue" size="sm">
                <IconGridDots size={14} />
              </ActionIcon>
            </Box>
            <ScrollArea type="never" style={{ flex: 1 }}>
              <Tabs value={activeTab} onChange={handleTabChange} variant="default">
                <Tabs.List style={{ flexWrap: 'nowrap', borderBottom: 'none' }}>
                  {visibleTabs.map((tab) => {
                    const TabIcon = TOP_TAB_ICONS[tab.value];
                    return (
                      <Tabs.Tab
                        key={tab.value}
                        value={tab.value}
                        leftSection={TabIcon ? <TabIcon size={14} stroke={1.5} /> : undefined}
                        fz={12}
                      >
                        {tab.label}
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>
              </Tabs>
            </ScrollArea>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="xs">
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
                    />
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.href}
                        component={Link}
                        href={child.href}
                        label={child.label}
                        active={pathname === child.href}
                        fz={12}
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
                  active={isActive}
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
