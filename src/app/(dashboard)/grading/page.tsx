'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMessage,
  IconRefresh,
  IconStar,
  IconUsers,
  IconEdit,
  IconSettings,
} from '@tabler/icons-react';

import { exportToExcel } from '@/shared/lib/excel-export';
import {
  convertGrade,
  convertAverage,
  displayInScale,
  prismaScaleToKey,
  type PrismaScale,
} from '@/shared/lib/grade-converter';
import { EditWindowBadge } from '@/shared/components/grading/EditWindowBadge';
import { AddGradeForm } from '@/shared/components/grading/AddGradeForm';
import { useMe } from '@/shared/hooks/useMe';

/* ── Theme-aware color tokens ── */
const SURFACE = '#ffffff';
const SURFACE_HOVER = '#fbfcfd';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_PRIMARY = '#0f172a';
const TEXT_SEC = '#6b7280';

/* ── Grade color map ── */
const GRADE_COLORS: Record<number, { bg: string; color: string; border: string }> = {
  5: { bg: '#d3f9d8', color: '#2f9e44', border: '#40c057' },
  4: { bg: '#dbeafe', color: '#1864ab', border: '#228be6' },
  3: { bg: '#fff3bf', color: '#f08c00', border: '#fab005' },
  2: { bg: '#ffe3e3', color: '#e03131', border: '#fa5252' },
  1: { bg: '#eef0f4', color: '#6b7280', border: '#9ba2ad' },
};

/* ── Performance badge colors ── */
const PERF_COLORS: Record<string, { bg: string; color: string }> = {
  green: { bg: '#40c057', color: '#fff' },
  blue: { bg: '#228be6', color: '#fff' },
  yellow: { bg: '#fab005', color: '#fff' },
  orange: { bg: '#fd7e14', color: '#fff' },
  red: { bg: '#fa5252', color: '#fff' },
  gray: { bg: '#495057', color: '#adb5bd' },
};

/* ── Scale button colors ── */
const SCALE_COLORS: Record<string, string> = {
  '5point': '#228be6',
  '12point': '#40c057',
  '100point': '#fab005',
  'af': '#be4bdb',
};

/* ── Module filter type ── */
type ModuleFilter = 'all' | 'formative' | 'summative';

/* ── Formative categories (weight 1-3) ── */
const FORMATIVE_CATEGORIES = new Set([
  'Правила', 'Пятиминутка', 'Разноуровневые задания', 'ДЗ',
  'Устный ответ', 'Письменные работы', 'Аудирование', 'Грамматика',
  'Чтение и понимание', 'Творческие работы', 'Самооценивание', 'Работа в группах',
]);

/* ── Summative categories (weight 4-5) ── */
const SUMMATIVE_CATEGORIES = new Set([
  'Диктант', 'Словарный диктант', 'Тест', 'Эссе', 'Лабораторная',
  'Контрольная работа', 'Зачёт', 'Триместровая', 'Итоговая',
  'Экзамен', 'Олимпиадные', 'Проект', 'Презентация',
]);

/* ── Scale mapping to convertGrade toScale param ── */
type ScaleKey = '5point' | '12point' | '100point' | 'af';

function displayGradeInScale(value: number, scale: ScaleKey): string {
  if (scale === '5point') return String(Math.max(1, Math.min(5, Math.round(value))));
  if (scale === '12point') return convertGrade(value, '5point', '12point');
  if (scale === '100point') return convertGrade(value, '5point', 'percentage');
  if (scale === 'af') {
    const rounded = Math.max(1, Math.min(5, Math.round(value)));
    const afMap: Record<number, string> = { 5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'F' };
    return afMap[rounded] || String(rounded);
  }
  return String(value);
}

function displayAverageInScale(average: number, scale: ScaleKey): string {
  if (average === 0) return '--';
  if (scale === '5point') return average.toFixed(2);
  if (scale === '12point') return convertAverage(average, '12point');
  if (scale === '100point') return convertAverage(average, 'percentage');
  if (scale === 'af') {
    const rounded = Math.max(1, Math.min(5, Math.round(average)));
    const afMap: Record<number, string> = { 5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'F' };
    return afMap[rounded] || average.toFixed(2);
  }
  return average.toFixed(2);
}

/* ── School level tabs ── */
const LEVEL_TABS = [
  { value: 'all', label: 'Все' },
  { value: 'nach', label: 'Начальная' },
  { value: 'sred', label: 'Средняя' },
  { value: 'star', label: 'Старшая' },
];

/* ── Types ── */
interface ClassOption {
  id: string;
  grade: number;
  letter: string;
  levelId: string;
  level: { id: string; name: string };
}

interface OverviewClass {
  id: string;
  grade: number;
  letter: string;
  levelId: string;
  level: { id: string; name: string };
  studentCount: number;
  curatorId: string | null;
  curator: { id: string; firstName: string; lastName: string; middleName: string | null } | null;
  gradeSummary: Record<string, { fives: number; fours: number; threes: number; twos: number; ones: number }>;
  attendance: { present: number; absent: number; total: number };
}

interface OverviewPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface JournalSubject {
  id: string;
  name: string;
  color: string | null;
}

interface GradeDetail {
  id: string;
  value: number;
  scale?: 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER';
  comment?: string | null;
  status?: 'draft' | 'submitted' | 'moderated' | 'published';
  date: string;
  createdAt?: string;
  updatedAt?: string;
  categoryName: string;
  weight: number;
}

interface SubjectGradeData {
  average: number;
  count: number;
  grades: GradeDetail[];
}

interface JournalStudent {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  absences: number;
  lates: number;
  overallAverage: number;
  performanceLevel: string;
  performanceColor: string;
  subjectGrades: Record<string, SubjectGradeData>;
}

interface JournalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface JournalData {
  classInfo: {
    id: string;
    grade: number;
    letter: string;
    level: { id: string; name: string };
    curator: { id: string; firstName: string; lastName: string; middleName: string | null } | null;
  };
  students: JournalStudent[];
  subjects: JournalSubject[];
  periods: JournalPeriod[];
}

/* ── Helpers ── */
function levelTabMatch(levelName: string, tab: string): boolean {
  if (tab === 'all') return true;
  if (tab === 'nach') return levelName.includes('Начальная');
  if (tab === 'sred') return levelName.includes('Средняя');
  if (tab === 'star') return levelName.includes('Старшая');
  return true;
}

function getShortName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  const first = t.firstName ? t.firstName[0] + '.' : '';
  const middle = t.middleName ? t.middleName[0] + '.' : '';
  return `${t.lastName} ${first}${middle}`;
}

function getGradeRoundedColor(avg: number): { bg: string; color: string; border: string } {
  if (avg >= 4.5) return GRADE_COLORS[5];
  if (avg >= 3.5) return GRADE_COLORS[4];
  if (avg >= 2.5) return GRADE_COLORS[3];
  if (avg >= 1.5) return GRADE_COLORS[2];
  return GRADE_COLORS[1];
}

/* ── Stat Card Component ── */
function StatCard({
  title,
  value,
  change,
  changeDirection,
  changeText,
}: {
  title: string;
  value: number;
  change: string;
  changeDirection: 'up' | 'down';
  changeText: string;
}) {
  const isUp = changeDirection === 'up';
  const [activePeriod, setActivePeriod] = useState(0);
  const periods = ['Сегодня', 'Неделя', 'Месяц'];

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: SURFACE,
        border: `1px solid ${SURFACE_BORDER}`,
        minWidth: 200,
        flex: 1,
      }}
    >
      <Group justify="space-between" mb={4}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {title}
        </Text>
      </Group>
      <Group align="flex-end" gap={8}>
        <Text fw={700} size="xl" style={{ fontSize: 32, lineHeight: 1 }} c={TEXT_PRIMARY}>
          {value}
        </Text>
        <Badge
          size="sm"
          variant="light"
          color={isUp ? 'red' : 'green'}
          leftSection={
            isUp ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />
          }
          style={{ marginBottom: 4 }}
        >
          {change}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {changeText}
      </Text>
      <Group gap={0} mt="sm">
        {periods.map((label, i) => (
          <Button
            key={label}
            variant={activePeriod === i ? 'filled' : 'subtle'}
            color={activePeriod === i ? 'blue' : 'gray'}
            size="compact-xs"
            radius={0}
            style={{
              borderRadius: i === 0 ? '4px 0 0 4px' : i === 2 ? '0 4px 4px 0' : 0,
              fontSize: 10,
            }}
            onClick={() => setActivePeriod(i)}
          >
            {label}
          </Button>
        ))}
      </Group>
    </Paper>
  );
}

/* ── Compare Card ── */
function CompareCard() {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: SURFACE,
        border: `1px solid ${SURFACE_BORDER}`,
        minWidth: 200,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Text fw={600} size="sm" mb={4} c={TEXT_PRIMARY}>
        Сравните успеваемость
      </Text>
      <Text size="xs" c="dimmed" mb="md">
        Сравните успеваемость учеников по разным параметрам
      </Text>
      <Button
        variant="filled"
        color="blue"
        size="xs"
        onClick={() => {
          notifications.show({
            color: 'blue',
            title: 'Информация',
            message: 'Функция в разработке',
          });
        }}
      >
        Сравнить
      </Button>
    </Paper>
  );
}

/* ── Grade Circle Component ── */
function GradeCircle({
  value,
  onClick,
}: {
  value: number;
  onClick?: () => void;
}) {
  const rounded = Math.round(value);
  const clamped = Math.max(1, Math.min(5, rounded));
  const colors = GRADE_COLORS[clamped];

  return (
    <Tooltip label={`Средний балл: ${value.toFixed(2)}`} withArrow position="top">
      <Box
        onClick={onClick}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: colors.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.color,
          fontSize: 14,
          fontWeight: 700,
          cursor: onClick ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {clamped}
      </Box>
    </Tooltip>
  );
}

/* ── Overview Grade Circle (for class cards) ── */
function OverviewGradeCircle({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <Tooltip label={`${count}`} withArrow position="top">
      <Box
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          minWidth: 28,
        }}
      >
        {count}
      </Box>
    </Tooltip>
  );
}

/* ── Class Card Component (for overview mode) ── */
function ClassCard({
  cls,
  periods,
  onClick,
}: {
  cls: OverviewClass;
  periods: OverviewPeriod[];
  onClick: () => void;
}) {
  const curatorName = cls.curator ? getShortName(cls.curator) : 'Не назначен';
  const allPresent = cls.attendance.absent === 0;

  return (
    <Paper
      shadow="xs"
      radius="md"
      withBorder
      p="md"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = '';
      }}
    >
      <Group justify="space-between" align="flex-start" mb="sm">
        <Text fw={700} size="lg" lh={1.2}>
          {cls.grade} {cls.letter.toUpperCase()} класс
        </Text>
        <Badge size="lg" variant="light" color="blue" leftSection={<IconUsers size={14} />} radius="sm">
          {cls.studentCount}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mb={4}>
        Куратор: <Text span fw={500} c={TEXT_PRIMARY}>{curatorName}</Text>
      </Text>
      {periods.map((period) => {
        const summary = cls.gradeSummary[period.id];
        if (!summary) {
          return (
            <Box key={period.id} mb={4}>
              <Text size="xs" c="dimmed" fw={600}>{period.name}:</Text>
              <Text size="xs" c="dimmed" fs="italic">Нет оценок</Text>
            </Box>
          );
        }
        return (
          <Box key={period.id} mb={4}>
            <Text size="xs" c="dimmed" fw={600} mb={2}>{period.name}:</Text>
            <Group gap={4}>
              <OverviewGradeCircle count={summary.fives} color="#228be6" />
              <OverviewGradeCircle count={summary.fours} color="#40c057" />
              <OverviewGradeCircle count={summary.threes} color="#fab005" />
              <OverviewGradeCircle count={summary.twos} color="#fd7e14" />
              <OverviewGradeCircle count={summary.ones} color="#fa5252" />
            </Group>
          </Box>
        );
      })}
      <Box mt="sm" style={{ borderTop: `1px solid ${SURFACE_BORDER}`, paddingTop: 8 }}>
        {allPresent ? (
          <Badge variant="light" color="green" size="sm" radius="sm">Все пришли</Badge>
        ) : (
          <Badge variant="light" color="orange" size="sm" radius="sm">{cls.attendance.absent} не пришли</Badge>
        )}
      </Box>
    </Paper>
  );
}

/* ── Detail Grades Modal (arrow click) ── */
function DetailGradesModal({
  opened,
  onClose,
  studentName,
  subjectName,
  grades,
  scale,
  studentId,
  subjectId,
  periodId,
  teacherId,
  categories,
  canAdd,
  onAdded,
}: {
  opened: boolean;
  onClose: () => void;
  studentName: string;
  subjectName: string;
  grades: GradeDetail[];
  scale: ScaleKey;
  studentId?: string | null;
  subjectId?: string | null;
  periodId?: string | null;
  teacherId?: string | null;
  categories: { id: string; name: string; weight: number }[];
  canAdd?: boolean;
  onAdded?: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => { if (!opened) setAddOpen(false); }, [opened]);

  const canShowAddButton = Boolean(
    canAdd && studentId && subjectId && periodId && teacherId && categories.length > 0,
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>Подробные оценки</Text>}
      centered
      size="lg"
    >
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {studentName} — {subjectName}
        </Text>
        {canShowAddButton && !addOpen && (
          <Button size="xs" variant="light" onClick={() => setAddOpen(true)}>
            + Добавить оценку
          </Button>
        )}
      </Group>

      {addOpen && canShowAddButton && (
        <Paper p="sm" withBorder radius="sm" mb="md">
          <AddGradeForm
            studentId={studentId!}
            subjectId={subjectId!}
            periodId={periodId!}
            teacherId={teacherId!}
            categories={categories}
            onCancel={() => setAddOpen(false)}
            onSuccess={() => {
              setAddOpen(false);
              onAdded?.();
            }}
          />
        </Paper>
      )}
      <Stack gap="sm">
        {grades.length === 0 ? (
          <Text size="sm" c="dimmed">Нет оценок</Text>
        ) : (
          grades.map((g) => {
            const gSourceKey = prismaScaleToKey(g.scale as PrismaScale | undefined);
            const gFive = (() => {
              if (gSourceKey === '5point') return Math.max(1, Math.min(5, Math.round(g.value)));
              const txt = displayInScale(g.value, gSourceKey, '5point');
              const n = parseInt(txt, 10);
              return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3;
            })();
            const gradeColors = GRADE_COLORS[gFive] || { bg: '#495057', color: '#fff' };
            const displayedValue = displayInScale(g.value, gSourceKey, scale);
            const statusInfo = (() => {
              switch (g.status) {
                case 'submitted': return { label: 'на модерации завуча', color: 'orange' as const };
                case 'moderated': return { label: 'утверждено завучем', color: 'blue' as const };
                case 'draft': return { label: 'черновик', color: 'gray' as const };
                case 'published': return null;
                default: return null;
              }
            })();
            const isModerated = g.status === 'submitted' || g.status === 'moderated';
            return (
              <Paper
                key={g.id}
                p="sm"
                radius="sm"
                withBorder
                style={isModerated ? {
                  borderColor: g.status === 'submitted' ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-blue-5)',
                  borderWidth: 2,
                } : undefined}
              >
                <Group justify="space-between" mb={4} wrap="nowrap">
                  <Group gap={8} wrap="nowrap">
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: gradeColors.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {displayedValue}
                    </Box>
                    <Text size="sm" fw={600}>{g.categoryName}</Text>
                    <Badge size="xs" variant="light" color="gray">вес: {g.weight}</Badge>
                    {statusInfo && (
                      <Badge size="xs" variant="light" color={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    )}
                  </Group>
                  <Group gap={6} wrap="nowrap">
                    {g.createdAt && <EditWindowBadge createdAt={g.createdAt} compact />}
                    <Text size="xs" c="dimmed">
                      {new Date(g.date).toLocaleDateString('ru-RU')}
                    </Text>
                  </Group>
                </Group>
                {g.comment && (
                  <Text size="xs" c="dimmed" mt={4} style={{ fontStyle: 'italic' }}>
                    «{g.comment}»
                  </Text>
                )}
              </Paper>
            );
          })
        )}
      </Stack>
    </Modal>
  );
}

/* ── Comments Popup Component ── */
function CommentsPopup({
  opened,
  onClose,
  studentName,
  subjectName,
  grades,
}: {
  opened: boolean;
  onClose: () => void;
  studentName: string;
  subjectName: string;
  grades: GradeDetail[];
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>Комментарии</Text>}
      centered
      size="md"
    >
      <Text size="sm" c="dimmed" mb="md">
        {studentName} - {subjectName}
      </Text>
      <Stack gap="sm">
        {grades.length === 0 ? (
          <Text size="sm" c="dimmed">Нет комментариев</Text>
        ) : (
          grades.map((g) => (
            <Paper
              key={g.id}
              p="sm"
              radius="sm"
              withBorder
            >
              <Group justify="space-between" mb={4}>
                <Group gap={8}>
                  <Box
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: GRADE_COLORS[Math.max(1, Math.min(5, g.value))]?.bg || '#495057',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {g.value}
                  </Box>
                  <Text size="xs" fw={600}>{g.categoryName}</Text>
                  <Text size="xs" c="dimmed">(вес: {g.weight})</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(g.date).toLocaleDateString('ru-RU')}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                Оценка {g.value} за {g.categoryName.toLowerCase()}
              </Text>
            </Paper>
          ))
        )}
      </Stack>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN GRADING PAGE
   ════════════════════════════════════════════════════════════════ */

import { RoleGate } from '@/shared/components/auth/RoleGate';

function GradingContent() {
  // ── Current user (teacherId/role) ──
  const { me } = useMe();
  const teacherId = me?.teacherId ?? null;
  const canAddGrades = me?.role === 'teacher' || me?.role === 'curator' || me?.role === 'super_admin' || me?.role === 'zavuch';
  // Завуч/аналитик/super_admin не ограничены 24-часовым окном — таймер для них не показываем
  const canBypassEditTimer = me?.role === 'zavuch' || me?.role === 'analyst' || me?.role === 'super_admin';

  // ── View mode ──
  const [viewMode, setViewMode] = useState<'overview' | 'journal'>('overview');

  // ── Overview state ──
  const [overviewClasses, setOverviewClasses] = useState<OverviewClass[]>([]);
  const [overviewPeriods, setOverviewPeriods] = useState<OverviewPeriod[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewLevelTab, setOverviewLevelTab] = useState('all');

  // ── Journal state ──
  const [journalData, setJournalData] = useState<JournalData | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [activeScale, setActiveScale] = useState<ScaleKey>('5point');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [antidvoikaEnabled, setAntidvoikaEnabled] = useState(false);
  const [checkedStudents, setCheckedStudents] = useState<Set<string>>(new Set());
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | null>('all');

  // ── Comments modal ──
  const [commentsModal, setCommentsModal] = useState(false);
  const [commentsStudent, setCommentsStudent] = useState<string>('');
  const [commentsSubject, setCommentsSubject] = useState<string>('');
  const [commentsGrades, setCommentsGrades] = useState<GradeDetail[]>([]);

  // ── Detail grades modal (arrow click) ──
  const [detailModal, setDetailModal] = useState(false);
  const [detailStudent, setDetailStudent] = useState<string>('');
  const [detailSubject, setDetailSubject] = useState<string>('');
  const [detailGrades, setDetailGrades] = useState<GradeDetail[]>([]);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [detailSubjectId, setDetailSubjectId] = useState<string | null>(null);

  // ── Categories (for grade entry) ──
  const [gradeCategories, setGradeCategories] = useState<{ id: string; name: string; weight: number }[]>([]);
  useEffect(() => {
    fetch('/api/v1/grading/categories')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setGradeCategories(j.data);
      })
      .catch(() => undefined);
  }, []);

  // ── Fetch overview data ──
  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch('/api/v1/grading/overview');
        const json = await res.json();
        if (json.success) {
          setOverviewClasses(json.data.classes);
          setOverviewPeriods(json.data.periods);
        }
      } catch (err) {
        console.error('Failed to fetch grading overview:', err);
      } finally {
        setOverviewLoading(false);
      }
    }
    fetchOverview();
  }, []);

  // ── Fetch journal data ──
  const fetchJournal = useCallback(async (classId: string, periodId?: string) => {
    setJournalLoading(true);
    try {
      let url = `/api/v1/grading/class-journal?classId=${classId}`;
      if (periodId) url += `&periodId=${periodId}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setJournalData(json.data);
        // Auto-select active period if not set
        if (!periodId && json.data.periods.length > 0) {
          const active = json.data.periods.find((p: JournalPeriod) => p.isActive);
          const chosen = active || json.data.periods[0];
          setSelectedPeriodId(chosen.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch journal:', err);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  // ── Refetch when period changes ──
  useEffect(() => {
    if (viewMode === 'journal' && selectedClassId && selectedPeriodId) {
      fetchJournal(selectedClassId, selectedPeriodId);
    }
  }, [selectedPeriodId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate to journal from a card ──
  function openJournal(classId: string) {
    setSelectedClassId(classId);
    setViewMode('journal');
    setCheckedStudents(new Set());
    setSelectedSubjectFilter('all');
    fetchJournal(classId);
  }

  // ── Back to overview ──
  function backToOverview() {
    setViewMode('overview');
    setSelectedClassId(null);
    setJournalData(null);
    setSelectedPeriodId(null);
  }

  // ── Toggle student checkbox ──
  function toggleStudent(studentId: string) {
    setCheckedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleAllStudents() {
    if (!journalData) return;
    if (checkedStudents.size === journalData.students.length) {
      setCheckedStudents(new Set());
    } else {
      setCheckedStudents(new Set(journalData.students.map((s) => s.id)));
    }
  }

  // ── Open comments popup ──
  function openComments(studentName: string, subjectName: string, grades: GradeDetail[]) {
    setCommentsStudent(studentName);
    setCommentsSubject(subjectName);
    setCommentsGrades(grades);
    setCommentsModal(true);
  }

  // ── Open detail grades modal ──
  function openDetailGrades(
    studentName: string,
    subjectName: string,
    grades: GradeDetail[],
    studentId?: string,
    subjectId?: string,
  ) {
    setDetailStudent(studentName);
    setDetailSubject(subjectName);
    setDetailGrades(grades);
    setDetailStudentId(studentId ?? null);
    setDetailSubjectId(subjectId ?? null);
    setDetailModal(true);
  }

  // ── Overview: filter and group classes ──
  const filteredOverviewClasses = useMemo(() => {
    return overviewClasses.filter((c) => levelTabMatch(c.level.name, overviewLevelTab));
  }, [overviewClasses, overviewLevelTab]);

  const groupedClasses = useMemo(() => {
    const groups: Record<number, OverviewClass[]> = {};
    for (const c of filteredOverviewClasses) {
      if (!groups[c.grade]) groups[c.grade] = [];
      groups[c.grade].push(c);
    }
    return groups;
  }, [filteredOverviewClasses]);

  const gradeNumbers = useMemo(() => {
    return Object.keys(groupedClasses).map(Number).sort((a, b) => a - b);
  }, [groupedClasses]);

  const levelSections = useMemo(() => {
    const sections: { label: string; subtitle: string; grades: number[] }[] = [];
    const nach = gradeNumbers.filter((g) => g >= 1 && g <= 4);
    const sred = gradeNumbers.filter((g) => g >= 5 && g <= 9);
    const star = gradeNumbers.filter((g) => g >= 10 && g <= 12);

    if (nach.length > 0 && (overviewLevelTab === 'all' || overviewLevelTab === 'nach')) {
      sections.push({ label: 'Начальные классы', subtitle: `${nach[0]} - ${nach[nach.length - 1]} класс`, grades: nach });
    }
    if (sred.length > 0 && (overviewLevelTab === 'all' || overviewLevelTab === 'sred')) {
      sections.push({ label: 'Средние классы', subtitle: `${sred[0]} - ${sred[sred.length - 1]} класс`, grades: sred });
    }
    if (star.length > 0 && (overviewLevelTab === 'all' || overviewLevelTab === 'star')) {
      sections.push({ label: 'Старшие классы', subtitle: `${star[0]} - ${star[star.length - 1]} класс`, grades: star });
    }
    return sections;
  }, [gradeNumbers, overviewLevelTab]);

  // ── Period options for journal ──
  const periodOptions = useMemo(() => {
    if (!journalData) return [];
    return journalData.periods.map((p) => ({ value: p.id, label: p.name }));
  }, [journalData]);

  // ── Subject filter options ──
  const subjectFilterOptions = useMemo(() => {
    if (!journalData) return [{ value: 'all', label: 'Все предметы' }];
    return [
      { value: 'all', label: 'Все предметы' },
      ...journalData.subjects.map((s) => ({ value: s.id, label: s.name })),
    ];
  }, [journalData]);

  // ── Filtered subjects ──
  const filteredSubjects = useMemo(() => {
    if (!journalData) return [];
    if (!selectedSubjectFilter || selectedSubjectFilter === 'all') return journalData.subjects;
    return journalData.subjects.filter((s) => s.id === selectedSubjectFilter);
  }, [journalData, selectedSubjectFilter]);

  // ── Filter grade data based on module selection ──
  const filteredStudents = useMemo(() => {
    if (!journalData) return [];
    if (moduleFilter === 'all') return journalData.students;

    return journalData.students.map((student) => {
      const newSubjectGrades: Record<string, SubjectGradeData> = {};
      for (const [subjId, data] of Object.entries(student.subjectGrades)) {
        const filtered = data.grades.filter((g) => {
          if (moduleFilter === 'formative') {
            return g.weight <= 3 || FORMATIVE_CATEGORIES.has(g.categoryName);
          }
          return g.weight >= 4 || SUMMATIVE_CATEGORIES.has(g.categoryName);
        });
        if (filtered.length > 0) {
          const sum = filtered.reduce((acc, g) => acc + g.value * g.weight, 0);
          const wTotal = filtered.reduce((acc, g) => acc + g.weight, 0);
          newSubjectGrades[subjId] = {
            average: wTotal > 0 ? sum / wTotal : 0,
            count: filtered.length,
            grades: filtered,
          };
        } else {
          newSubjectGrades[subjId] = { average: 0, count: 0, grades: [] };
        }
      }
      // Recompute overall average
      const avgs = Object.values(newSubjectGrades).filter((d) => d.count > 0).map((d) => d.average);
      const overallAverage = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
      return { ...student, subjectGrades: newSubjectGrades, overallAverage };
    });
  }, [journalData, moduleFilter]);

  // ── Handle module filter change — auto-switch scale ──
  function handleModuleFilterChange(value: string) {
    const v = value as ModuleFilter;
    setModuleFilter(v);
    if (v === 'formative') setActiveScale('12point');
    else if (v === 'summative') setActiveScale('100point');
    // 'all' keeps current scale
  }

  /* ════════════════════════════════════════════════════════════
     OVERVIEW MODE
     ════════════════════════════════════════════════════════════ */
  if (viewMode === 'overview') {
    return (
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap={8}>
            <IconStar size={24} color="#228be6" stroke={1.5} />
            <Title order={3} c={TEXT_PRIMARY}>Оценивание</Title>
          </Group>
          <Group gap={8}>
            <Button variant="light" leftSection={<IconEdit size={16} />} size="sm">
              Редактировать
            </Button>
            <Button variant="subtle" leftSection={<IconSettings size={16} />} size="sm" color="gray" component="a" href="/grading/categories">
              Настройки
            </Button>
          </Group>
        </Group>

        <Paper style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}`, padding: 16 }}>
          <Tabs value={overviewLevelTab} onChange={(v) => setOverviewLevelTab(v || 'all')} mb="md">
            <Tabs.List>
              {LEVEL_TABS.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>{tab.label}</Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </Paper>

        {overviewLoading ? (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader color="blue" />
          </Box>
        ) : filteredOverviewClasses.length === 0 ? (
          <Paper style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }} p="xl">
            <Text c={TEXT_SEC} ta="center">Нет классов для отображения</Text>
          </Paper>
        ) : (
          <Stack gap="xl">
            {levelSections.map((section) => (
              <Box key={section.label}>
                <Box mb="md">
                  <Text fw={700} size="lg" c={TEXT_PRIMARY}>{section.label}</Text>
                  <Text size="xs" c="dimmed">{section.subtitle}</Text>
                </Box>
                {section.grades.map((gradeNum) => (
                  <Box key={gradeNum} mb="lg">
                    <Text fw={600} size="sm" c={TEXT_PRIMARY} mb="sm" tt="uppercase">
                      {gradeNum} классы
                    </Text>
                    <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
                      {(groupedClasses[gradeNum] || []).map((cls) => (
                        <ClassCard key={cls.id} cls={cls} periods={overviewPeriods} onClick={() => openJournal(cls.id)} />
                      ))}
                    </SimpleGrid>
                  </Box>
                ))}
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  /* ════════════════════════════════════════════════════════════
     JOURNAL MODE
     ════════════════════════════════════════════════════════════ */
  const subjects = filteredSubjects;
  const students = filteredStudents;
  const classInfo = journalData?.classInfo;

  return (
    <Stack gap="md">
      {/* ── Zone 1: Stat Cards ── */}
      <ScrollArea type="auto" scrollbarSize={6}>
        <Group gap="md" wrap="nowrap" style={{ minWidth: 'max-content' }}>
          <StatCard title="ОТСУТСТВИЯ" value={54} change="12% ↗" changeDirection="up" changeText="По сравнению со вчерашним днем" />
          <StatCard title="ОПОЗДАНИЯ" value={12} change="4% ↘" changeDirection="down" changeText="По сравнению со вчерашним днем" />
          <StatCard title="ОБРАТНАЯ СВЯЗЬ С РОДИТЕЛЯМИ" value={12} change="4% ↘" changeDirection="down" changeText="По сравнению со вчерашним днем" />
          <StatCard title="ЕЖЕДНЕВНЫЕ ЗАМЕТКИ" value={12} change="4% ↘" changeDirection="down" changeText="По сравнению со вчерашним днем" />
          <StatCard title="УСПЕВАЕМОСТЬ ЗА МЕСЯЦ" value={12} change="4% ↘" changeDirection="down" changeText="По сравнению со вчерашним днем" />
          <CompareCard />
        </Group>
      </ScrollArea>

      {/* ── Zone 2: Class Journal ── */}
      <Paper
        p="lg"
        radius="md"
        style={{
          background: SURFACE,
          border: `1px solid ${SURFACE_BORDER}`,
        }}
      >
        {/* Class name + back button */}
        <Group mb="md" gap="md">
          <ActionIcon variant="subtle" color="gray" onClick={backToOverview} size="lg">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Box>
            <Group gap={4} align="baseline">
              <Text fw={700} style={{ fontSize: 48, lineHeight: 1 }} c={TEXT_PRIMARY}>
                {classInfo ? classInfo.grade : ''}
              </Text>
              <Text fw={700} style={{ fontSize: 32, lineHeight: 1, color: '#228be6' }}>
                {classInfo ? classInfo.letter.toUpperCase() : ''}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">класс</Text>
          </Box>
        </Group>

        {/* Filters row */}
        <Group gap="md" mb="lg" wrap="wrap">
          <Group gap={4}>
            <Text size="xs" c="dimmed">Период</Text>
            <Select
              data={periodOptions}
              value={selectedPeriodId}
              onChange={setSelectedPeriodId}
              size="xs"
              style={{ width: 160 }}
            />
          </Group>
          <Group gap={4}>
            <Text size="xs" c="dimmed">Группа</Text>
            <Select
              data={[{ value: 'a', label: 'А' }, { value: 'b', label: 'Б' }]}
              defaultValue="a"
              size="xs"
              style={{ width: 80 }}
            />
          </Group>
          <Group gap={4}>
            <Text size="xs" c="dimmed">Класс</Text>
            <Select
              data={overviewClasses.map((c) => ({ value: c.id, label: `${c.grade} ${c.letter.toUpperCase()}` }))}
              value={selectedClassId}
              onChange={(v) => {
                if (v) {
                  setSelectedClassId(v);
                  setSelectedPeriodId(null);
                  setSelectedSubjectFilter('all');
                  fetchJournal(v);
                }
              }}
              size="xs"
              style={{ width: 100 }}
            />
          </Group>
          <Group gap={4}>
            <Text size="xs" c="dimmed">Предметы</Text>
            <Select
              data={subjectFilterOptions}
              value={selectedSubjectFilter}
              onChange={setSelectedSubjectFilter}
              size="xs"
              style={{ width: 160 }}
            />
          </Group>
        </Group>

        {/* Heading + toggles */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Text fw={700} size="lg" c={TEXT_PRIMARY}>Список учеников</Text>
          <Group gap="md">
            <SegmentedControl
              value={moduleFilter}
              onChange={handleModuleFilterChange}
              data={[
                { label: 'Все оценки', value: 'all' },
                { label: 'Формативное', value: 'formative' },
                { label: 'Суммативное', value: 'summative' },
              ]}
              size="xs"
            />
            <Group gap={6} align="center">
              <Switch
                label="Антидвойка"
                size="xs"
                checked={antidvoikaEnabled}
                onChange={(e) => setAntidvoikaEnabled(e.currentTarget.checked)}
                styles={{ label: { fontSize: 12, fontWeight: 600 } }}
              />
            </Group>
            <Group gap={4}>
              {([
                { value: '5point' as ScaleKey, label: '5-балльная' },
                { value: '12point' as ScaleKey, label: '12-балльная' },
                { value: '100point' as ScaleKey, label: '100-балльная' },
                { value: 'af' as ScaleKey, label: 'A-F' },
              ]).map((scale) => (
                <Button
                  key={scale.value}
                  size="compact-xs"
                  variant={activeScale === scale.value ? 'filled' : 'outline'}
                  color={activeScale === scale.value ? SCALE_COLORS[scale.value] : 'gray'}
                  onClick={() => setActiveScale(scale.value)}
                  style={{ fontSize: 10, borderRadius: 4 }}
                >
                  {scale.label}
                </Button>
              ))}
            </Group>
          </Group>
        </Group>

        {/* Student Table */}
        {journalLoading ? (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader color="blue" />
          </Box>
        ) : students.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Нет учеников в этом классе</Text>
        ) : (
          <ScrollArea type="auto" scrollbarSize={8}>
            <Box style={{ minWidth: 800 }}>
              {/* Table header */}
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: `2px solid ${SURFACE_BORDER}`,
                  paddingBottom: 8,
                  marginBottom: 4,
                  gap: 0,
                }}
              >
                {/* Checkbox */}
                <Box style={{ width: 40, minWidth: 40, display: 'flex', justifyContent: 'center' }}>
                  <Checkbox
                    size="xs"
                    checked={checkedStudents.size === students.length && students.length > 0}
                    indeterminate={checkedStudents.size > 0 && checkedStudents.size < students.length}
                    onChange={toggleAllStudents}
                    styles={{ input: { cursor: 'pointer' } }}
                  />
                </Box>
                {/* # */}
                <Box style={{ width: 30, minWidth: 30, textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" fw={600}>#</Text>
                </Box>
                {/* Photo */}
                <Box style={{ width: 40, minWidth: 40 }} />
                {/* FIO + performance + stats area */}
                <Box style={{ minWidth: 340, flex: '0 0 340px' }}>
                  <Text size="xs" c="dimmed" fw={600}>ФИО</Text>
                </Box>
                {/* Subject columns */}
                {subjects.map((subj) => (
                  <Box key={subj.id} style={{ width: 100, minWidth: 100, textAlign: 'center' }}>
                    <Text size="xs" c="dimmed" fw={600} truncate>
                      {subj.name}
                    </Text>
                  </Box>
                ))}
              </Box>

              {/* Student rows */}
              {students.map((student, idx) => {
                const fullName = `${student.lastName} ${student.firstName}`;
                const perfColor = PERF_COLORS[student.performanceColor] || PERF_COLORS.gray;

                return (
                  <Box
                    key={student.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: `1px solid ${SURFACE_BORDER}`,
                      padding: '8px 0',
                      gap: 0,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = SURFACE_HOVER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <Box style={{ width: 40, minWidth: 40, display: 'flex', justifyContent: 'center' }}>
                      <Checkbox
                        size="xs"
                        checked={checkedStudents.has(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                    </Box>
                    {/* Number */}
                    <Box style={{ width: 30, minWidth: 30, textAlign: 'center' }}>
                      <Text size="xs" c="dimmed">{idx + 1}</Text>
                    </Box>
                    {/* Avatar */}
                    <Box style={{ width: 40, minWidth: 40, display: 'flex', justifyContent: 'center' }}>
                      <Avatar
                        src={student.photo}
                        size={32}
                        radius="xl"
                        color="blue"
                      >
                        {student.firstName[0]}{student.lastName[0]}
                      </Avatar>
                    </Box>
                    {/* Name + performance + attendance */}
                    <Box style={{ minWidth: 340, flex: '0 0 340px', paddingRight: 8 }}>
                      <Group gap={6} wrap="nowrap" mb={2}>
                        {/* Performance badge */}
                        <Badge
                          size="xs"
                          radius="sm"
                          style={{
                            backgroundColor: perfColor.bg,
                            color: perfColor.color,
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}
                        >
                          {student.performanceLevel}
                        </Badge>
                        {/* Name badge */}
                        <Badge
                          size="sm"
                          radius="sm"
                          variant="light"
                          color="gray"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {fullName}
                        </Badge>
                      </Group>
                      <Group gap={12}>
                        <Text size="xs" c="dimmed">
                          Опоздание: <Text span c={TEXT_PRIMARY} fw={600}>{student.lates}</Text>
                        </Text>
                        <Text size="xs" c="dimmed">
                          Пропуски: <Text span c={TEXT_PRIMARY} fw={600}>{student.absences}</Text>
                        </Text>
                      </Group>
                    </Box>
                    {/* Subject grade cells */}
                    {subjects.map((subj) => {
                      const data = student.subjectGrades[subj.id];
                      if (!data || data.count === 0) {
                        return (
                          <Box key={subj.id} style={{ width: 100, minWidth: 100, textAlign: 'center' }}>
                            <Text size="xs" c="dimmed">--</Text>
                          </Box>
                        );
                      }

                      const avg = data.average;
                      const rounded = Math.round(avg);
                      const clamped = Math.max(1, Math.min(5, rounded));
                      const colors = GRADE_COLORS[clamped];
                      const displayValue = displayGradeInScale(avg, activeScale);
                      const isLowGrade = avg > 0 && avg < 3;
                      const needsRetake = avg > 0 && avg <= 2;

                      // Audit/timer indicators (по ТЗ)
                      const HOUR = 60 * 60 * 1000;
                      const now = Date.now();
                      const hasPendingMod = data.grades.some(
                        (g) => g.status === 'submitted' || g.status === 'moderated',
                      );
                      const hasRecentEdit = data.grades.some(
                        (g) => g.updatedAt && g.createdAt &&
                          new Date(g.updatedAt).getTime() - new Date(g.createdAt).getTime() > 60_000,
                      );
                      const within24h = data.grades
                        .map((g) => g.createdAt ? new Date(g.createdAt).getTime() : 0)
                        .filter((t) => t > 0 && now - t < 24 * HOUR);
                      const hasFreshGrade = within24h.length > 0;
                      const minHoursLeft = hasFreshGrade
                        ? Math.max(0, Math.floor(24 - (now - Math.max(...within24h)) / HOUR))
                        : 0;
                      const frameStyle: React.CSSProperties = hasPendingMod
                        ? { boxShadow: '0 0 0 2px var(--mantine-color-orange-5)', borderRadius: '50%' }
                        : hasRecentEdit
                          ? { boxShadow: '0 0 0 2px var(--mantine-color-blue-5)', borderRadius: '50%' }
                          : {};

                      return (
                        <Box
                          key={subj.id}
                          style={{
                            width: 100,
                            minWidth: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          {/* Grade circle with arrow */}
                          <Group gap={4} wrap="nowrap">
                            <Tooltip
                              label={
                                hasPendingMod
                                  ? `На модерации. Средний: ${avg.toFixed(2)}`
                                  : hasRecentEdit
                                    ? `Изменено завучем/аналитиком. Средний: ${avg.toFixed(2)}`
                                    : `Средний: ${avg.toFixed(2)}`
                              }
                              withArrow
                              position="top"
                            >
                              <Box
                                onClick={antidvoikaEnabled && needsRetake ? () => {
                                  notifications.show({
                                    color: 'orange',
                                    title: 'Пересдача',
                                    message: `Пересдача назначена для ${fullName} по ${subj.name}`,
                                  });
                                } : undefined}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  backgroundColor: colors.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: colors.color,
                                  fontSize: activeScale === '100point' ? 10 : 14,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  position: 'relative',
                                  cursor: (antidvoikaEnabled && needsRetake) ? 'pointer' : 'default',
                                  ...frameStyle,
                                  ...(antidvoikaEnabled && isLowGrade ? {
                                    border: '2px solid #fa5252',
                                    boxShadow: '0 0 8px rgba(250, 82, 82, 0.6)',
                                    animation: 'antidvoika-pulse 1.5s ease-in-out infinite',
                                  } : {}),
                                }}
                              >
                                {displayValue}
                                {hasFreshGrade && !canBypassEditTimer && (
                                  <Box
                                    title={`Можно править ещё ${minHoursLeft}ч`}
                                    style={{
                                      position: 'absolute',
                                      top: -4,
                                      right: -4,
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      background: minHoursLeft < 2 ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-blue-6)',
                                      color: '#fff',
                                      fontSize: 8,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    {minHoursLeft}
                                  </Box>
                                )}
                              </Box>
                            </Tooltip>
                            {antidvoikaEnabled && needsRetake ? (
                              <Tooltip label="Назначить пересдачу" withArrow position="top">
                                <Badge
                                  size="xs"
                                  color="red"
                                  variant="filled"
                                  style={{ fontSize: 8, cursor: 'pointer', padding: '0 4px' }}
                                  onClick={() => {
                                    notifications.show({
                                      color: 'orange',
                                      title: 'Пересдача',
                                      message: `Пересдача назначена для ${fullName} по ${subj.name}`,
                                    });
                                  }}
                                >
                                  <Group gap={2} wrap="nowrap">
                                    <IconRefresh size={8} />
                                    <span>Пересдача</span>
                                  </Group>
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Text
                                size="xs"
                                c="dimmed"
                                style={{ fontSize: 10, cursor: 'pointer' }}
                                onClick={() => openDetailGrades(fullName, subj.name, data.grades, student.id, subj.id)}
                              >
                                →
                              </Text>
                            )}
                          </Group>
                          {/* Count + comment icon */}
                          <Group gap={4} wrap="nowrap">
                            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                              {data.count} р.
                            </Text>
                            <ActionIcon
                              variant="transparent"
                              size="xs"
                              color="gray"
                              onClick={() => openComments(fullName, subj.name, data.grades)}
                              style={{ cursor: 'pointer' }}
                            >
                              <IconMessage size={12} />
                            </ActionIcon>
                          </Group>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}

              {/* Summary footer */}
              {students.length > 0 && (
                <Box
                  style={{
                    display: 'flex',
                    padding: '12px 16px',
                    borderTop: `2px solid ${SURFACE_BORDER}`,
                    gap: 24,
                    marginTop: 4,
                  }}
                >
                  <Text size="xs" c="dimmed">
                    Учеников: <Text span fw={600} c={TEXT_PRIMARY}>{students.length}</Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    Предметов: <Text span fw={600} c={TEXT_PRIMARY}>{subjects.length}</Text>
                  </Text>
                  {students.filter((s) => s.overallAverage > 0).length > 0 && (
                    <Text size="xs" c="dimmed">
                      Средний балл:{' '}
                      <Text span fw={600} c="#228be6">
                        {displayAverageInScale(
                          students.reduce((sum, s) => sum + s.overallAverage, 0) /
                          students.filter((s) => s.overallAverage > 0).length,
                          activeScale,
                        )}
                      </Text>
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          </ScrollArea>
        )}
      </Paper>

      {/* Comments popup */}
      <CommentsPopup
        opened={commentsModal}
        onClose={() => setCommentsModal(false)}
        studentName={commentsStudent}
        subjectName={commentsSubject}
        grades={commentsGrades}
      />

      {/* Detail grades modal */}
      <DetailGradesModal
        opened={detailModal}
        onClose={() => setDetailModal(false)}
        studentName={detailStudent}
        subjectName={detailSubject}
        grades={detailGrades}
        scale={activeScale}
        studentId={detailStudentId}
        subjectId={detailSubjectId}
        periodId={selectedPeriodId}
        teacherId={teacherId}
        categories={gradeCategories}
        canAdd={canAddGrades}
        onAdded={() => {
          if (selectedClassId) fetchJournal(selectedClassId, selectedPeriodId ?? undefined);
        }}
      />
    </Stack>
  );
}

export default function GradingPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']}>
      <GradingContent />
    </RoleGate>
  );
}
