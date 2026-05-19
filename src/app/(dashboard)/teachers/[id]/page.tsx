'use client';

import { use, useState, useMemo, useCallback } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsExchange,
  IconCalendar,
  IconClipboardList,
  IconSchool,
  IconUserOff,
  IconUsers,
  IconClock,
  IconBriefcase,
  IconMedicalCross,
  IconTrophy,
  IconPhone,
  IconMail,
  IconMapPin,
  IconCake,
  IconHeart,
  IconCertificate,
  IconBook,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TeacherDescriptors } from '@/shared/components/teachers/TeacherDescriptors';
import { TeacherTransfers } from '@/shared/components/teachers/TeacherTransfers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

/* ── Helpers ── */
function getFullName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  return [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ');
}

function getInitials(t: { firstName: string; lastName: string }) {
  return `${t.lastName[0] || ''}${t.firstName[0] || ''}`.toUpperCase();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getYearsLabel(years: number) {
  const lastDigit = years % 10;
  const lastTwo = years % 100;
  if (lastTwo >= 11 && lastTwo <= 19) return `${years} лет`;
  if (lastDigit === 1) return `${years} год`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${years} года`;
  return `${years} лет`;
}

function getExperience(hireDate: string | null | undefined) {
  if (!hireDate) return null;
  const years = Math.floor(
    (Date.now() - new Date(hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return Math.max(0, years);
}

function getLessonsLabel(count: number) {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 19) return `${count} уроков`;
  if (lastDigit === 1) return `${count} урок`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} урока`;
  return `${count} уроков`;
}

/* ── Day names ── */
const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

/* ── Mock personal data for teachers ── */
interface TeacherPersonalData {
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  maritalStatus: string;
  children: { name: string; year: number }[];
  education: string;
  totalExperience: number;
  schoolExperience: number;
  medicalBookValid: string;
}

const TEACHER_PERSONAL_DATA: Record<string, TeacherPersonalData> = {
  'azhibaeva': {
    birthDate: '15.03.1985',
    phone: '+996 555 12 34 56',
    email: 'ajibaeva@erudit.kg',
    address: 'г. Бишкек, ул. Токтогула 45, кв. 12',
    maritalStatus: 'Замужем',
    children: [
      { name: 'Ажибаев Алмаз', year: 2010 },
      { name: 'Ажибаева Айдана', year: 2013 },
    ],
    education: 'КГУ им. И. Арабаева, Факультет кыргызского языка, 2007',
    totalExperience: 18,
    schoolExperience: 5,
    medicalBookValid: '2026',
  },
  'khaydarova': {
    birthDate: '22.07.1980',
    phone: '+996 700 45 67 89',
    email: 'khaydarova@erudit.kg',
    address: 'г. Бишкек, ул. Киевская 112, кв. 34',
    maritalStatus: 'Замужем',
    children: [
      { name: 'Хайдаров Тимур', year: 2005 },
    ],
    education: 'КНУ им. Ж. Баласагына, Филологический факультет, 2002',
    totalExperience: 23,
    schoolExperience: 8,
    medicalBookValid: '2027',
  },
  'pulatova': {
    birthDate: '10.11.1988',
    phone: '+996 555 78 90 12',
    email: 'pulatova@erudit.kg',
    address: 'г. Бишкек, ул. Ахунбаева 67',
    maritalStatus: 'Замужем',
    children: [
      { name: 'Пулатов Аскар', year: 2015 },
      { name: 'Пулатова Мадина', year: 2018 },
    ],
    education: 'КГТУ им. И. Раззакова, Факультет математики, 2010',
    totalExperience: 15,
    schoolExperience: 6,
    medicalBookValid: '2026',
  },
  'sagyntai': {
    birthDate: '03.05.1990',
    phone: '+996 700 33 44 55',
    email: 'sagyntai@erudit.kg',
    address: 'г. Бишкек, ул. Жибек Жолу 234, кв. 56',
    maritalStatus: 'Не замужем',
    children: [],
    education: 'БГУ, Факультет математики и информатики, 2012',
    totalExperience: 13,
    schoolExperience: 4,
    medicalBookValid: '2027',
  },
  'egorova': {
    birthDate: '18.09.1978',
    phone: '+996 555 99 88 77',
    email: 'egorova@erudit.kg',
    address: 'г. Бишкек, ул. Московская 89, кв. 7',
    maritalStatus: 'Замужем',
    children: [
      { name: 'Егорова Анастасия', year: 2003 },
      { name: 'Егоров Максим', year: 2008 },
    ],
    education: 'КРСУ, Факультет иностранных языков, 2000',
    totalExperience: 25,
    schoolExperience: 10,
    medicalBookValid: '2026',
  },
  'fominykh': {
    birthDate: '27.01.1986',
    phone: '+996 700 11 22 33',
    email: 'fominykh@erudit.kg',
    address: 'г. Бишкек, ул. Боконбаева 150',
    maritalStatus: 'Замужем',
    children: [
      { name: 'Фоминых Артем', year: 2012 },
    ],
    education: 'КНУ им. Ж. Баласагына, Биологический факультет, 2008',
    totalExperience: 17,
    schoolExperience: 7,
    medicalBookValid: '2027',
  },
  'kalykov': {
    birthDate: '14.06.1992',
    phone: '+996 555 66 77 88',
    email: 'kalykov@erudit.kg',
    address: 'г. Бишкек, ул. Чуй 128, кв. 22',
    maritalStatus: 'Женат',
    children: [
      { name: 'Калыкова Айым', year: 2019 },
    ],
    education: 'КНУ им. Ж. Баласагына, Географический факультет, 2014',
    totalExperience: 11,
    schoolExperience: 5,
    medicalBookValid: '2026',
  },
};

/* ── Schedule entry type ── */
interface ScheduleEntryType {
  id: string;
  dayOfWeek: number;
  slot: { slotNumber: number; startTime: string; endTime: string };
  subject: { name: string; color?: string | null };
  class: { grade: number; letter: string };
}

/* ── Placeholder for empty sections ── */
function EmptySection({ text }: { text: string }) {
  return (
    <Paper withBorder radius="md" p="xl" ta="center">
      <Text size="sm" c="dimmed">{text}</Text>
    </Paper>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mainTab, setMainTab] = useState<string | null>('personal');
  const [subTab, setSubTab] = useState<string | null>('data');
  const [substitutionModalOpen, setSubstitutionModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/teachers/${id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const teacher = data?.data;

  if (isLoading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader color="eruditBlue" />
      </Box>
    );
  }

  if (error || !teacher) {
    return (
      <Paper withBorder radius="md" p="xl" ta="center">
        <Text c="red" size="sm">Педагог не найден</Text>
      </Paper>
    );
  }

  const experience = getExperience(teacher.hireDate);
  const uniqueSubjects = [
    ...new Map(
      (teacher.subjects || []).map((ts: { subjectId: string; subject: { id: string; name: string; color?: string | null } }) => [ts.subjectId, ts.subject])
    ).values(),
  ] as { id: string; name: string; color?: string | null }[];

  /* Group schedule entries by day */
  const scheduleByDay: Record<number, ScheduleEntryType[]> = {};
  if (teacher.scheduleEntries) {
    for (const entry of teacher.scheduleEntries) {
      const day = entry.dayOfWeek ?? 0;
      if (!scheduleByDay[day]) scheduleByDay[day] = [];
      scheduleByDay[day].push(entry);
    }
    for (const day in scheduleByDay) {
      scheduleByDay[day].sort((a: ScheduleEntryType, b: ScheduleEntryType) => a.slot.slotNumber - b.slot.slotNumber);
    }
  }

  // Resolve teacher login from user email for mock data lookup
  const teacherLogin = teacher.user?.email?.split('@')[0] || '';

  // Build nav card data
  const curatorLabel = teacher.curatorOf?.length > 0
    ? teacher.curatorOf.map((c: { grade: number; letter: string }) => `${c.grade}${c.letter} класс`).join(', ')
    : 'Не назначен';
  const scheduleCount = teacher.scheduleEntries?.length || 0;
  const substitutionCount = (teacher.substitutionAsOriginalCount || 0) + (teacher.substitutionAsSubstituteCount || 0);

  // Navigate sub-tab when clicking nav cards
  const handleNavCard = (key: string) => {
    if (key === 'curatorship') {
      setMainTab('personal');
      setSubTab('curatorship');
    } else if (key === 'schedule') {
      setMainTab('personal');
      setSubTab('schedule');
    } else if (key === 'substitutions') {
      setSubstitutionModalOpen(true);
    }
  };

  const NAV_CARDS = [
    { key: 'curatorship', label: 'Кураторство', icon: IconUsers, sub: curatorLabel, hasAction: true },
    { key: 'schedule', label: 'Расписание', icon: IconCalendar, sub: scheduleCount > 0 ? `${getLessonsLabel(scheduleCount)} в неделю` : 'Нет расписания', hasAction: true },
    { key: 'substitutions', label: 'Замена', icon: IconArrowsExchange, sub: substitutionCount > 0 ? `${substitutionCount} замен` : 'Нет замен', hasAction: true },
    { key: 'absences', label: 'Пропуски', icon: IconUserOff, sub: 'В разработке', hasAction: false },
    { key: 'projects', label: 'Проектная деятельность', icon: IconBriefcase, sub: 'В разработке', hasAction: false },
  ];

  return (
    <Stack gap="md">
      {/* ── Top 5 Navigation Cards ── */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
        {NAV_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Paper key={card.key} withBorder radius="md" p="md" ta="center">
              <Stack align="center" gap="xs">
                <Icon size={28} stroke={1.5} color="var(--mantine-color-dimmed)" />
                <Text fw={600} size="sm">{card.label}</Text>
                <Text size="xs" c="dimmed">{card.sub}</Text>
                {card.hasAction ? (
                  <Button
                    size="xs"
                    variant="filled"
                    color="eruditBlue"
                    radius="sm"
                    onClick={() => handleNavCard(card.key)}
                  >
                    Показать
                  </Button>
                ) : (
                  <Badge size="sm" variant="light" color="gray">Скоро</Badge>
                )}
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>

      {/* ── Breadcrumb ── */}
      <Group gap={6}>
        <Text component={Link} href="/dashboard" size="xs" c="blue" style={{ textDecoration: 'none' }}>
          Главная
        </Text>
        <Text size="xs" c="dimmed">/</Text>
        <Text component={Link} href="/teachers" size="xs" c="blue" style={{ textDecoration: 'none' }}>
          Педагоги предметники
        </Text>
        <Text size="xs" c="dimmed">/</Text>
        <Text size="xs" c="dimmed">Личные данные</Text>
        <Text size="xs" c="dimmed">/</Text>
        <Text size="xs" c="eruditPink">{getFullName(teacher)}</Text>
      </Group>

      {/* ── Main Tabs ── */}
      <Tabs value={mainTab} onChange={setMainTab} color="eruditBlue">
        <Tabs.List>
          <Tabs.Tab value="subject-teachers">Педагоги предметники</Tabs.Tab>
          <Tabs.Tab value="personal">Личные данные</Tabs.Tab>
          <Tabs.Tab value="characteristics">Характеристика</Tabs.Tab>
        </Tabs.List>

        {/* === Педагоги предметники tab === */}
        <Tabs.Panel value="subject-teachers" pt="md">
          <Paper withBorder radius="md" p="xl" ta="center">
            <Stack align="center" gap="md">
              <IconUsers size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">Для просмотра полного списка педагогов перейдите на страницу педагогов.</Text>
              <Button
                component={Link}
                href="/teachers"
                variant="light"
                color="eruditBlue"
                leftSection={<IconSchool size={16} />}
              >
                Вернуться к списку педагогов
              </Button>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* === Личные данные tab === */}
        <Tabs.Panel value="personal" pt="md">
          {/* Sub-tabs */}
          <Tabs value={subTab} onChange={setSubTab} color="eruditBlue" variant="pills" mb="md">
            <Tabs.List>
              <Tabs.Tab value="data">Данные педагога</Tabs.Tab>
              <Tabs.Tab value="curatorship">Кураторство</Tabs.Tab>
              <Tabs.Tab value="schedule">Расписание</Tabs.Tab>
              <Tabs.Tab value="rating">Рейтинг</Tabs.Tab>
              <Tabs.Tab value="study-plan">Учебный план</Tabs.Tab>
            </Tabs.List>

            {/* ──── Данные педагога (Personal Data) ──── */}
            <Tabs.Panel value="data" pt="md">
              <PersonalDataTab teacher={teacher} experience={experience} uniqueSubjects={uniqueSubjects} teacherLogin={teacherLogin} />
            </Tabs.Panel>

            {/* ──── Кураторство ──── */}
            <Tabs.Panel value="curatorship" pt="md">
              <CuratorshipTab teacher={teacher} />
            </Tabs.Panel>

            {/* ──── Расписание ──── */}
            <Tabs.Panel value="schedule" pt="md">
              <ScheduleTab scheduleByDay={scheduleByDay} />
            </Tabs.Panel>

            {/* ──── Рейтинг ──── */}
            <Tabs.Panel value="rating" pt="md">
              <RatingTab teacher={teacher} />
            </Tabs.Panel>

            {/* ──── Учебный план ──── */}
            <Tabs.Panel value="study-plan" pt="md">
              <StudyPlanTab teacher={teacher} />
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        {/* === Характеристика tab === */}
        <Tabs.Panel value="characteristics" pt="md">
          <Stack gap="md">
            <CharacteristicsTab teacher={teacher} experience={experience} uniqueSubjects={uniqueSubjects} />
            <TeacherDescriptors
              teacherId={teacher.id}
              viewerMaxLevel={teacher.viewerMaxDescriptorLevel ?? 0}
            />
            <TeacherTransfers teacherId={teacher.id} />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* ── Substitution History Modal ── */}
      <Modal
        opened={substitutionModalOpen}
        onClose={() => setSubstitutionModalOpen(false)}
        title="История замен"
        size="xl"
      >
        <SubstitutionHistoryModal teacherId={id} />
      </Modal>
    </Stack>
  );
}

/* ============================================================
   PERSONAL DATA TAB (2-column layout matching Figma 02_open-1)
   ============================================================ */
function PersonalDataTab({
  teacher,
  experience,
  uniqueSubjects,
  teacherLogin,
}: {
  teacher: Record<string, unknown> & {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    photo?: string | null;
    position?: string | null;
    hireDate?: string | null;
    user?: { email?: string | null };
    curatorOf?: { id: string; grade: number; letter: string; level: { name: string } }[];
  };
  experience: number | null;
  uniqueSubjects: { id: string; name: string; color?: string | null }[];
  teacherLogin: string;
}) {
  const personalData = TEACHER_PERSONAL_DATA[teacherLogin];
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields state
  const [editData, setEditData] = useState({
    birthDate: personalData?.birthDate || '',
    phone: personalData?.phone || '',
    email: personalData?.email || teacher.user?.email || '',
    address: personalData?.address || '',
    maritalStatus: personalData?.maritalStatus || '',
    education: personalData?.education || '',
  });

  const handleEdit = useCallback(() => {
    setEditData({
      birthDate: personalData?.birthDate || '',
      phone: personalData?.phone || '',
      email: personalData?.email || teacher.user?.email || '',
      address: personalData?.address || '',
      maritalStatus: personalData?.maritalStatus || '',
      education: personalData?.education || '',
    });
    setIsEditing(true);
  }, [personalData, teacher.user?.email]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/teachers/${teacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalData: editData,
        }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setIsEditing(false);
      notifications?.show?.({
        title: 'Сохранено',
        message: 'Данные педагога успешно обновлены',
        color: 'green',
      });
    } catch {
      notifications?.show?.({
        title: 'Ошибка',
        message: 'Не удалось сохранить данные',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }, [teacher.id, editData]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <Grid gutter="lg">
      {/* ── Left Column: Personal Info Sidebar ── */}
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            {/* Label + Edit button */}
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Педагог</Text>
              {!isEditing ? (
                <Button size="xs" variant="light" color="eruditBlue" onClick={handleEdit}>
                  Редактировать
                </Button>
              ) : (
                <Group gap={4}>
                  <Button size="xs" variant="light" color="gray" onClick={handleCancel}>
                    Отмена
                  </Button>
                  <Button size="xs" variant="filled" color="green" onClick={handleSave} loading={isSaving}>
                    Сохранить
                  </Button>
                </Group>
              )}
            </Group>

            {/* Avatar */}
            <Box ta="center">
              <Avatar
                size={120}
                radius="xl"
                color="eruditBlue"
                variant="filled"
                src={teacher.photo}
                mx="auto"
              >
                {getInitials(teacher)}
              </Avatar>
            </Box>

            {/* Name */}
            <Text fw={700} size="lg" ta="center">{getFullName(teacher)}</Text>

            {/* Experience */}
            {personalData ? (
              <Text size="xs" c="dimmed" ta="center">
                общ.стаж {getYearsLabel(personalData.totalExperience)}, в нашей {getYearsLabel(personalData.schoolExperience)}
              </Text>
            ) : experience !== null ? (
              <Text size="xs" c="dimmed" ta="center">
                в нашей школе {getYearsLabel(experience)}
              </Text>
            ) : null}

            <Divider />

            {/* Personal details */}
            <Stack gap="sm">
              {isEditing ? (
                <>
                  <TextInput
                    label="Дата рождения"
                    size="xs"
                    value={editData.birthDate}
                    onChange={(e) => setEditData((p) => ({ ...p, birthDate: e.currentTarget.value }))}
                    placeholder="ДД.ММ.ГГГГ"
                    leftSection={<IconCake size={14} />}
                  />
                  <Select
                    label="Семейное положение"
                    size="xs"
                    value={editData.maritalStatus}
                    onChange={(val) => setEditData((p) => ({ ...p, maritalStatus: val || '' }))}
                    data={['Замужем', 'Не замужем', 'Женат', 'Не женат', 'В разводе']}
                    placeholder="Выберите"
                    clearable
                  />
                  <TextInput
                    label="Номер телефона"
                    size="xs"
                    value={editData.phone}
                    onChange={(e) => setEditData((p) => ({ ...p, phone: e.currentTarget.value }))}
                    placeholder="+996 XXX XX XX XX"
                    leftSection={<IconPhone size={14} />}
                  />
                  <TextInput
                    label="Email"
                    size="xs"
                    value={editData.email}
                    onChange={(e) => setEditData((p) => ({ ...p, email: e.currentTarget.value }))}
                    placeholder="email@erudit.kg"
                    leftSection={<IconMail size={14} />}
                  />
                  <TextInput
                    label="Адрес"
                    size="xs"
                    value={editData.address}
                    onChange={(e) => setEditData((p) => ({ ...p, address: e.currentTarget.value }))}
                    placeholder="Город, улица, дом"
                    leftSection={<IconMapPin size={14} />}
                  />
                </>
              ) : (
                <>
                  <InfoRow
                    icon={<IconCake size={14} />}
                    label="Дата рождения"
                    value={personalData?.birthDate || 'не указана'}
                  />
                  <InfoRow
                    icon={<IconHeart size={14} />}
                    label="Семейное положение"
                    value={personalData?.maritalStatus || 'не указано'}
                  />
                  <InfoRow
                    icon={<IconPhone size={14} />}
                    label="Номер телефона"
                    value={personalData?.phone || '+7 (XXX) XXX-XX-XX'}
                  />
                  <InfoRow
                    icon={<IconMail size={14} />}
                    label="Email"
                    value={personalData?.email || teacher.user?.email || 'не указан'}
                  />
                  <InfoRow
                    icon={<IconMapPin size={14} />}
                    label="Адрес"
                    value={personalData?.address || 'не указан'}
                  />
                </>
              )}
            </Stack>

            <Divider />

            {/* Children */}
            <Box>
              <Text size="xs" c="dimmed" fw={600} mb={4}>Дети</Text>
              {personalData && personalData.children.length > 0 ? (
                <Stack gap={2}>
                  {personalData.children.map((child) => (
                    <Text key={child.name} size="xs">
                      {child.name} ({child.year} г.р.)
                    </Text>
                  ))}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">Информация не заполнена</Text>
              )}
            </Box>

            <Divider />

            {/* Achievements */}
            <Box>
              <Text size="xs" c="dimmed" fw={600} mb={4}>Достижения и Олимпиады</Text>
              <Text size="xs" c="dimmed">Нет данных</Text>
            </Box>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* ── Right Column: Education, Experience, Medical ── */}
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack gap="lg">
          {/* Education & Work Experience */}
          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size={28} radius="xl" variant="light" color="eruditBlue">
                  <IconCertificate size={16} />
                </ThemeIcon>
                <Text fw={700} size="md">Образование и опыт работы</Text>
              </Group>

              <Divider />

              {/* Hire date */}
              <Group gap="sm">
                <Text size="xs" c="dimmed" w={260}>Дата поступления в нашу школу:</Text>
                <Text size="sm" fw={500}>{formatDate(teacher.hireDate)}</Text>
              </Group>

              <Divider variant="dashed" />

              {/* Education */}
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={8}>Образование</Text>
                {isEditing ? (
                  <TextInput
                    size="xs"
                    value={editData.education}
                    onChange={(e) => setEditData((p) => ({ ...p, education: e.currentTarget.value }))}
                    placeholder="ВУЗ, факультет, год окончания"
                  />
                ) : personalData?.education ? (
                  <Paper bg="var(--mantine-color-dark-6)" radius="sm" p="sm">
                    <Text size="sm">{personalData.education}</Text>
                  </Paper>
                ) : (
                  <Paper bg="var(--mantine-color-dark-6)" radius="sm" p="sm">
                    <Text size="xs" c="dimmed">
                      Информация об образовании не заполнена. Добавьте данные об учебных заведениях,
                      специальностях и годах обучения.
                    </Text>
                  </Paper>
                )}
              </Box>

              <Divider variant="dashed" />

              {/* Certificates */}
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={8}>Копии дипломов и сертификатов</Text>
                <Paper bg="var(--mantine-color-dark-6)" radius="sm" p="sm">
                  <Text size="xs" c="dimmed">Нет загруженных документов</Text>
                </Paper>
              </Box>

              <Divider variant="dashed" />

              {/* Work experience */}
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={8}>Опыт работы по специальности</Text>
                {personalData ? (
                  <Paper bg="var(--mantine-color-dark-6)" radius="sm" p="sm">
                    <Text size="sm">
                      Общий стаж: {getYearsLabel(personalData.totalExperience)}.
                      В школе Эрудит: {getYearsLabel(personalData.schoolExperience)}.
                    </Text>
                  </Paper>
                ) : (
                  <Paper bg="var(--mantine-color-dark-6)" radius="sm" p="sm">
                    <Text size="xs" c="dimmed">Информация не заполнена</Text>
                  </Paper>
                )}
              </Box>

              <Divider variant="dashed" />

              {/* Professional skills */}
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={8}>Профессиональные навыки</Text>
                <Group gap={4} wrap="wrap">
                  {uniqueSubjects.length > 0 ? (
                    uniqueSubjects.map((s) => (
                      <Badge key={s.id} size="sm" variant="light" color={s.color || 'blue'}>
                        {s.name}
                      </Badge>
                    ))
                  ) : (
                    <Text size="xs" c="dimmed">Не указаны</Text>
                  )}
                </Group>
              </Box>

              <Divider variant="dashed" />

              {/* Personal qualities */}
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={8}>Личные качества</Text>
                <Text size="xs" c="dimmed">Не указаны</Text>
              </Box>
            </Stack>
          </Paper>

          {/* Medical Information */}
          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size={28} radius="xl" variant="light" color="red">
                  <IconMedicalCross size={16} />
                </ThemeIcon>
                <Text fw={700} size="md">Состояние здоровья и медицинские сведения</Text>
              </Group>

              <Divider />

              <MedicalRow label="Общее состояние здоровья" value="не противопоказаний, пригоден/пригодна выполнению профессиональных обязанностей" />
              <Divider variant="dashed" />
              <MedicalRow label="Инвалидность" value="нет" />
              <Divider variant="dashed" />
              <MedicalRow label="Хронические заболевания" value="не указано" />
              <Divider variant="dashed" />
              <MedicalRow label="Аллергические реакции" value="не указано" />
              <Divider variant="dashed" />
              <MedicalRow label="Противопоказания" value="нет" />
              <Divider variant="dashed" />
              <MedicalRow
                label="Медицинская книжка"
                value={personalData?.medicalBookValid ? `действительна до ${personalData.medicalBookValid}` : 'действительна'}
              />
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      <Box c="dimmed">{icon}</Box>
      <Box style={{ flex: 1 }}>
        <Text size="xs" c="dimmed">{label}</Text>
        <Text size="sm">{value}</Text>
      </Box>
    </Group>
  );
}

function MedicalRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="xs" c="dimmed" w={200} style={{ flexShrink: 0 }}>{label}:</Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

/* ============================================================
   CURATORSHIP TAB — Full rewrite matching Figma design
   ============================================================ */
interface StudentWithDetails {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth?: string | null;
  parentLinks?: {
    parent: { firstName: string; lastName: string; phone?: string | null; email?: string | null };
    relation: string;
  }[];
  grades?: { value: number }[];
}

/* Grade scale converters */
type GradeScale = '5' | '12' | '100' | 'AF';
function convertGrade(value: number, scale: GradeScale): string {
  if (scale === '5') return String(Math.round(value));
  if (scale === '12') return String(Math.round((value / 5) * 12));
  if (scale === '100') return String(Math.round((value / 5) * 100));
  // A-F
  if (value >= 4.5) return 'A';
  if (value >= 3.5) return 'B';
  if (value >= 2.5) return 'C';
  if (value >= 1.5) return 'D';
  return 'F';
}

function getGradeColor(value: number): string {
  if (value >= 4.5) return '#2ecc71'; // green
  if (value >= 3.5) return '#3498db'; // blue
  if (value >= 2.5) return '#f39c12'; // orange
  return '#e74c3c'; // red
}

/* Subject grade data from API */
interface SubjectGradeGroup {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  weightedAverage: number;
  grades: {
    id: string;
    value: number;
    weight: number;
    categoryName: string;
    date: string;
    periodName: string;
    teacherName: string;
    status: string;
  }[];
}

/* Mock data for student personal details not yet in API */
const MOCK_STUDENT_DOCS: Record<string, { polis?: string; svidetelstvo?: string; snils?: string; address?: string }> = {};

const CURATOR_SUB_TABS = [
  { value: 'grades', label: 'Оценки' },
  { value: 'student-data', label: 'Данные учеников' },
  { value: 'absent', label: 'Отсутствуют' },
  { value: 'cur-schedule', label: 'Расписание' },
  { value: 'cur-rating', label: 'Рейтинг' },
  { value: 'cur-study-plan', label: 'Учебный план' },
  { value: 'cur-subjects', label: 'Предметы' },
];

const GRADE_SCALE_OPTIONS = [
  { value: '5', label: '5-балльная' },
  { value: '12', label: '12-балльная' },
  { value: '100', label: '100-балльная' },
  { value: 'AF', label: 'A-F' },
];

const PERIOD_OPTIONS = [
  { value: '1', label: '1 триместр' },
  { value: '2', label: '2 триместр' },
  { value: '3', label: '3 триместр' },
];

function CuratorshipTab({ teacher }: { teacher: Record<string, unknown> & {
  curatorOf?: {
    id: string;
    grade: number;
    letter: string;
    level: { name: string };
    students?: StudentWithDetails[];
  }[];
} }) {
  const [curSubTab, setCurSubTab] = useState('grades');
  const [selectedStudentIdx, setSelectedStudentIdx] = useState(0);
  const [gradeScale, setGradeScale] = useState<GradeScale>('5');
  const [selectedPeriod, setSelectedPeriod] = useState('2');
  const [gradeFilter, setGradeFilter] = useState('grades'); // grades | attestation | by-date | by-subject

  if (!teacher.curatorOf || teacher.curatorOf.length === 0) {
    return <EmptySection text="Не назначен куратором" />;
  }

  const cls = teacher.curatorOf[0];
  const students = cls.students || [];
  const selectedStudent = students[selectedStudentIdx] || null;

  return (
    <Stack gap="lg">
      {/* Top: class badge + curator info */}
      <Group gap="md" align="flex-end">
        <Group gap="xs" align="baseline">
          <Title order={1} fw={900} style={{ fontSize: 72, lineHeight: 1 }} c="eruditBlue">
            {cls.grade}
          </Title>
          <Stack gap={0}>
            <Title order={2} fw={800} c="eruditBlue" style={{ fontSize: 36, lineHeight: 1 }}>
              {cls.letter}
            </Title>
            <Text size="xl" fw={700} c="dimmed">класс</Text>
          </Stack>
        </Group>
        <Group ml="auto" gap="sm">
          <Button variant="light" color="blue" size="sm" leftSection={<IconClipboardList size={16} />} onClick={() => window.print()}>
            Распечатать
          </Button>
        </Group>
      </Group>

      {/* Sub-tabs row */}
      <ScrollArea type="auto" offsetScrollbars>
        <Tabs value={curSubTab} onChange={(v) => v && setCurSubTab(v)} color="eruditBlue" variant="pills">
          <Tabs.List>
            {CURATOR_SUB_TABS.map((t) => (
              <Tabs.Tab key={t.value} value={t.value}>{t.label}</Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </ScrollArea>

      {/* ─── Оценки sub-tab ─── */}
      {curSubTab === 'grades' && (
        <CuratorGradesView
          cls={cls}
          students={students}
          selectedStudentIdx={selectedStudentIdx}
          setSelectedStudentIdx={setSelectedStudentIdx}
          selectedStudent={selectedStudent}
          gradeScale={gradeScale}
          setGradeScale={setGradeScale}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          gradeFilter={gradeFilter}
          setGradeFilter={setGradeFilter}
        />
      )}

      {/* ─── Данные учеников sub-tab ─── */}
      {curSubTab === 'student-data' && (
        <CuratorStudentDataView cls={cls} students={students} />
      )}

      {/* ─── Placeholder sub-tabs ─── */}
      {curSubTab === 'absent' && <EmptySection text="Раздел отсутствующих учеников в разработке." />}
      {curSubTab === 'cur-schedule' && <EmptySection text="Расписание класса в разработке." />}
      {curSubTab === 'cur-rating' && <EmptySection text="Рейтинг класса в разработке." />}
      {curSubTab === 'cur-study-plan' && <EmptySection text="Учебный план класса в разработке." />}
      {curSubTab === 'cur-subjects' && <EmptySection text="Предметы класса в разработке." />}
    </Stack>
  );
}

/* ── Grades view (left student card + right grade report) ── */
function CuratorGradesView({
  cls,
  students,
  selectedStudentIdx,
  setSelectedStudentIdx,
  selectedStudent,
  gradeScale,
  setGradeScale,
  selectedPeriod,
  setSelectedPeriod,
  gradeFilter,
  setGradeFilter,
}: {
  cls: { id: string; grade: number; letter: string; level: { name: string } };
  students: StudentWithDetails[];
  selectedStudentIdx: number;
  setSelectedStudentIdx: (idx: number) => void;
  selectedStudent: StudentWithDetails | null;
  gradeScale: GradeScale;
  setGradeScale: (s: GradeScale) => void;
  selectedPeriod: string;
  setSelectedPeriod: (p: string) => void;
  gradeFilter: string;
  setGradeFilter: (f: string) => void;
}) {
  // Fetch periods so we can map trimester number to periodId
  const { data: periodsData } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const res = await fetch('/api/v1/periods');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as { id: string; name: string; type: string }[];
    },
  });

  // Find periodId for selected trimester
  const periodId = useMemo(() => {
    if (!periodsData) return undefined;
    const trimesters = periodsData.filter((p) => p.type === 'trimester');
    // Sort by name to match 1/2/3
    trimesters.sort((a, b) => a.name.localeCompare(b.name));
    const idx = Number(selectedPeriod) - 1;
    return trimesters[idx]?.id;
  }, [periodsData, selectedPeriod]);

  // Fetch individual student grades from API (period-aware)
  const { data: gradesData } = useQuery({
    queryKey: ['student-grades', selectedStudent?.id, periodId],
    queryFn: async () => {
      if (!selectedStudent?.id) return [];
      const url = new URL(`/api/v1/students/${selectedStudent.id}/grades`, window.location.origin);
      if (periodId) url.searchParams.set('periodId', periodId);
      const res = await fetch(url.toString());
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as SubjectGradeGroup[];
    },
    enabled: !!selectedStudent?.id,
  });

  const subjectGrades = gradesData || [];

  // Calculate student rank in class by average grade
  const studentRanks = useMemo(() => {
    const ranked = students.map((s, idx) => {
      const grades = s.grades || [];
      const avg = grades.length > 0
        ? grades.reduce((sum, g) => sum + g.value, 0) / grades.length
        : 0;
      return { idx, avg };
    }).sort((a, b) => b.avg - a.avg);
    const rankMap: Record<number, number> = {};
    ranked.forEach((r, rank) => { rankMap[r.idx] = rank + 1; });
    return rankMap;
  }, [students]);

  const currentRank = studentRanks[selectedStudentIdx] || 0;
  const currentAvg = selectedStudent?.grades?.length
    ? selectedStudent.grades.reduce((sum, g) => sum + g.value, 0) / selectedStudent.grades.length
    : 0;

  // Radar chart data
  const radarData = useMemo(() => {
    return subjectGrades.map((sg) => ({
      subject: sg.subjectName.length > 10 ? sg.subjectName.slice(0, 10) + '...' : sg.subjectName,
      fullSubject: sg.subjectName,
      value: sg.weightedAverage,
      fullMark: 5,
    }));
  }, [subjectGrades]);

  const getRankLevel = (rank: number, total: number) => {
    const pct = rank / Math.max(total, 1);
    if (pct <= 0.2) return { label: 'ВЫСОКАЯ', color: 'green' };
    if (pct <= 0.5) return { label: 'СРЕДНЯЯ', color: 'yellow' };
    return { label: 'НИЗКАЯ', color: 'red' };
  };

  const rankLevel = getRankLevel(currentRank, students.length);

  if (students.length === 0) {
    return <EmptySection text="Нет учеников в классе" />;
  }

  return (
    <Grid gutter="lg">
      {/* ── Left column: Student card ── */}
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            {/* Class badge + counts */}
            <Group gap="xs">
              <Badge size="lg" variant="filled" color="eruditBlue">
                {cls.grade} {cls.letter} класс
              </Badge>
              <Badge size="sm" variant="light" color="blue">
                {students.length} уч.
              </Badge>
              {selectedStudent?.grades && (
                <Badge size="sm" variant="light" color="grape">
                  {selectedStudent.grades.length} оц.
                </Badge>
              )}
            </Group>

            {/* Student selector */}
            <Select
              size="xs"
              value={String(selectedStudentIdx)}
              onChange={(v) => setSelectedStudentIdx(Number(v || 0))}
              data={students.map((s, idx) => ({
                value: String(idx),
                label: `${s.lastName} ${s.firstName} ${s.middleName || ''}`.trim(),
              }))}
              searchable
              placeholder="Выберите ученика"
            />

            <Divider />

            {/* Selected student info */}
            {selectedStudent && (
              <Stack gap="sm">
                <Text fw={700} size="md">
                  {selectedStudent.lastName} {selectedStudent.firstName} {selectedStudent.middleName || ''}
                </Text>

                {selectedStudent.dateOfBirth && (
                  <Group gap="xs">
                    <IconCake size={14} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed">{formatDate(selectedStudent.dateOfBirth)}</Text>
                  </Group>
                )}

                {/* Parents */}
                {selectedStudent.parentLinks && selectedStudent.parentLinks.length > 0 && (
                  <>
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">Законные представители</Text>
                    {selectedStudent.parentLinks.map((pl, i) => (
                      <Box key={i}>
                        <Text size="xs" fw={500}>
                          {pl.parent.lastName} {pl.parent.firstName} ({pl.relation})
                        </Text>
                        {pl.parent.phone && (
                          <Group gap={4}>
                            <IconPhone size={12} color="var(--mantine-color-dimmed)" />
                            <Text size="xs" c="dimmed">{pl.parent.phone}</Text>
                          </Group>
                        )}
                        {pl.parent.email && (
                          <Group gap={4}>
                            <IconMail size={12} color="var(--mantine-color-dimmed)" />
                            <Text size="xs" c="dimmed">{pl.parent.email}</Text>
                          </Group>
                        )}
                      </Box>
                    ))}
                  </>
                )}

                <Divider />

                {/* Documents placeholder */}
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">Документы</Text>
                <Group gap={4}>
                  <IconCertificate size={14} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" c="dimmed">Полис ОМС: ---</Text>
                </Group>
                <Group gap={4}>
                  <IconCertificate size={14} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" c="dimmed">Свидетельство о рождении: ---</Text>
                </Group>
                <Group gap={4}>
                  <IconCertificate size={14} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" c="dimmed">СНИЛС: ---</Text>
                </Group>

                <Divider />

                {/* Achievements */}
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">Достижения и Олимпиады</Text>
                <Group gap="xs">
                  <Badge size="lg" variant="filled" color="yellow" radius="xl" style={{ minWidth: 42, height: 42, fontSize: 16 }}>
                    № {currentRank}
                  </Badge>
                  <Text size="xs" c="dimmed">Рейтинг в классе</Text>
                </Group>
              </Stack>
            )}

            {/* Student navigation list */}
            <Divider />
            <ScrollArea h={200} type="auto" offsetScrollbars>
              <Stack gap={2}>
                {students.map((s, idx) => (
                  <Box
                    key={s.id}
                    onClick={() => setSelectedStudentIdx(idx)}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: idx === selectedStudentIdx
                        ? 'var(--mantine-color-eruditBlue-light)'
                        : 'transparent',
                    }}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" c="dimmed" w={20}>{idx + 1}</Text>
                      <Text
                        size="xs"
                        fw={idx === selectedStudentIdx ? 600 : 400}
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {s.lastName} {s.firstName}
                      </Text>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* ── Right column: Grade report ── */}
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            {/* Report header */}
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text fw={700} size="md">
                  Сводный отчёт за учебный период 2025-2026 г.
                </Text>
                <Group gap="sm">
                  <Badge size="md" variant="light" color={rankLevel.color}>
                    Рейтинг в классе: № {currentRank}
                  </Badge>
                  <Badge size="sm" variant="filled" color={rankLevel.color}>
                    {rankLevel.label}
                  </Badge>
                </Group>
              </Stack>
            </Group>

            {/* Period selector */}
            <Group gap="sm">
              <Text size="sm" fw={500}>Период</Text>
              <SegmentedControl
                size="xs"
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                data={PERIOD_OPTIONS}
              />
            </Group>

            {/* Filter tabs */}
            <Group gap="xs" wrap="wrap">
              {[
                { v: 'grades', l: 'Оценки' },
                { v: 'attestation', l: 'Аттестационный период' },
                { v: 'by-date', l: 'По дате' },
                { v: 'by-subject', l: 'По предмету' },
              ].map((f) => (
                <Button
                  key={f.v}
                  size="xs"
                  variant={gradeFilter === f.v ? 'filled' : 'outline'}
                  color="eruditBlue"
                  onClick={() => setGradeFilter(f.v)}
                  radius="sm"
                >
                  {f.l}
                </Button>
              ))}
            </Group>

            {/* Scale selector */}
            <Group gap="sm">
              <Text size="xs" c="dimmed">Шкала:</Text>
              <SegmentedControl
                size="xs"
                value={gradeScale}
                onChange={(v) => setGradeScale(v as GradeScale)}
                data={GRADE_SCALE_OPTIONS}
              />
            </Group>

            <Divider />

            {/* Subject grade cards grid */}
            {gradeFilter !== 'grades' ? (
              <Paper withBorder radius="md" p="xl" ta="center">
                <Text size="sm" c="dimmed">
                  Фильтр &laquo;{
                    gradeFilter === 'attestation' ? 'Аттестационный период' :
                    gradeFilter === 'by-date' ? 'По дате' :
                    'По предмету'
                  }&raquo; в разработке
                </Text>
              </Paper>
            ) : subjectGrades.length > 0 ? (
              <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                {subjectGrades.map((sg) => {
                  const avg = sg.weightedAverage;
                  const color = getGradeColor(avg);
                  const displayGrade = convertGrade(avg, gradeScale);
                  const isPass = avg > 0 && gradeScale === '5' && Math.round(avg) >= 3;
                  return (
                    <Paper
                      key={sg.subjectId}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <Stack gap={4}>
                        <Text size="xs" fw={500} lineClamp={1}>{sg.subjectName}</Text>
                        <Group justify="space-between" align="flex-end">
                          <Text fw={900} size="xl" style={{ color, lineHeight: 1 }}>
                            {avg > 0 ? displayGrade : '—'}
                          </Text>
                          <Stack gap={0} align="flex-end">
                            <Text size="xs" c="dimmed">
                              {sg.grades.length} оц.
                            </Text>
                            {isPass && (
                              <Badge size="xs" variant="light" color="green">Зачет</Badge>
                            )}
                          </Stack>
                        </Group>
                      </Stack>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Нет данных об оценках ученика
              </Text>
            )}

            {/* Radar chart */}
            {radarData.length > 2 && (
              <>
                <Divider />
                <Text fw={600} size="sm">Распределение оценок по предметам</Text>
                <Box h={320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="var(--mantine-color-dark-4)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 5]}
                        tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      />
                      <Radar
                        name="Средний балл"
                        dataKey="value"
                        stroke="#f5c542"
                        fill="#f5c542"
                        fillOpacity={0.35}
                        strokeWidth={2}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(2)}`, 'Средний балл']}
                        labelFormatter={(label) => {
                          const found = radarData.find(d => d.subject === String(label));
                          return found?.fullSubject || String(label);
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}

/* ── Student data table view ── */
function CuratorStudentDataView({
  cls,
  students,
}: {
  cls: { id: string; grade: number; letter: string; level: { name: string } };
  students: StudentWithDetails[];
}) {
  if (students.length === 0) {
    return <EmptySection text="Нет учеников в классе" />;
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md" gap="sm">
        <Badge size="lg" variant="filled" color="eruditBlue">
          {cls.grade} {cls.letter} класс
        </Badge>
        <Text size="sm" c="dimmed">{students.length} учеников</Text>
      </Group>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={40}>#</Table.Th>
            <Table.Th>ФИО ученика</Table.Th>
            <Table.Th>Дата рождения</Table.Th>
            <Table.Th>Родитель</Table.Th>
            <Table.Th>Телефон родителя</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {students.map((s, idx) => {
            const parentLink = s.parentLinks?.[0];
            return (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Text size="xs" c="dimmed">{idx + 1}</Text>
                </Table.Td>
                <Table.Td>
                  <Text
                    size="sm"
                    component={Link}
                    href={`/students/${s.id}`}
                    style={{ textDecoration: 'none' }}
                    c="var(--mantine-color-text)"
                    fw={500}
                  >
                    {s.lastName} {s.firstName} {s.middleName || ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(s.dateOfBirth)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {parentLink
                      ? `${parentLink.parent.lastName} ${parentLink.parent.firstName} (${parentLink.relation})`
                      : '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {parentLink?.parent.phone || '-'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

/* ============================================================
   SCHEDULE TAB
   ============================================================ */
function ScheduleTab({ scheduleByDay }: { scheduleByDay: Record<number, ScheduleEntryType[]> }) {
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');
  const hasSched = Object.keys(scheduleByDay).length > 0;

  if (!hasSched) {
    return <EmptySection text="Расписание уроков педагога будет отображаться здесь после его формирования." />;
  }

  const days = [1, 2, 3, 4, 5];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={3}>Учебный год 2025-2026 год</Title>
        <Group gap="sm">
          <Button
            variant={viewMode === 'compact' ? 'filled' : 'light'}
            color="blue"
            size="xs"
            onClick={() => setViewMode('compact')}
          >Компактно</Button>
          <Button
            variant={viewMode === 'detailed' ? 'filled' : 'light'}
            color="blue"
            size="xs"
            onClick={() => setViewMode('detailed')}
          >Подробно</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {days.map((dayNum) => {
          const entries = scheduleByDay[dayNum] || [];
          return (
            <Paper key={dayNum} withBorder radius="md" p="md">
              <Group gap="sm" mb="sm">
                <ThemeIcon size={24} radius="xl" variant="light" color="eruditBlue">
                  <IconCalendar size={14} />
                </ThemeIcon>
                <Text fw={700} size="sm">{DAY_NAMES[dayNum - 1]}</Text>
                <Badge size="xs" variant="light" color="blue" ml="auto">
                  {entries.length} {entries.length === 1 ? 'урок' : 'уроков'}
                </Badge>
              </Group>
              <Divider mb="sm" />
              {entries.length > 0 ? (
                <Stack gap={viewMode === 'compact' ? 2 : 6}>
                  {entries.map((entry) => (
                    <Group key={entry.id} gap="sm" wrap="nowrap" py={viewMode === 'compact' ? 1 : 4}>
                      <Box w={viewMode === 'compact' ? 70 : 100} style={{ flexShrink: 0 }}>
                        <Text size="xs" c="dimmed">
                          {viewMode === 'compact' ? entry.slot.startTime : `${entry.slot.startTime}-${entry.slot.endTime}`}
                        </Text>
                      </Box>
                      {viewMode === 'detailed' && (
                        <Text size="xs" fw={500} w={20} ta="center" c="dimmed">
                          {entry.slot.slotNumber}
                        </Text>
                      )}
                      <Badge
                        size={viewMode === 'compact' ? 'xs' : 'sm'}
                        variant="light"
                        color={entry.subject.color || 'blue'}
                        style={{ textTransform: 'none', flex: 1 }}
                      >
                        {entry.subject.name}
                      </Badge>
                      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                        {entry.class.grade}{entry.class.letter}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed" ta="center" py="sm">Нет уроков</Text>
              )}
            </Paper>
          );
        })}

        {/* Выездные мероприятия card */}
        <Paper withBorder radius="md" p="md">
          <Group gap="sm" mb="sm">
            <ThemeIcon size={24} radius="xl" variant="light" color="orange">
              <IconBriefcase size={14} />
            </ThemeIcon>
            <Text fw={700} size="sm">Выездные мероприятия</Text>
          </Group>
          <Divider mb="sm" />
          <Text size="xs" c="dimmed" ta="center" py="sm">
            Нет запланированных выездных мероприятий
          </Text>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

/* ============================================================
   RATING TAB with Recharts BarChart
   ============================================================ */
const RATING_METRICS = [
  { label: 'Дисциплина', score: 14, badge: 'Норма', badgeColor: 'green' },
  { label: 'Предметная', score: 12, badge: 'Норма', badgeColor: 'green' },
  { label: 'Внеучебная', score: 8, badge: 'Медиум', badgeColor: 'yellow' },
  { label: 'Олимпиады', score: 5, badge: 'Медиум', badgeColor: 'yellow' },
  { label: 'Посещаемость', score: 16, badge: 'Норма', badgeColor: 'green' },
  { label: 'Проектная', score: 7, badge: 'Медиум', badgeColor: 'yellow' },
];

const BAR_COLORS = [
  '#2ecc71', '#3498db', '#e74c3c', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#16a085', '#8e44ad', '#c0392b',
  '#27ae60', '#2980b9', '#d35400', '#f1c40f', '#7f8c8d',
];

function RatingTab({ teacher }: { teacher: Record<string, unknown> & {
  curatorOf?: {
    id: string;
    grade: number;
    letter: string;
    students?: StudentWithDetails[];
  }[];
} }) {
  const curatorClass = teacher.curatorOf?.[0];

  // Calculate real grade averages for students
  const studentAverages = useMemo(() => {
    if (!curatorClass?.students) return [];
    return curatorClass.students
      .map((s) => {
        const grades = s.grades || [];
        const avg = grades.length > 0
          ? grades.reduce((sum, g) => sum + g.value, 0) / grades.length
          : 0;
        return {
          name: `${s.lastName} ${s.firstName[0]}.`,
          fullName: `${s.lastName} ${s.firstName}`,
          average: Math.round(avg * 100) / 100,
        };
      })
      .sort((a, b) => b.average - a.average);
  }, [curatorClass]);

  return (
    <Stack gap="lg">
      <Title order={3}>Учебный рейтинг за 2025-2026 год</Title>

      {/* Summary cards */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
        {RATING_METRICS.map((metric) => (
          <Paper key={metric.label} withBorder radius="md" p="sm" ta="center">
            <Text size="xl" fw={900} c="eruditBlue">{metric.score}</Text>
            <Text size="xs" c="dimmed">{metric.label}</Text>
            <Group gap={4} justify="center" mt={4}>
              <Badge size="xs" color={metric.badgeColor}>{metric.badge}</Badge>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Divider />

      {/* Rating bar chart */}
      <Paper withBorder radius="md" p="lg">
        <Text fw={600} size="sm" mb="md">
          Общий рейтинг класса
          {curatorClass ? ` ${curatorClass.grade}${curatorClass.letter}` : ''}
        </Text>
        {studentAverages.length > 0 ? (
          <Box h={Math.max(300, studentAverages.length * 35)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={studentAverages}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tickCount={6} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}`, 'Средний балл']}
                  labelFormatter={(label) => {
                    const found = studentAverages.find(s => s.name === String(label));
                    return found?.fullName || String(label);
                  }}
                />
                <Bar dataKey="average" radius={[0, 4, 4, 0]}>
                  {studentAverages.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Text size="xs" c="dimmed" ta="center" py="xl">
            Нет данных для отображения рейтинга. Педагог не является куратором класса.
          </Text>
        )}
      </Paper>
    </Stack>
  );
}

/* ============================================================
   STUDY PLAN TAB
   ============================================================ */
interface TeacherSubjectEntry {
  id: string;
  subjectId: string;
  classId: string;
  hoursPerWeek: number;
  subject: { id: string; name: string; color?: string | null };
  class?: { id: string; grade: number; letter: string } | null;
}

function StudyPlanTab({ teacher }: { teacher: Record<string, unknown> & {
  subjects?: TeacherSubjectEntry[];
  totalHours?: number;
} }) {
  const subjects = teacher.subjects || [];
  const totalHours = teacher.totalHours || 0;

  if (subjects.length === 0) {
    return <EmptySection text="У педагога нет назначенных предметов." />;
  }

  // Group by subject name for cleaner display
  const grouped = useMemo(() => {
    const map: Record<string, { subject: string; color: string; classes: { grade: number; letter: string; hours: number }[] }> = {};
    for (const ts of subjects) {
      const key = ts.subject.name;
      if (!map[key]) {
        map[key] = { subject: key, color: ts.subject.color || 'blue', classes: [] };
      }
      if (ts.class) {
        map[key].classes.push({
          grade: ts.class.grade,
          letter: ts.class.letter,
          hours: ts.hoursPerWeek,
        });
      }
    }
    // Sort classes within each subject
    for (const key in map) {
      map[key].classes.sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter));
    }
    return Object.values(map);
  }, [subjects]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={3}>Учебный план педагога</Title>
        <Badge size="lg" variant="light" color="eruditBlue">
          Итого: {totalHours} ч/нед
        </Badge>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>#</Table.Th>
              <Table.Th>Предмет</Table.Th>
              <Table.Th>Класс</Table.Th>
              <Table.Th ta="center">Часов в неделю</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {subjects.map((ts, idx) => (
              <Table.Tr key={ts.id}>
                <Table.Td>
                  <Text size="xs" c="dimmed">{idx + 1}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={ts.subject.color || 'blue'} style={{ textTransform: 'none' }}>
                    {ts.subject.name}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {ts.class ? `${ts.class.grade}${ts.class.letter}` : '-'}
                  </Text>
                </Table.Td>
                <Table.Td ta="center">
                  <Text size="sm" fw={600}>{ts.hoursPerWeek}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

/* ============================================================
   SUBSTITUTION HISTORY MODAL
   ============================================================ */
interface SubstitutionRecord {
  id: string;
  date: string;
  slot?: { slotNumber: number; startTime: string };
  class?: { grade: number; letter: string };
  subject?: { name: string };
  originalTeacher?: { firstName: string; lastName: string };
  substitute?: { firstName: string; lastName: string };
  reason?: string | null;
}

function SubstitutionHistoryModal({ teacherId }: { teacherId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['substitution-history', teacherId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/substitutions?teacherId=${teacherId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as SubstitutionRecord[];
    },
  });

  if (isLoading) {
    return (
      <Box ta="center" py="xl">
        <Loader color="eruditBlue" size="sm" />
      </Box>
    );
  }

  const records = data || [];

  if (records.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        Нет записей о заменах для данного педагога
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Дата</Table.Th>
          <Table.Th>Урок</Table.Th>
          <Table.Th>Класс</Table.Th>
          <Table.Th>Предмет</Table.Th>
          <Table.Th>Кого заменял / Кто заменял</Table.Th>
          <Table.Th>Причина</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {records.map((r) => (
          <Table.Tr key={r.id}>
            <Table.Td>
              <Text size="xs">{formatDate(r.date)}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{r.slot ? `${r.slot.slotNumber} (${r.slot.startTime})` : '-'}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{r.class ? `${r.class.grade}${r.class.letter}` : '-'}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{r.subject?.name || '-'}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs">
                {r.originalTeacher
                  ? `${r.originalTeacher.lastName} ${r.originalTeacher.firstName}`
                  : r.substitute
                    ? `${r.substitute.lastName} ${r.substitute.firstName}`
                    : '-'}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{r.reason || '-'}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

/* ============================================================
   CHARACTERISTICS TAB
   ============================================================ */
function CharacteristicsTab({ teacher, experience, uniqueSubjects }: {
  teacher: Record<string, unknown> & {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    position?: string | null;
    curatorOf?: { grade: number; letter: string }[];
    scheduleEntries?: unknown[];
    totalHours?: number;
    subjects?: TeacherSubjectEntry[];
  };
  experience: number | null;
  uniqueSubjects: { id: string; name: string }[];
}) {
  const classCount = teacher.curatorOf?.length || 0;
  const scheduleCount = (teacher.scheduleEntries as unknown[])?.length || 0;
  const subjectCount = uniqueSubjects.length;
  const totalHours = teacher.totalHours || 0;

  return (
    <Stack gap="lg">
      <Paper withBorder radius="md" p="xl">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size={32} radius="xl" variant="light" color="eruditBlue">
              <IconClipboardList size={18} />
            </ThemeIcon>
            <Text fw={700} size="lg">Характеристика педагога</Text>
          </Group>

          <Divider />

          <Text size="sm" c="dimmed">
            Характеристика педагога формируется на основе данных системы.
          </Text>

          <Paper bg="var(--mantine-color-dark-6)" radius="md" p="lg">
            <Stack gap="sm">
              <Text size="sm">
                <Text span fw={600}>{getFullName(teacher)}</Text> -- {teacher.position || 'педагог'}.
                {experience !== null && ` Стаж работы в школе: ${getYearsLabel(experience)}.`}
              </Text>
              <Text size="sm">
                Ведет {subjectCount} {subjectCount === 1 ? 'предмет' : 'предметов'}: {uniqueSubjects.map(s => s.name).join(', ')}.
              </Text>
              <Text size="sm">
                Общая нагрузка: {totalHours} часов в неделю, {scheduleCount} уроков в расписании.
              </Text>
              {classCount > 0 && (
                <Text size="sm">
                  Является куратором {teacher.curatorOf!.map(c => `${c.grade}${c.letter}`).join(', ')} класса.
                </Text>
              )}
            </Stack>
          </Paper>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Paper withBorder radius="md" p="md" ta="center">
              <Text size="xl" fw={900} c="eruditBlue">{subjectCount}</Text>
              <Text size="xs" c="dimmed">Предметов</Text>
            </Paper>
            <Paper withBorder radius="md" p="md" ta="center">
              <Text size="xl" fw={900} c="eruditBlue">{totalHours}</Text>
              <Text size="xs" c="dimmed">Часов/нед</Text>
            </Paper>
            <Paper withBorder radius="md" p="md" ta="center">
              <Text size="xl" fw={900} c="eruditBlue">{scheduleCount}</Text>
              <Text size="xs" c="dimmed">Уроков</Text>
            </Paper>
            <Paper withBorder radius="md" p="md" ta="center">
              <Text size="xl" fw={900} c="eruditBlue">{classCount}</Text>
              <Text size="xs" c="dimmed">Кураторство</Text>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  );
}
