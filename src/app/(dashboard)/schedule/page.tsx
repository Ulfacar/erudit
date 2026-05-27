'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMe } from '@/shared/hooks/useMe';
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCalendar,
  IconClock,
  IconPlus,
  IconReplace,
  IconRobot,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Dark theme tokens ── */
const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = '#6b7280';

/* ── Types ── */
interface BellSlot {
  id: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  type: 'lesson' | 'break_time' | 'breakfast' | 'lunch' | 'snack' | 'dismissal';
}

interface ClassItem {
  id: string;
  grade: number;
  letter: string;
  levelId: string;
  level: { id: string; name: string; fromGrade: number; toGrade: number };
}

interface SchoolLevel {
  id: string;
  name: string;
  fromGrade: number;
  toGrade: number;
}

interface TeacherRef {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
}

interface SubjectRef {
  id: string;
  name: string;
  color?: string | null;
}

interface ScheduleEntry {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  slotId: string;
  dayOfWeek: number;
  periodStart: string;
  periodEnd: string;
  class: { id: string; grade: number; letter: string };
  teacher: TeacherRef;
  subject: SubjectRef;
  slot: BellSlot;
}

interface GeneratedPreviewEntry {
  dayOfWeek: number;
  slot?: { slotNumber: number; startTime: string; endTime: string };
  subject?: { name: string };
  teacher?: { firstName: string; lastName: string };
}

/* ── Constants ── */
const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
const DAY_NUMBERS = [1, 2, 3, 4, 5];

const SLOT_TYPE_LABELS: Record<string, string> = {
  lesson: 'Урок',
  break_time: 'Перемена',
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Полдник',
  dismissal: 'Уход',
};

const LEVEL_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'elementary', label: 'Начальные' },
  { value: 'middle', label: 'Средние' },
  { value: 'senior', label: 'Старшие' },
];

/* ── Cell colors ── */
function cellBg(type: string, isConflict?: boolean, isSubstitution?: boolean): string {
  if (isConflict) return 'rgba(224, 49, 49, 0.15)';
  if (isSubstitution) return 'rgba(230, 73, 128, 0.15)';
  if (type === 'breakfast' || type === 'lunch' || type === 'snack' || type === 'dismissal') {
    return 'rgba(134, 142, 150, 0.08)';
  }
  if (type === 'break_time') return 'rgba(134, 142, 150, 0.05)';
  return 'rgba(34, 139, 230, 0.08)';
}

function cellBorder(type: string, isConflict?: boolean): string {
  if (isConflict) return '1px solid rgba(224, 49, 49, 0.3)';
  if (type === 'lesson') return '1px solid rgba(34, 139, 230, 0.15)';
  return `1px solid ${SURFACE_BORDER}`;
}

/* ── Stat Card ── */
function StatCard({ label, icon, color, href, onClick }: { label: string; icon: React.ReactNode; color: string; href?: string; onClick?: () => void }) {
  const content = (
    <Paper
      style={{
        background: SURFACE,
        border: `1px solid ${SURFACE_BORDER}`,
        padding: '12px 16px',
        cursor: 'pointer',
        minWidth: 160,
        transition: 'background 0.15s',
      }}
      radius="sm"
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--mantine-color-default-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = SURFACE; }}
    >
      <Group gap={8}>
        <Box style={{ color }}>{icon}</Box>
        <Text size="sm" c="var(--mantine-color-text)">{label}</Text>
      </Group>
    </Paper>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>;
  }
  return content;
}

/* ── Main Component ── */
function ScheduleContent() {
  const { me } = useMe();
  const canEdit = me?.role === 'super_admin' || me?.role === 'zavuch';
  const isStudentOrParent = me?.role === 'student' || me?.role === 'parent';
  const isParent = me?.role === 'parent';
  const [parentChildId, setParentChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bells, setBells] = useState<BellSlot[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [levels, setLevels] = useState<SchoolLevel[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState('all');
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [modalSlot, setModalSlot] = useState<BellSlot | null>(null);
  const [modalDay, setModalDay] = useState<number>(1);
  const [modalTeacherId, setModalTeacherId] = useState<string | null>(null);
  const [modalSubjectId, setModalSubjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Auto-generate modal state
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [autoGenClassId, setAutoGenClassId] = useState<string | null>(null);
  const [autoGenPeriodStart, setAutoGenPeriodStart] = useState('2025-09-01');
  const [autoGenPeriodEnd, setAutoGenPeriodEnd] = useState('2026-06-30');
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenPreview, setAutoGenPreview] = useState<ScheduleEntry[] | null>(null);
  const [autoGenError, setAutoGenError] = useState('');
  const [autoGenSaving, setAutoGenSaving] = useState(false);

  // Current period (for simplicity, use current academic period range)
  const periodStart = '2025-09-01';
  const periodEnd = '2026-06-30';

  const fetchData = useCallback(async () => {
    try {
      const [bellsRes, classesRes, levelsRes] = await Promise.all([
        fetch('/api/v1/schedule/bells'),
        fetch('/api/v1/classes'),
        fetch('/api/v1/school-levels'),
      ]);
      const bellsData = await bellsRes.json();
      const classesData = await classesRes.json();
      const levelsData = await levelsRes.json();

      if (bellsData.success) setBells(bellsData.data);
      if (classesData.success) {
        setClasses(classesData.data);
        if (!selectedClassId && classesData.data.length > 0) {
          // Student/parent: auto-select their class
          const activeChild = isParent
            ? me?.children?.find((c) => c.studentId === parentChildId) ?? me?.children?.[0]
            : null;
          const myClassId = me?.student?.classId ?? activeChild?.classId;
          if (isStudentOrParent && myClassId) {
            setSelectedClassId(myClassId);
          } else {
            setSelectedClassId(classesData.data[0].id);
          }
        }
      }
      if (levelsData.success) setLevels(levelsData.data);
    } catch {
      console.error('Failed to fetch schedule data');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId]);

  const fetchEntries = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      const res = await fetch(
        `/api/v1/schedule?classId=${selectedClassId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
      );
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch {
      console.error('Failed to fetch entries');
    }
  }, [selectedClassId, periodStart, periodEnd]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedClassId) fetchEntries();
  }, [selectedClassId, fetchEntries]);

  // Parent child switcher: update selectedClassId when child changes
  useEffect(() => {
    if (!isParent || !me?.children) return;
    const child = me.children.find((c) => c.studentId === parentChildId) ?? me.children[0];
    if (child?.classId && child.classId !== selectedClassId) {
      setSelectedClassId(child.classId);
    }
  }, [parentChildId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter classes by level
  const filteredClasses = classes.filter((c) => {
    if (levelFilter === 'all') return true;
    const level = levels.find((l) => l.id === c.levelId);
    if (!level) return true;
    if (levelFilter === 'elementary') return level.fromGrade <= 4;
    if (levelFilter === 'middle') return level.fromGrade >= 5 && level.toGrade <= 9;
    if (levelFilter === 'senior') return level.fromGrade >= 10;
    return true;
  });

  // Group classes by grade for tabs
  const sortedClasses = [...filteredClasses].sort((a, b) =>
    a.grade !== b.grade ? a.grade - b.grade : a.letter.localeCompare(b.letter),
  );

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Get entry for a specific slot + day
  function getEntry(slotId: string, day: number): ScheduleEntry | undefined {
    return entries.find((e) => e.slotId === slotId && e.dayOfWeek === day);
  }


  // Open add modal
  function openAddModal(slot: BellSlot, day: number) {
    setEditEntry(null);
    setModalSlot(slot);
    setModalDay(day);
    setModalTeacherId(null);
    setModalSubjectId(null);
    setModalError('');
    setModalOpen(true);
  }

  // Open edit modal
  function openEditModal(entry: ScheduleEntry) {
    setEditEntry(entry);
    setModalSlot(entry.slot);
    setModalDay(entry.dayOfWeek);
    setModalSubjectId(entry.subjectId);
    setModalTeacherId(entry.teacherId);
    setModalError('');
    setModalOpen(true);
  }

  // Teacher-subject data from the API
  const [tsRawData, setTsRawData] = useState<{ id: string; teacherId: string; subjectId: string; teacher: TeacherRef; subject: SubjectRef }[]>([]);

  // Build subject options (unique subjects for this class)
  const subjectSelectOptions = (() => {
    const seen = new Map<string, string>();
    for (const ts of tsRawData) {
      if (!seen.has(ts.subjectId)) {
        seen.set(ts.subjectId, ts.subject.name);
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  })();

  // Build teacher options filtered by selected subject
  const teacherSelectOptions = (() => {
    if (!modalSubjectId) return [];
    const seen = new Map<string, string>();
    for (const ts of tsRawData) {
      if (ts.subjectId === modalSubjectId && !seen.has(ts.teacherId)) {
        const name = `${ts.teacher.lastName} ${ts.teacher.firstName}${ts.teacher.middleName ? ' ' + ts.teacher.middleName : ''}`;
        seen.set(ts.teacherId, name);
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  })();

  async function loadTeacherSubjectOptions(classId: string) {
    try {
      const tsRes = await fetch(`/api/v1/schedule/teacher-subjects?classId=${classId}`);
      const tsData = await tsRes.json();

      if (tsData.success) {
        setTsRawData(tsData.data);
      }
    } catch {
      console.error('Failed to load teacher-subject options');
    }
  }

  useEffect(() => {
    if (modalOpen && selectedClassId) {
      loadTeacherSubjectOptions(selectedClassId);
    }
  }, [modalOpen, selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill teacher when subject is selected and only one teacher teaches it
  useEffect(() => {
    if (!modalSubjectId) {
      setModalTeacherId(null);
      return;
    }
    const teachersForSubject = tsRawData.filter((ts) => ts.subjectId === modalSubjectId);
    const uniqueTeachers = [...new Set(teachersForSubject.map((ts) => ts.teacherId))];
    if (uniqueTeachers.length === 1) {
      setModalTeacherId(uniqueTeachers[0]);
    }
  }, [modalSubjectId, tsRawData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!modalTeacherId || !modalSubjectId || !modalSlot || !selectedClassId) {
      setModalError('Выберите педагога и предмет');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const payload = {
        classId: selectedClassId,
        teacherId: modalTeacherId,
        subjectId: modalSubjectId,
        slotId: modalSlot.id,
        dayOfWeek: modalDay,
        periodStart,
        periodEnd,
      };

      let res: Response;
      if (editEntry) {
        res = await fetch(`/api/v1/schedule/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/v1/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        fetchEntries();
      } else {
        setModalError(data.error?.message || 'Ошибка при сохранении');
      }
    } catch {
      setModalError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editEntry) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/schedule/${editEntry.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        fetchEntries();
      } else {
        setModalError(data.error?.message || 'Ошибка при удалении');
      }
    } catch {
      setModalError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!autoGenClassId) {
      setAutoGenError('Выберите класс');
      return;
    }
    setAutoGenLoading(true);
    setAutoGenError('');
    setAutoGenPreview(null);
    try {
      const res = await fetch('/api/v1/schedule/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: autoGenClassId,
          periodStart: autoGenPeriodStart,
          periodEnd: autoGenPeriodEnd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoGenPreview(data.data.generated);
      } else {
        setAutoGenError(data.error?.message || 'Ошибка генерации');
      }
    } catch {
      setAutoGenError('Ошибка сети');
    } finally {
      setAutoGenLoading(false);
    }
  };

  const handleAutoGenSave = async () => {
    if (!autoGenClassId) return;
    setAutoGenSaving(true);
    setAutoGenError('');
    try {
      const res = await fetch('/api/v1/schedule/auto-generate?save=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: autoGenClassId,
          periodStart: autoGenPeriodStart,
          periodEnd: autoGenPeriodEnd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoGenOpen(false);
        setAutoGenPreview(null);
        fetchEntries();
      } else {
        setAutoGenError(data.error?.message || 'Ошибка сохранения');
      }
    } catch {
      setAutoGenError('Ошибка сети');
    } finally {
      setAutoGenSaving(false);
    }
  };

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader color="blue" />
      </Box>
    );
  }

  const lessonSlots = bells.filter((b) => b.type === 'lesson');

  return (
    <Stack gap="md">
      {/* Parent child switcher */}
      {isParent && me?.children && me.children.length > 1 && (
        <Select
          label="Ребёнок"
          data={me.children.map((c) => ({
            value: c.studentId,
            label: `${c.lastName} ${c.firstName}${c.className ? ` · ${c.className}` : ''}`,
          }))}
          value={parentChildId ?? me.children[0]?.studentId}
          onChange={setParentChildId}
          allowDeselect={false}
          w={280}
        />
      )}

      {/* Stat cards — staff only */}
      {!isStudentOrParent && <Group gap="sm">
        <StatCard label="Нагрузка" icon={<IconUsers size={18} />} color="#228be6" href="/teachers/workload" />
        <StatCard
          label="Расписание"
          icon={<IconCalendar size={18} />}
          color="#40c057"
          onClick={() => {
            document.getElementById('schedule-grid')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <StatCard label="Замена" icon={<IconReplace size={18} />} color="#fab005" href="/substitutions" />
        <StatCard label="Список педагогов" icon={<IconUsers size={18} />} color="#be4bdb" href="/teachers" />
        <Button
          leftSection={<IconRobot size={16} />}
          variant="light"
          color="teal"
          size="sm"
          onClick={() => {
            setAutoGenClassId(selectedClassId);
            setAutoGenPreview(null);
            setAutoGenError('');
            setAutoGenOpen(true);
          }}
        >
          Автоматическое расписание
        </Button>
      </Group>}

      {/* Date + level filter */}
      <Group justify="space-between">
        <Group gap="sm">
          <IconCalendar size={16} color={TEXT_SEC} />
          <Text size="sm" c="var(--mantine-color-text)">
            {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </Group>
        {!isStudentOrParent && <SegmentedControl
          value={levelFilter}
          onChange={setLevelFilter}
          data={LEVEL_OPTIONS}
          size="xs"
          styles={{
            root: { background: SURFACE, border: `1px solid ${SURFACE_BORDER}` },
          }}
        />}
      </Group>

      {/* Class selector tabs — hidden for student/parent (they see only own class) */}
      {sortedClasses.length > 0 && !isStudentOrParent && (
        <ScrollArea type="never">
          <Group gap={4} style={{ flexWrap: 'nowrap' }}>
            {sortedClasses.map((cls) => (
              <UnstyledButton
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: selectedClassId === cls.id ? '#fff' : TEXT_SEC,
                  background: selectedClassId === cls.id ? '#228be6' : SURFACE,
                  border: `1px solid ${selectedClassId === cls.id ? '#228be6' : SURFACE_BORDER}`,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {cls.grade}{cls.letter}
              </UnstyledButton>
            ))}
          </Group>
        </ScrollArea>
      )}

      {/* Selected class teacher badge */}
      {selectedClass && (
        <Group gap={8}>
          <Badge variant="light" color="blue" size="lg" radius="sm">
            {selectedClass.grade}{selectedClass.letter}
          </Badge>
          <Text size="sm" c={TEXT_SEC}>
            {selectedClass.level?.name || ''}
          </Text>
        </Group>
      )}

      {/* Weekly schedule grid */}
      <Paper
        id="schedule-grid"
        style={{
          background: SURFACE,
          border: `1px solid ${SURFACE_BORDER}`,
          overflow: 'hidden',
        }}
        radius="sm"
      >
        <ScrollArea>
          <Table
            style={{ minWidth: 900 }}
            styles={{
              table: { borderCollapse: 'collapse' },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{
                    color: TEXT_SEC,
                    fontSize: 12,
                    fontWeight: 600,
                    borderBottom: `1px solid ${SURFACE_BORDER}`,
                    borderRight: `1px solid ${SURFACE_BORDER}`,
                    padding: '8px 12px',
                    background: 'transparent',
                    width: 120,
                    minWidth: 120,
                  }}
                >
                  <Group gap={4}>
                    <IconClock size={14} />
                    <span>Время / Урок</span>
                  </Group>
                </Table.Th>
                {DAY_NAMES.map((name, i) => (
                  <Table.Th
                    key={i}
                    style={{
                      color: TEXT_SEC,
                      fontSize: 12,
                      fontWeight: 600,
                      borderBottom: `1px solid ${SURFACE_BORDER}`,
                      borderRight: i < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                      padding: '8px 12px',
                      background: 'transparent',
                      textAlign: 'center',
                      minWidth: 150,
                    }}
                  >
                    {name}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {bells.map((slot) => {
                const isNonLesson = slot.type !== 'lesson' && slot.type !== 'break_time';
                const isBreak = slot.type === 'break_time';

                return (
                  <Table.Tr key={slot.id}>
                    {/* Time + slot info cell */}
                    <Table.Td
                      style={{
                        borderBottom: `1px solid ${SURFACE_BORDER}`,
                        borderRight: `1px solid ${SURFACE_BORDER}`,
                        padding: '6px 10px',
                        background: isNonLesson
                          ? 'rgba(134, 142, 150, 0.05)'
                          : isBreak
                            ? 'rgba(134, 142, 150, 0.03)'
                            : 'transparent',
                        verticalAlign: 'middle',
                      }}
                    >
                      <Text size="xs" c="var(--mantine-color-text)" fw={600}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                      <Text size="xs" c={TEXT_SEC}>
                        {slot.type === 'lesson'
                          ? `${slot.slotNumber} урок`
                          : SLOT_TYPE_LABELS[slot.type] || slot.type}
                      </Text>
                    </Table.Td>

                    {/* Day cells */}
                    {DAY_NUMBERS.map((day, dayIdx) => {
                      const entry = slot.type === 'lesson' ? getEntry(slot.id, day) : undefined;

                      // Non-lesson rows: merge visual with different style
                      if (isNonLesson) {
                        return (
                          <Table.Td
                            key={day}
                            style={{
                              borderBottom: `1px solid ${SURFACE_BORDER}`,
                              borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                              padding: '6px 10px',
                              background: cellBg(slot.type),
                              textAlign: 'center',
                              verticalAlign: 'middle',
                            }}
                          >
                            <Text size="xs" c={TEXT_SEC} fs="italic">
                              {SLOT_TYPE_LABELS[slot.type]}
                            </Text>
                          </Table.Td>
                        );
                      }

                      // Break rows
                      if (isBreak) {
                        return (
                          <Table.Td
                            key={day}
                            style={{
                              borderBottom: `1px solid ${SURFACE_BORDER}`,
                              borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                              padding: '4px 10px',
                              background: cellBg(slot.type),
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              height: 28,
                            }}
                          />
                        );
                      }

                      // Lesson cell
                      if (entry) {
                        return (
                          <Table.Td
                            key={day}
                            onClick={canEdit ? () => openEditModal(entry) : undefined}
                            style={{
                              borderBottom: cellBorder(slot.type),
                              borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                              padding: 0,
                              background: cellBg(slot.type),
                              cursor: canEdit ? 'pointer' : 'default',
                              verticalAlign: 'middle',
                              transition: 'background 0.15s',
                              position: 'relative',
                            }}
                            onMouseEnter={canEdit ? (e) => {
                              e.currentTarget.style.background = 'rgba(34, 139, 230, 0.15)';
                            } : undefined}
                            onMouseLeave={canEdit ? (e) => {
                              e.currentTarget.style.background = cellBg(slot.type);
                            } : undefined}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              minHeight: 38,
                            }}>
                              <div style={{
                                width: 4,
                                flexShrink: 0,
                                borderRadius: '2px 0 0 2px',
                                background: entry.subject.color || '#228be6',
                              }} />
                              <div style={{ padding: '4px 8px', flex: 1, minWidth: 0 }}>
                                <Text size="xs" fw={600} c={entry.subject.color || 'var(--mantine-color-text)'} lineClamp={1}>
                                  {entry.subject.name}
                                </Text>
                                <Text size="xs" c={TEXT_SEC} lineClamp={1}>
                                  {entry.teacher.lastName} {entry.teacher.firstName?.charAt(0)}.
                                </Text>
                              </div>
                            </div>
                          </Table.Td>
                        );
                      }

                      // Empty lesson cell
                      return (
                        <Table.Td
                          key={day}
                          onClick={canEdit ? () => openAddModal(slot, day) : undefined}
                          style={{
                            borderBottom: `1px solid ${SURFACE_BORDER}`,
                            borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                            padding: '6px 10px',
                            cursor: canEdit ? 'pointer' : 'default',
                            verticalAlign: 'middle',
                            minHeight: 48,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(34, 139, 230, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Group gap={4} justify="center" style={{ opacity: 0.3 }}>
                            <IconPlus size={12} color={TEXT_SEC} />
                          </Group>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {/* Summary */}
      <Group gap="sm">
        <Text size="xs" c={TEXT_SEC}>
          Всего уроков: {lessonSlots.length} слотов x {DAY_NUMBERS.length} дней = {lessonSlots.length * DAY_NUMBERS.length} ячеек
        </Text>
        <Text size="xs" c={TEXT_SEC}>|</Text>
        <Text size="xs" c={TEXT_SEC}>
          Заполнено: {entries.length}
        </Text>
      </Group>

      {/* Auto-generate Modal */}
      <Modal
        opened={autoGenOpen}
        onClose={() => setAutoGenOpen(false)}
        title="Автоматическое расписание"
        centered
        size="lg"
        styles={{
          header: { background: SURFACE, borderBottom: `1px solid ${SURFACE_BORDER}` },
          body: { background: SURFACE },
          content: { background: SURFACE },
        }}
      >
        <Stack gap="md">
          <Select
            label="Класс"
            placeholder="Выберите класс"
            data={classes.map((c) => ({
              value: c.id,
              label: `${c.grade}${c.letter}`,
            }))}
            value={autoGenClassId}
            onChange={setAutoGenClassId}
            searchable
          />
          <Group grow>
            <TextInput
              label="Начало периода"
              type="date"
              value={autoGenPeriodStart}
              onChange={(e) => setAutoGenPeriodStart(e.currentTarget.value)}
            />
            <TextInput
              label="Конец периода"
              type="date"
              value={autoGenPeriodEnd}
              onChange={(e) => setAutoGenPeriodEnd(e.currentTarget.value)}
            />
          </Group>

          <Button
            onClick={handleAutoGenerate}
            loading={autoGenLoading}
            leftSection={<IconRobot size={16} />}
            variant="light"
            color="teal"
          >
            Сгенерировать
          </Button>

          {autoGenError && (
            <Text c="red" size="sm">
              {autoGenError}
            </Text>
          )}

          {autoGenPreview && (
            <>
              <Text size="sm" fw={600}>
                Предварительный просмотр ({autoGenPreview.length} уроков)
              </Text>
              <ScrollArea style={{ maxHeight: 300 }}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>День</Table.Th>
                      <Table.Th>Урок</Table.Th>
                      <Table.Th>Предмет</Table.Th>
                      <Table.Th>Учитель</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {autoGenPreview
                      .sort((a, b) => {
                        const ae = a as unknown as GeneratedPreviewEntry;
                        const be = b as unknown as GeneratedPreviewEntry;
                        if (ae.dayOfWeek !== be.dayOfWeek) return ae.dayOfWeek - be.dayOfWeek;
                        return (ae.slot?.slotNumber || 0) - (be.slot?.slotNumber || 0);
                      })
                      .map((entry, idx) => {
                        const e = entry as unknown as GeneratedPreviewEntry;
                        return (
                          <Table.Tr key={idx}>
                            <Table.Td>{DAY_NAMES[e.dayOfWeek - 1] || e.dayOfWeek}</Table.Td>
                            <Table.Td>
                              {e.slot
                                ? `${e.slot.slotNumber} (${e.slot.startTime}-${e.slot.endTime})`
                                : '—'}
                            </Table.Td>
                            <Table.Td>{e.subject?.name || '—'}</Table.Td>
                            <Table.Td>
                              {e.teacher
                                ? `${e.teacher.lastName} ${e.teacher.firstName}`
                                : '—'}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() => setAutoGenOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleAutoGenSave}
                  loading={autoGenSaving}
                  color="teal"
                >
                  Сохранить расписание
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editEntry ? 'Редактировать урок' : 'Добавить урок'}
        centered
        styles={{
          header: { background: SURFACE, borderBottom: `1px solid ${SURFACE_BORDER}` },
          body: { background: SURFACE },
          content: { background: SURFACE },
        }}
      >
        <Stack gap="md">
          {/* Slot info */}
          {modalSlot && (
            <Paper
              style={{ background: 'var(--mantine-color-default-hover)', border: `1px solid ${SURFACE_BORDER}` }}
              p="sm"
              radius="sm"
            >
              <Group gap="sm">
                <Badge variant="light" color="blue" size="sm">
                  {DAY_NAMES[modalDay - 1]}
                </Badge>
                <Text size="sm" c="var(--mantine-color-text)">
                  {modalSlot.startTime} - {modalSlot.endTime} ({modalSlot.slotNumber} урок)
                </Text>
              </Group>
            </Paper>
          )}

          {/* Subject selection */}
          <Select
            label="Предмет"
            placeholder="Выберите предмет"
            data={subjectSelectOptions}
            value={modalSubjectId}
            onChange={(val) => {
              setModalSubjectId(val);
              setModalTeacherId(null);
            }}
            searchable
          />

          {/* Teacher selection — auto-filled when subject is selected */}
          <Select
            label="Педагог"
            placeholder={modalSubjectId ? 'Выберите педагога' : 'Сначала выберите предмет'}
            data={teacherSelectOptions}
            value={modalTeacherId}
            onChange={setModalTeacherId}
            searchable
            disabled={!modalSubjectId}
          />

          {modalError && (
            <Text c="red" size="sm">
              {modalError}
            </Text>
          )}

          <Group justify="space-between" mt="sm">
            <Group gap="sm">
              {editEntry && (
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleDelete}
                  loading={submitting}
                  size="sm"
                >
                  Удалить
                </Button>
              )}
            </Group>
            <Group gap="sm">
              <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)} size="sm">
                Отмена
              </Button>
              <Button onClick={handleSave} loading={submitting} size="sm">
                {editEntry ? 'Сохранить' : 'Добавить'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function SchedulePage() {
  return <ScheduleContent />;
}
