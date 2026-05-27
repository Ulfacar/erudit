'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import 'dayjs/locale/ru';
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconReplace,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toIsoDate, formatDateLong } from '@/shared/lib/format-date';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Types ── */
interface TeacherShort {
  role?: string
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position?: string | null;
  photo?: string | null;
  reason?: string | null;
  subjects?: { id: string; name: string; color?: string | null }[];
}

interface SlotInfo {
  id: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  type?: string;
}

interface ClassInfo {
  id: string;
  grade: number;
  letter: string;
  level?: { id: string; name: string } | null;
}

interface SubjectInfo {
  id: string;
  name: string;
  color?: string | null;
}

interface SubstitutionData {
  id: string;
  date: string;
  originalTeacherId: string;
  substituteTeacherId: string;
  classId: string;
  subjectId: string;
  slotId: string;
  reason?: string | null;
  createdAt: string;
  originalTeacher?: TeacherShort | null;
  substitute?: TeacherShort & { user?: { email?: string | null } };
  class?: ClassInfo | null;
  subject?: SubjectInfo | null;
  slot?: SlotInfo | null;
}

interface ScheduleEntryData {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  slotId: string;
  dayOfWeek: number;
  class?: ClassInfo;
  teacher?: TeacherShort;
  subject?: SubjectInfo;
  slot?: SlotInfo;
}

interface TeacherSubjectAssignment {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  teacher: { id: string; firstName: string; lastName: string; middleName?: string | null };
  subject: { id: string; name: string; color?: string | null };
}

interface StatsData {
  teacherSubjectCount: number;
  scheduleEntryCount: number;
  substitutionCount: number;
  teacherCount: number;
}

/* ── Helpers ── */
function getFullName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  return [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ');
}

function getShortName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  const first = t.firstName ? t.firstName[0] + '.' : '';
  const middle = t.middleName ? t.middleName[0] + '.' : '';
  return `${t.lastName} ${first}${middle}`;
}

function getInitials(t: { firstName: string; lastName: string }) {
  return `${t.lastName[0] || ''}${t.firstName[0] || ''}`.toUpperCase();
}

function formatDate(d: Date): string {
  return toIsoDate(d);
}

function formatDateRu(d: Date): string {
  return formatDateLong(d);
}

function getDayName(d: Date): string {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return days[d.getDay()];
}

const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function gradeInLevel(grade: number, level: string): boolean {
  if (!level) return true;
  if (level === 'primary') return grade >= 1 && grade <= 4;
  if (level === 'middle') return grade >= 5 && grade <= 9;
  if (level === 'senior') return grade >= 10 && grade <= 12;
  return true;
}

/* ── Stat Card ── */
function StatCard({
  title,
  count,
  accentColor,
  icon: Icon,
  onClick,
}: {
  title: string;
  count: number;
  accentColor: string;
  icon: React.ComponentType<{ size?: number; stroke?: number }>;
  onClick?: () => void;
}) {
  return (
    <Paper
      shadow="xs"
      radius="md"
      withBorder
      style={{ overflow: 'hidden', cursor: onClick ? 'pointer' : undefined, transition: 'box-shadow 0.15s' }}
      onClick={onClick}
    >
      <Box style={{ height: 3, background: accentColor }} />
      <Box p="sm">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>
              {title}
            </Text>
            <Text fw={700} size="lg">
              {count}
            </Text>
          </Box>
          <ActionIcon variant="subtle" color="gray" size="lg">
            <Icon size={20} stroke={1.5} />
          </ActionIcon>
        </Group>
      </Box>
    </Paper>
  );
}

/* ── Panel Card ── */
function PanelCard({
  title,
  count,
  accentColor,
  children,
}: {
  title: string;
  count: number;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <Paper shadow="xs" radius="md" withBorder style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Box p="sm" style={{ borderBottom: `1px solid #e6e9ee` }}>
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            {title}
          </Text>
          <Badge size="sm" radius="sm" variant="light" color={accentColor}>
            {count}
          </Badge>
        </Group>
      </Box>
      <ScrollArea style={{ flex: 1, maxHeight: 280 }} p="xs">
        {children}
      </ScrollArea>
    </Paper>
  );
}

/* ── Teacher Row ── */
function TeacherRow({
  teacher,
  subtitle,
  action,
}: {
  teacher: TeacherShort;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" p={6} style={{ borderRadius: 4 }}>
      <Group gap={8}>
        <Avatar size={32} radius="xl" color="blue" variant="filled" src={teacher.photo}>
          {getInitials(teacher)}
        </Avatar>
        <Box>
          <Text size="sm" fw={500} lh={1.3}>
            {getShortName(teacher)}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed" lh={1.2}>
              {subtitle}
            </Text>
          )}
        </Box>
      </Group>
      {action}
    </Group>
  );
}

/* ── Main Page ── */
function SubstitutionsContent() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showAllDates, setShowAllDates] = useState(false);
  const [selectedDayCol, setSelectedDayCol] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('subs');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState(0);
  // calendar removed — use day header clicks instead
  const [suggestModal, setSuggestModal] = useState<{
    open: boolean;
    date?: string;
    slotId?: string;
    classId?: string;
    subjectId?: string;
    originalTeacherId?: string;
    className?: string;
    subjectName?: string;
    slotNumber?: number;
  }>({ open: false });
  const [selectedSubstitute, setSelectedSubstitute] = useState<string>('');
  const [absenceReason, setAbsenceReason] = useState('');

  // Manual creation mode state (when opened from "Создать замену" button)
  const [manualDate, setManualDate] = useState<string>(() => formatDate(new Date()));
  const [manualClassId, setManualClassId] = useState<string>('');
  const [manualSubjectId, setManualSubjectId] = useState<string>('');
  const [manualSlotId, setManualSlotId] = useState<string>('');
  const [manualOriginalTeacherId, setManualOriginalTeacherId] = useState<string>('');

  const isManualMode = suggestModal.open && !suggestModal.classId;

  const dateStr = formatDate(selectedDate);
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

  // ── Queries ──

  const { data: statsRes } = useQuery<{ success: boolean; data: StatsData }>({
    queryKey: ['substitution-stats'],
    queryFn: async () => {
      const res = await fetch('/api/v1/substitutions/stats');
      if (!res.ok) return { success: true, data: { teacherSubjectCount: 0, scheduleEntryCount: 0, substitutionCount: 0, teacherCount: 0 } };
      return res.json();
    },
    retry: false,
  });

  const { data: substitutionsRes, isLoading: subsLoading } = useQuery<{
    success: boolean;
    data: SubstitutionData[];
  }>({
    queryKey: ['substitutions', showAllDates ? 'all' : dateStr],
    queryFn: async () => {
      const url = showAllDates
        ? '/api/v1/substitutions'
        : `/api/v1/substitutions?date=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const { data: absentRes, isLoading: absentLoading } = useQuery<{
    success: boolean;
    data: TeacherShort[];
  }>({
    queryKey: ['absent-teachers', dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/v1/substitutions/absent?date=${dateStr}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const { data: scheduleRes } = useQuery<{
    success: boolean;
    data: ScheduleEntryData[];
  }>({
    queryKey: ['schedule-entries', dayOfWeek],
    queryFn: async () => {
      const res = await fetch(`/api/v1/substitutions/schedule?day=${dayOfWeek}`);
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    retry: false,
  });

  // Weekly schedule entries (all days, all classes) for the grid
  const { data: weeklyScheduleRes } = useQuery<{
    success: boolean;
    data: ScheduleEntryData[];
  }>({
    queryKey: ['weekly-schedule'],
    queryFn: async () => {
      const res = await fetch('/api/v1/schedule/weekly');
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    retry: false,
  });

  const { data: bellRes } = useQuery<{ success: boolean; data: SlotInfo[] }>({
    queryKey: ['bell-schedule'],
    queryFn: async () => {
      const res = await fetch('/api/v1/schedule/bells');
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    retry: false,
  });

  const effectiveSlotId = isManualMode ? manualSlotId : suggestModal.slotId;
  const effectiveDate = isManualMode ? manualDate : (suggestModal.date || dateStr);

  const { data: availableRes, isLoading: availableLoading } = useQuery<{
    success: boolean;
    data: TeacherShort[];
  }>({
    queryKey: ['available-teachers', effectiveDate, effectiveSlotId],
    queryFn: async () => {
      const slotId = effectiveSlotId || (bellRes?.data || [])[0]?.id || '';
      if (!slotId) return { success: true, data: [] };
      const res = await fetch(
        `/api/v1/substitutions/available?date=${effectiveDate}&slotId=${slotId}`
      );
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    retry: false,
  });

  const { data: teachersRes } = useQuery<{
    success: boolean;
    data: TeacherShort[];
  }>({
    queryKey: ['all-teachers'],
    queryFn: async () => {
      const res = await fetch('/api/v1/teachers');
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    retry: false,
  });

  // Classes list for manual mode
  const { data: classesRes } = useQuery<{
    success: boolean;
    data: ClassInfo[];
  }>({
    queryKey: ['all-classes'],
    queryFn: async () => {
      const res = await fetch('/api/v1/classes');
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    enabled: isManualMode,
    retry: false,
  });

  // Teacher-subject assignments for selected class (manual mode)
  const { data: teacherSubjectsRes } = useQuery<{
    success: boolean;
    data: TeacherSubjectAssignment[];
  }>({
    queryKey: ['teacher-subjects', manualClassId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/schedule/teacher-subjects?classId=${manualClassId}`);
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    enabled: isManualMode && !!manualClassId,
    retry: false,
  });

  // ── Mutations ──

  const createSubMutation = useMutation({
    mutationFn: async (body: {
      date: string;
      originalTeacherId: string;
      substituteTeacherId: string;
      classId: string;
      subjectId: string;
      slotId: string;
      reason?: string;
    }) => {
      const res = await fetch('/api/v1/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Ошибка создания замены');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      queryClient.invalidateQueries({ queryKey: ['absent-teachers'] });
      queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
      queryClient.invalidateQueries({ queryKey: ['substitution-stats'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-substitutions'] });
      setSuggestModal({ open: false });
      setSelectedSubstitute('');
      setAbsenceReason('');
      setManualDate(formatDate(new Date()));
      setManualClassId('');
      setManualSubjectId('');
      setManualSlotId('');
      setManualOriginalTeacherId('');
    },
  });

  const deleteSubMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/substitutions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка удаления');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      queryClient.invalidateQueries({ queryKey: ['absent-teachers'] });
      queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
      queryClient.invalidateQueries({ queryKey: ['substitution-stats'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-substitutions'] });
    },
  });

  // ── Derived data ──

  const stats = statsRes?.data;
  const substitutions = substitutionsRes?.data || [];
  const absentTeachers = absentRes?.data || [];
  const availableTeachers = availableRes?.data || [];
  const allTeachers = teachersRes?.data || [];

  // По ТЗ: "Члены администрации отображаются в категории Администрация" —
  // независимо от того, заняты они уроками или нет.
  const ADMIN_ROLES = new Set(['super_admin', 'analyst', 'zavuch', 'director']);
  const administrationTeachers = useMemo(
    () => allTeachers.filter((t) => t.role && ADMIN_ROLES.has(t.role)),
    [allTeachers],
  );
  // Free teachers excluding admins (admins shown in their own panel)
  const freeNonAdminTeachers = useMemo(
    () => availableTeachers.filter((t) => !t.role || !ADMIN_ROLES.has(t.role)),
    [availableTeachers],
  );
  const bellSlots = useMemo(
    () => (bellRes?.data || []).sort((a: SlotInfo, b: SlotInfo) => a.slotNumber - b.slotNumber),
    [bellRes]
  );
  const lessonSlots = useMemo(
    () => bellSlots.filter((s) => s.type === 'lesson' || !s.type),
    [bellSlots]
  );
  const allClasses = classesRes?.data || [];
  const teacherSubjects = teacherSubjectsRes?.data || [];

  // Unique subjects for the selected class
  const subjectsForClass = useMemo(() => {
    const seen = new Set<string>();
    return teacherSubjects
      .filter((ts) => {
        if (seen.has(ts.subjectId)) return false;
        seen.add(ts.subjectId);
        return true;
      })
      .map((ts) => ts.subject);
  }, [teacherSubjects]);

  // Auto-fill original teacher when subject is selected
  useEffect(() => {
    if (!isManualMode || !manualSubjectId || !manualClassId) return;
    const match = teacherSubjects.find((ts) => ts.subjectId === manualSubjectId && ts.classId === manualClassId);
    if (match) {
      setManualOriginalTeacherId(match.teacherId);
    } else {
      setManualOriginalTeacherId('');
    }
  }, [isManualMode, manualSubjectId, manualClassId, teacherSubjects]);

  // Reset dependent fields when class changes
  useEffect(() => {
    if (!isManualMode) return;
    setManualSubjectId('');
    setManualSlotId('');
    setManualOriginalTeacherId('');
  }, [manualClassId, isManualMode]);

  // Filter substitutions by level
  const filteredSubstitutions = useMemo(() => {
    if (!levelFilter) return substitutions;
    return substitutions.filter((s) => {
      const grade = s.class?.grade;
      if (!grade) return true;
      return gradeInLevel(grade, levelFilter);
    });
  }, [substitutions, levelFilter]);

  // Active teachers = teachers who have schedule entries today and are NOT absent
  const absentTeacherIds = new Set(absentTeachers.map((t) => t.id));
  const activeTeachersToday = useMemo(() => {
    const scheduleEntries = scheduleRes?.data || [];
    const teachingIds = new Set(scheduleEntries.map((se) => se.teacherId));
    return allTeachers.filter(
      (t) => teachingIds.has(t.id) && !absentTeacherIds.has(t.id)
    );
  }, [scheduleRes, allTeachers, absentTeacherIds]);

  // Classes without teacher
  const classesWithoutTeacher = useMemo(() => {
    const coveredKeys = new Set(
      substitutions.map((s) => `${s.originalTeacherId}-${s.slotId}-${s.classId}`)
    );
    const scheduleEntries = scheduleRes?.data || [];
    return scheduleEntries
      .filter((se) => {
        if (!absentTeacherIds.has(se.teacherId)) return false;
        const key = `${se.teacherId}-${se.slotId}-${se.classId}`;
        return !coveredKeys.has(key);
      })
      .map((se) => ({
        classId: se.classId,
        className: se.class ? `${se.class.grade}${se.class.letter}` : se.classId,
        subjectId: se.subjectId,
        subjectName: se.subject?.name || '',
        slotId: se.slotId,
        slotNumber: se.slot?.slotNumber || 0,
        teacherId: se.teacherId,
        teacherName: se.teacher ? getShortName(se.teacher) : '',
        level: se.class?.level,
      }));
  }, [substitutions, scheduleRes, absentTeacherIds]);

  // ── Date navigation ──

  const prevDay = useCallback(() => {
    setShowAllDates(false);
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
  }, []);

  const nextDay = useCallback(() => {
    setShowAllDates(false);
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
  }, []);

  const goToday = useCallback(() => {
    setShowAllDates(false);
    setSelectedDate(new Date());
  }, []);

  // ── Week days for schedule grid (driven by weekOffset) ──

  const gridWeekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const gridWeekEnd = useMemo(() => {
    const d = new Date(gridWeekStart);
    d.setDate(d.getDate() + 5); // Saturday
    return d;
  }, [gridWeekStart]);

  const gridWeekDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(gridWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [gridWeekStart]);

  // Legacy weekStart/weekDays kept for any other usage
  const weekStart = gridWeekStart;
  const weekDays = gridWeekDays;

  // Weekly substitutions for the grid (covers Mon-Sat of the displayed week)
  const gridWeekStartStr = formatDate(gridWeekStart);
  const gridWeekEndStr = formatDate(gridWeekEnd);
  const { data: weeklySubsRes } = useQuery<{
    success: boolean;
    data: SubstitutionData[];
  }>({
    queryKey: ['weekly-substitutions', gridWeekStartStr, gridWeekEndStr],
    queryFn: async () => {
      const days = gridWeekDays.map((d) => formatDate(d));
      const results = await Promise.all(
        days.map((day) =>
          fetch(`/api/v1/substitutions?date=${day}`).then((r) => (r.ok ? r.json() : { data: [] }))
        )
      );
      const allSubs: SubstitutionData[] = [];
      for (const r of results) {
        if (r.data) allSubs.push(...r.data);
      }
      return { success: true, data: allSubs };
    },
    retry: false,
  });
  const weeklySubstitutions = weeklySubsRes?.data || [];

  // Build schedule grid: slot x day — uses weekly data
  const scheduleGrid = useMemo(() => {
    const entries = weeklyScheduleRes?.data || scheduleRes?.data || [];
    const grid: Record<string, Record<number, ScheduleEntryData[]>> = {};

    for (const slot of bellSlots) {
      grid[slot.id] = {};
      for (let day = 1; day <= 6; day++) {
        grid[slot.id][day] = entries.filter(
          (e) => e.slotId === slot.id && e.dayOfWeek === day
        );
      }
    }
    return grid;
  }, [weeklyScheduleRes, scheduleRes, bellSlots]);

  // Substitution lookup by slotId+dayOfWeek (for the selected date - existing table)
  const substitutionMap = useMemo(() => {
    const map = new Map<string, SubstitutionData>();
    for (const sub of substitutions) {
      const subDate = new Date(sub.date);
      const subDay = subDate.getDay() === 0 ? 7 : subDate.getDay();
      map.set(`${sub.slotId}-${subDay}-${sub.classId}`, sub);
    }
    return map;
  }, [substitutions]);

  // Weekly substitution lookup by slotId+dateStr+classId (for the grid)
  const weeklySubMap = useMemo(() => {
    const map = new Map<string, SubstitutionData>();
    for (const sub of weeklySubstitutions) {
      const subDate = new Date(sub.date);
      const key = `${sub.slotId}-${formatDate(subDate)}-${sub.classId}`;
      map.set(key, sub);
    }
    return map;
  }, [weeklySubstitutions]);

  // Level filter function for schedule grid
  const filterByLevel = useCallback(
    (grade: number) => gradeInLevel(grade, levelFilter),
    [levelFilter]
  );

  // ── Handlers ──

  const handleAssignSubstitution = useCallback(() => {
    if (isManualMode) {
      if (!selectedSubstitute || !manualClassId || !manualSubjectId || !manualSlotId || !manualOriginalTeacherId) return;
      createSubMutation.mutate({
        date: manualDate,
        originalTeacherId: manualOriginalTeacherId,
        substituteTeacherId: selectedSubstitute,
        classId: manualClassId,
        subjectId: manualSubjectId,
        slotId: manualSlotId,
        reason: absenceReason || undefined,
      });
    } else {
      if (!selectedSubstitute || !suggestModal.slotId || !suggestModal.classId || !suggestModal.subjectId || !suggestModal.originalTeacherId) return;
      createSubMutation.mutate({
        date: suggestModal.date || dateStr,
        originalTeacherId: suggestModal.originalTeacherId,
        substituteTeacherId: selectedSubstitute,
        classId: suggestModal.classId,
        subjectId: suggestModal.subjectId,
        slotId: suggestModal.slotId,
        reason: absenceReason || undefined,
      });
    }
  }, [isManualMode, selectedSubstitute, suggestModal, dateStr, absenceReason, createSubMutation, manualDate, manualClassId, manualSubjectId, manualSlotId, manualOriginalTeacherId]);

  const isLoading = subsLoading || absentLoading;

  // ── Determine which sections to show based on active tab ──
  const showAbsentPanel = activeTab === 'today' || activeTab === 'absent';
  const showFreePanel = activeTab === 'today' || activeTab === 'free';
  const showActivePanel = activeTab === 'active';
  const showSubsTable = activeTab === 'today' || activeTab === 'subs';
  const showScheduleGrid = true; // always show the weekly grid

  return (
    <Stack gap="md">
      {/* Breadcrumb */}
      <Group gap={4}>
        <Text size="xs" c="dimmed">Главная</Text>
        <Text size="xs" c="dimmed">/</Text>
        <Text size="xs" c="pink">Замены</Text>
      </Group>

      {/* Title + Create button */}
      <Group justify="space-between">
        <Text fw={700} size="xl">
          Управление заменами
        </Text>
        <Button
          color="blue"
          leftSection={<IconReplace size={16} />}
          onClick={() => setSuggestModal({
            open: true,
            slotId: '',
            classId: '',
            subjectId: '',
            originalTeacherId: '',
            className: '',
            subjectName: '',
            slotNumber: 0,
          })}
        >
          Создать замену
        </Button>
      </Group>

      {/* Stat cards */}
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 4 }} spacing="md">
        <StatCard
          title="Нагрузка"
          count={stats?.teacherSubjectCount ?? 0}
          accentColor="var(--mantine-color-blue-6)"
          icon={IconClipboardList}
          onClick={() => setActiveTab('today')}
        />
        <StatCard
          title="Расписание"
          count={stats?.scheduleEntryCount ?? 0}
          accentColor="var(--mantine-color-green-6)"
          icon={IconCalendar}
          onClick={() => setActiveTab('today')}
        />
        <StatCard
          title="Замены"
          count={stats?.substitutionCount ?? 0}
          accentColor="var(--mantine-color-pink-6)"
          icon={IconReplace}
          onClick={() => setActiveTab('subs')}
        />
        <StatCard
          title="Список педагогов"
          count={stats?.teacherCount ?? 0}
          accentColor="var(--mantine-color-yellow-6)"
          icon={IconUsers}
          onClick={() => setActiveTab('active')}
        />
      </SimpleGrid>

      {/* Filter tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} color="blue">
        <Tabs.List>
          <Tabs.Tab value="today">
            Сегодня
          </Tabs.Tab>
          <Tabs.Tab value="absent">
            Отсутствующие педагоги
          </Tabs.Tab>
          <Tabs.Tab value="free">
            Свободные педагоги
          </Tabs.Tab>
          <Tabs.Tab value="active">
            Активные педагоги
          </Tabs.Tab>
          <Tabs.Tab value="subs">
            Замены
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Info bar + date controls */}
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap={8}>
          <IconAlertCircle size={16} color="var(--mantine-color-yellow-6)" />
          <Text size="xs" c="dimmed">
            {showAllDates
              ? 'Показаны замены за все даты'
              : `Замены на ${formatDateRu(selectedDate)}`}
          </Text>
        </Group>

        <Group gap={8} wrap="wrap">
          {/* Level filter */}
          <Group gap={4}>
            {[
              { label: 'Все', value: '' },
              { label: 'Начальные', value: 'primary' },
              { label: 'Средние', value: 'middle' },
              { label: 'Старшие', value: 'senior' },
            ].map((opt) => (
              <Button
                key={opt.value}
                size="xs"
                variant={levelFilter === opt.value ? 'filled' : 'light'}
                color="blue"
                onClick={() => setLevelFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </Group>

          <Divider orientation="vertical" />

          {/* Date picker */}
          <Group gap={4}>
            <Button
              variant={showAllDates ? 'filled' : 'light'}
              color="blue"
              size="xs"
              onClick={() => setShowAllDates(true)}
            >
              Все даты
            </Button>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={prevDay}>
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Button variant="subtle" color="gray" size="xs" onClick={goToday}>
              <Text size="xs" fw={showAllDates ? 400 : 600}>
                {formatDateRu(selectedDate)}, {getDayName(selectedDate)}
              </Text>
            </Button>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={nextDay}>
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Group>

      {/* Loading state */}
      {isLoading ? (
        <Box style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader color="blue" />
        </Box>
      ) : (
        <>
          {/* Absent + Classes without teacher + Free teachers panels */}
          {(showAbsentPanel || showFreePanel) && (
            <Group align="stretch" gap="md" style={{ flexWrap: 'nowrap' }} grow>
              {showAbsentPanel && (
                <PanelCard title="Отсутствуют сегодня" count={absentTeachers.length} accentColor="red">
                  {absentTeachers.length === 0 ? (
                    <Text size="xs" c="dimmed" p="sm" ta="center">
                      Нет отсутствующих педагогов
                    </Text>
                  ) : (
                    <Stack gap={2}>
                      {absentTeachers.map((t) => (
                        <TeacherRow
                          key={t.id}
                          teacher={t}
                          subtitle={t.reason || 'Причина не указана'}
                          action={
                            <Badge size="xs" variant="light" color="red" radius="sm">
                              Отсутствует
                            </Badge>
                          }
                        />
                      ))}
                    </Stack>
                  )}
                </PanelCard>
              )}

              {showAbsentPanel && (
                <PanelCard
                  title="Классы без педагога"
                  count={classesWithoutTeacher.length}
                  accentColor="yellow"
                >
                  {classesWithoutTeacher.length === 0 ? (
                    <Text size="xs" c="dimmed" p="sm" ta="center">
                      Все классы обеспечены педагогами
                    </Text>
                  ) : (
                    <Stack gap={2}>
                      {classesWithoutTeacher.map((entry, idx) => (
                        <Group
                          key={`${entry.classId}-${entry.slotId}-${idx}`}
                          justify="space-between"
                          p={6}
                          style={{ borderRadius: 4 }}
                        >
                          <Box>
                            <Group gap={6}>
                              <Badge size="xs" variant="filled" color="blue" radius="sm">
                                {entry.className}
                              </Badge>
                              <Text size="xs">
                                {entry.subjectName}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed" mt={2}>
                              Урок {entry.slotNumber} | {entry.teacherName}
                            </Text>
                          </Box>
                          <Button
                            size="xs"
                            variant="light"
                            color="pink"
                            onClick={() =>
                              setSuggestModal({
                                open: true,
                                slotId: entry.slotId,
                                classId: entry.classId,
                                subjectId: entry.subjectId,
                                originalTeacherId: entry.teacherId,
                                className: entry.className,
                                subjectName: entry.subjectName,
                                slotNumber: entry.slotNumber,
                              })
                            }
                          >
                            Предложить замену
                          </Button>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </PanelCard>
              )}

              {showFreePanel && (
                <PanelCard
                  title="Свободные педагоги"
                  count={freeNonAdminTeachers.length}
                  accentColor="green"
                >
                  {availableLoading ? (
                    <Box style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                      <Loader size="sm" color="blue" />
                    </Box>
                  ) : freeNonAdminTeachers.length === 0 ? (
                    <Text size="xs" c="dimmed" p="sm" ta="center">
                      Нет свободных педагогов
                    </Text>
                  ) : (
                    <Stack gap={2}>
                      {freeNonAdminTeachers.map((t) => (
                        <TeacherRow
                          key={t.id}
                          teacher={t}
                          subtitle={t.subjects?.map((s) => s.name).join(', ') || t.position || ''}
                          action={
                            <Badge size="xs" variant="light" color="green" radius="sm">
                              Свободен
                            </Badge>
                          }
                        />
                      ))}
                    </Stack>
                  )}
                </PanelCard>
              )}

              {showFreePanel && administrationTeachers.length > 0 && (
                <PanelCard
                  title="Администрация"
                  count={administrationTeachers.length}
                  accentColor="violet"
                >
                  <Stack gap={2}>
                    {administrationTeachers.map((t) => (
                      <TeacherRow
                        key={t.id}
                        teacher={t}
                        subtitle={t.position || t.role || ''}
                        action={
                          <Badge size="xs" variant="light" color="violet" radius="sm">
                            Админ
                          </Badge>
                        }
                      />
                    ))}
                  </Stack>
                </PanelCard>
              )}
            </Group>
          )}

          {/* Active teachers panel */}
          {showActivePanel && (
            <PanelCard
              title="Активные педагоги сегодня"
              count={activeTeachersToday.length}
              accentColor="blue"
            >
              {activeTeachersToday.length === 0 ? (
                <Text size="xs" c="dimmed" p="sm" ta="center">
                  Нет активных педагогов на этот день
                </Text>
              ) : (
                <Stack gap={2}>
                  {activeTeachersToday.map((t) => (
                    <TeacherRow
                      key={t.id}
                      teacher={t}
                      subtitle={t.subjects?.map((s) => s.name).join(', ') || t.position || ''}
                      action={
                        <Badge size="xs" variant="light" color="blue" radius="sm">
                          На уроке
                        </Badge>
                      }
                    />
                  ))}
                </Stack>
              )}
            </PanelCard>
          )}

          {/* Substitutions table */}
          {showSubsTable && (
            <Paper shadow="xs" radius="md" withBorder>
              <Box p="sm" style={{ borderBottom: `1px solid #e6e9ee` }}>
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {showAllDates ? 'Все замены' : `Активные замены на ${formatDateRu(selectedDate)}`}
                  </Text>
                  <Badge size="sm" variant="light" color="pink">
                    {filteredSubstitutions.length}
                  </Badge>
                </Group>
              </Box>
              {filteredSubstitutions.length === 0 ? (
                <Text size="sm" c="dimmed" p="xl" ta="center">
                  Нет замен{showAllDates ? '' : ` на ${formatDateRu(selectedDate)}`}
                </Text>
              ) : (
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th ta="center">Урок</Table.Th>
                      <Table.Th>Класс</Table.Th>
                      <Table.Th>Предмет</Table.Th>
                      <Table.Th>Отсутствует</Table.Th>
                      <Table.Th>Заменяет</Table.Th>
                      <Table.Th>Причина</Table.Th>
                      <Table.Th ta="center">Действия</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredSubstitutions.map((sub) => (
                      <Table.Tr key={sub.id}>
                        <Table.Td ta="center">
                          <Text size="xs">
                            {sub.slot ? `${sub.slot.slotNumber}` : '-'}
                          </Text>
                          {sub.slot && (
                            <Text size="xs" c="dimmed">
                              {sub.slot.startTime}-{sub.slot.endTime}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="filled" color="blue" radius="sm">
                            {sub.class ? `${sub.class.grade}${sub.class.letter}` : sub.classId}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">
                            {sub.subject?.name || sub.subjectId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="red">
                            {sub.originalTeacher
                              ? getShortName(sub.originalTeacher)
                              : sub.originalTeacherId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="pink" fw={600}>
                            {sub.substitute
                              ? getShortName(sub.substitute)
                              : sub.substituteTeacherId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {sub.reason || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => deleteSubMutation.mutate(sub.id)}
                            loading={deleteSubMutation.isPending}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          )}

          {/* Weekly schedule grid with substitution overlays */}
          {showScheduleGrid && bellSlots.length > 0 && (
            <Paper shadow="xs" radius="md" withBorder>
              <Box p="sm" style={{ borderBottom: `1px solid #e6e9ee` }}>
                <Group justify="space-between" align="center">
                  <Text size="sm" fw={600}>
                    Расписание на неделю
                  </Text>
                  <Group gap={8}>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      leftSection={<IconChevronLeft size={14} />}
                      onClick={() => setWeekOffset((o) => o - 1)}
                    >
                      Пред. неделя
                    </Button>
                    <Button
                      variant="light"
                      color="blue"
                      size="xs"
                      onClick={() => setWeekOffset(0)}
                    >
                      Сегодня
                    </Button>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      rightSection={<IconChevronRight size={14} />}
                      onClick={() => setWeekOffset((o) => o + 1)}
                    >
                      След. неделя
                    </Button>
                  </Group>
                </Group>
                <Group justify="center" mt={4}>
                  <Group gap={4} align="center">
                    <IconCalendar size={14} color="var(--mantine-color-blue-6)" />
                    <Text size="xs" c="dimmed">
                      {gridWeekStart.getDate().toString().padStart(2, '0')}.{String(gridWeekStart.getMonth() + 1).padStart(2, '0')} — {gridWeekEnd.getDate().toString().padStart(2, '0')}.{String(gridWeekEnd.getMonth() + 1).padStart(2, '0')}.{gridWeekEnd.getFullYear()}
                    </Text>
                  </Group>
                </Group>
              </Box>
              <ScrollArea>
                <Table style={{ borderCollapse: 'collapse' }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th ta="center" style={{ minWidth: 60 }}>Урок</Table.Th>
                      {gridWeekDays.map((d, i) => {
                        const isToday = formatDate(d) === formatDate(new Date());
                        const dateStr = formatDate(d);
                        const isSelected = selectedDayCol === dateStr;
                        return (
                          <Table.Th
                            key={i}
                            ta="center"
                            onClick={() => {
                              setSelectedDayCol(isSelected ? null : dateStr);
                              if (!isSelected) {
                                setSelectedDate(d);
                                setShowAllDates(false);
                              }
                            }}
                            style={{
                              color: (isToday || isSelected) ? '#fff' : undefined,
                              backgroundColor: isSelected ? 'var(--mantine-color-blue-8)' : isToday ? 'var(--mantine-color-blue-6)' : undefined,
                              borderBottom: (isToday || isSelected) ? '2px solid var(--mantine-color-blue-6)' : undefined,
                              minWidth: 140,
                              borderRadius: (isToday || isSelected) ? '8px 8px 0 0' : undefined,
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                            }}
                          >
                            {DAY_NAMES_SHORT[i]}
                            <br />
                            <Text size="xs" c={isToday ? '#fff' : 'dimmed'} component="span">
                              {d.getDate().toString().padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}
                            </Text>
                          </Table.Th>
                        );
                      })}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {bellSlots.map((slot) => (
                      <Table.Tr key={slot.id}>
                        <Table.Td ta="center" fw={600} c="dimmed" style={{ verticalAlign: 'top' }}>
                          {slot.slotNumber}
                          <br />
                          <Text size="xs" c="dimmed" component="span">
                            {slot.startTime}
                          </Text>
                        </Table.Td>
                        {gridWeekDays.map((d, dayIdx) => {
                          const dayNum = dayIdx + 1;
                          const cellDateStr = formatDate(d);
                          const dayEntries = scheduleGrid[slot.id]?.[dayNum] || [];
                          const isTodayCol = formatDate(d) === formatDate(new Date());

                          return (
                            <Table.Td
                              key={dayIdx}
                              style={{
                                verticalAlign: 'top',
                                minWidth: 140,
                                background: isTodayCol
                                  ? 'rgba(34, 139, 230, 0.06)'
                                  : dayEntries.length === 0
                                  ? '#ffffff'
                                  : undefined,
                              }}
                            >
                              {dayEntries.length === 0 ? (
                                <Text size="xs" c="dimmed" ta="center">
                                  —
                                </Text>
                              ) : (
                                <Stack gap={2}>
                                  {dayEntries.map((entry) => {
                                    const subKey = `${slot.id}-${cellDateStr}-${entry.classId}`;
                                    const sub = weeklySubMap.get(subKey);

                                    if (entry.class && !filterByLevel(entry.class.grade)) {
                                      return null;
                                    }

                                    const className = entry.class
                                      ? `${entry.class.grade}${entry.class.letter}`
                                      : '';

                                    const handleCellClick = () => {
                                      if (sub) {
                                        // Open modal to view/edit existing substitution
                                        setSuggestModal({
                                          open: true,
                                          date: cellDateStr,
                                          slotId: entry.slotId,
                                          classId: entry.classId,
                                          subjectId: entry.subjectId,
                                          originalTeacherId: entry.teacherId,
                                          className,
                                          subjectName: entry.subject?.name || '',
                                          slotNumber: slot.slotNumber,
                                        });
                                      } else {
                                        // Open modal to create new substitution
                                        setSuggestModal({
                                          open: true,
                                          date: cellDateStr,
                                          slotId: entry.slotId,
                                          classId: entry.classId,
                                          subjectId: entry.subjectId,
                                          originalTeacherId: entry.teacherId,
                                          className,
                                          subjectName: entry.subject?.name || '',
                                          slotNumber: slot.slotNumber,
                                        });
                                      }
                                      setSelectedSubstitute('');
                                      setAbsenceReason('');
                                    };

                                    const cellContent = (
                                      <UnstyledButton
                                        key={entry.id}
                                        onClick={handleCellClick}
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          background: sub
                                            ? 'rgba(233, 30, 140, 0.15)'
                                            : 'rgba(64, 192, 87, 0.12)',
                                          borderRadius: 4,
                                          padding: '4px 6px',
                                          borderLeft: sub
                                            ? '3px solid #e91e8c'
                                            : '3px solid #40c057',
                                          cursor: 'pointer',
                                          transition: 'filter 0.15s, box-shadow 0.15s',
                                        }}
                                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                                          e.currentTarget.style.filter = 'brightness(0.93)';
                                          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
                                        }}
                                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                                          e.currentTarget.style.filter = '';
                                          e.currentTarget.style.boxShadow = '';
                                        }}
                                      >
                                        <Group gap={4} wrap="nowrap">
                                          <Badge
                                            size="xs"
                                            variant="filled"
                                            color={sub ? 'pink' : 'blue'}
                                            radius="sm"
                                          >
                                            {className}
                                          </Badge>
                                          <Text size="xs" fw={500} truncate>
                                            {entry.subject?.name || ''}
                                          </Text>
                                        </Group>
                                        <Text size="xs" c="dimmed" mt={1} truncate>
                                          {entry.teacher
                                            ? getShortName(entry.teacher)
                                            : ''}
                                        </Text>
                                        {sub && (
                                          <>
                                            <Text size="xs" c="pink" fw={600} mt={1} truncate>
                                              {sub.substitute
                                                ? getShortName(sub.substitute)
                                                : 'Замена'}
                                            </Text>
                                            <Badge size="xs" variant="light" color="pink" radius="sm" mt={2}>
                                              замена
                                            </Badge>
                                          </>
                                        )}
                                      </UnstyledButton>
                                    );

                                    return sub ? (
                                      <Tooltip
                                        key={entry.id}
                                        label={`Замена: ${sub.substitute ? getFullName(sub.substitute) : 'не назначена'} | Причина: ${sub.reason || 'не указана'}`}
                                        multiline
                                        w={260}
                                        withArrow
                                        position="top"
                                      >
                                        {cellContent}
                                      </Tooltip>
                                    ) : cellContent;
                                  })}
                                </Stack>
                              )}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}
        </>
      )}

      {/* ── Suggest Substitution Modal ── */}
      <Modal
        opened={suggestModal.open}
        onClose={() => {
          setSuggestModal({ open: false });
          setSelectedSubstitute('');
          setAbsenceReason('');
          setManualDate(formatDate(new Date()));
          setManualClassId('');
          setManualSubjectId('');
          setManualSlotId('');
          setManualOriginalTeacherId('');
        }}
        title={
          <Text fw={600}>
            {isManualMode ? 'Создать замену' : 'Предложить вариант замены'}
          </Text>
        }
        size="md"
      >
        <Stack gap="md">
          {isManualMode ? (
            <>
              {/* Date */}
              <TextInput
                label="Дата замены"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.currentTarget.value)}
                size="sm"
              />

              {/* Class */}
              <Select
                label="Класс"
                placeholder="Выберите класс"
                data={allClasses.map((c) => ({
                  value: c.id,
                  label: `${c.grade}${c.letter}`,
                }))}
                value={manualClassId}
                onChange={(v) => setManualClassId(v || '')}
                searchable
                size="sm"
              />

              {/* Subject */}
              <Select
                label="Предмет"
                placeholder={manualClassId ? 'Выберите предмет' : 'Сначала выберите класс'}
                data={subjectsForClass.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                value={manualSubjectId}
                onChange={(v) => setManualSubjectId(v || '')}
                disabled={!manualClassId}
                searchable
                size="sm"
              />

              {/* Lesson slot */}
              <Select
                label="Урок"
                placeholder="Выберите урок"
                data={lessonSlots.map((s) => ({
                  value: s.id,
                  label: `Урок ${s.slotNumber} (${s.startTime} - ${s.endTime})`,
                }))}
                value={manualSlotId}
                onChange={(v) => setManualSlotId(v || '')}
                size="sm"
              />

              {/* Original teacher (auto-filled) */}
              {manualOriginalTeacherId && (
                <Paper p="sm" radius="md" withBorder bg="'#f8f9fb'">
                  <Text size="xs" c="dimmed" mb={4}>Основной педагог</Text>
                  <Text size="sm" fw={500}>
                    {(() => {
                      const t = allTeachers.find((t) => t.id === manualOriginalTeacherId);
                      return t ? getFullName(t) : manualOriginalTeacherId;
                    })()}
                  </Text>
                </Paper>
              )}

              {/* Reason */}
              <Textarea
                label="Причина отсутствия"
                placeholder="Укажите причину..."
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.currentTarget.value)}
                size="sm"
              />
            </>
          ) : (
            <>
              {/* Context info */}
              <Paper p="sm" radius="md" withBorder bg="'#f8f9fb'">
                <Group gap="lg">
                  {suggestModal.date && (
                    <Box>
                      <Text size="xs" c="dimmed">Дата</Text>
                      <Text size="sm" fw={500}>{formatDateRu(new Date(suggestModal.date + 'T00:00:00'))}</Text>
                    </Box>
                  )}
                  <Box>
                    <Text size="xs" c="dimmed">Класс</Text>
                    <Text size="sm" fw={500}>{suggestModal.className || '-'}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Предмет</Text>
                    <Text size="sm" fw={500}>{suggestModal.subjectName || '-'}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Урок</Text>
                    <Text size="sm" fw={500}>{suggestModal.slotNumber || '-'}</Text>
                  </Box>
                </Group>
              </Paper>

              {/* Reason */}
              <Textarea
                label="Причина отсутствия"
                placeholder="Укажите причину..."
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.currentTarget.value)}
                size="sm"
              />
            </>
          )}

          {/* Available teachers */}
          <Box>
            <Text size="sm" c="dimmed" fw={600} mb={8}>
              Свободные педагоги на этот урок
            </Text>
            {availableLoading ? (
              <Loader size="sm" color="blue" />
            ) : availableTeachers.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                Нет свободных педагогов на этот урок
              </Text>
            ) : (
              <Stack gap={4}>
                {availableTeachers.map((t) => (
                  <UnstyledButton
                    key={t.id}
                    onClick={() => setSelectedSubstitute(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: `1px solid ${selectedSubstitute === t.id ? 'var(--mantine-color-pink-6)' : '#e6e9ee'}`,
                      background: selectedSubstitute === t.id ? 'var(--mantine-color-pink-light)' : '#f8f9fb',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Group gap={8}>
                      <Avatar size={28} radius="xl" color="blue" variant="filled" src={t.photo}>
                        {getInitials(t)}
                      </Avatar>
                      <Box>
                        <Text size="sm" fw={500}>
                          {getFullName(t)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t.subjects?.map((s) => s.name).join(', ') || t.position || ''}
                        </Text>
                      </Box>
                    </Group>
                    {selectedSubstitute === t.id && (
                      <IconCheck size={16} color="var(--mantine-color-pink-6)" />
                    )}
                  </UnstyledButton>
                ))}
              </Stack>
            )}
          </Box>

          {/* Confirm button */}
          <Button
            color="pink"
            fullWidth
            disabled={
              !selectedSubstitute ||
              (isManualMode && (!manualClassId || !manualSubjectId || !manualSlotId || !manualOriginalTeacherId))
            }
            loading={createSubMutation.isPending}
            onClick={handleAssignSubstitution}
            leftSection={<IconReplace size={16} />}
          >
            Назначить замену
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function SubstitutionsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']}>
      <SubstitutionsContent />
    </RoleGate>
  );
}
