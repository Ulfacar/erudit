'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Grid,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBook2,
  IconCalendarStats,
  IconCertificate,
  IconChartBar,
  IconFileText,
  IconHeartbeat,
  IconPlus,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';

/* ── Colors ── */
const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';
const TEXT_DIM = '#5c5f66';

/* ── Types ── */
interface GradeEntry {
  id: string;
  value: number;
  weight: number;
  categoryName: string;
  date: string;
  periodName: string;
  teacherName: string;
  status: string;
}

interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  grades: GradeEntry[];
  weightedAverage: number;
}

interface StudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  dateOfBirth: string | null;
  photo: string | null;
  status: 'permanent' | 'conditional' | 'repeating';
  enrolledAt: string;
  class: {
    grade: number;
    letter: string;
    level: { name: string };
    curator: { firstName: string; lastName: string } | null;
  };
  parentLinks: {
    relation: string;
    parent: { firstName: string; lastName: string; phone: string | null };
  }[];
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  familyData: FamilyData | null;
  medicalData: MedicalData | null;
}

interface FamilyData {
  mother: { fullName: string; phone: string; education: string; profession: string };
  father: { fullName: string; phone: string; education: string; profession: string };
  siblings: { fullName: string; age: string; school: string }[];
  authorizedPickup: { fullName: string; relation: string; phone: string }[];
  interests: string;
  strengths: string;
  weaknesses: string;
}

interface MedicalData {
  drugAllergies: string;
  foodReactions: string[];
  chronicDiseases: string;
  vision: string;
  hearing: string;
  gastrointestinal: string;
  cardiovascular: string;
  cns: string;
  speechTherapist: boolean;
  speechTherapistAge: string;
  sleepFeatures: string;
  behaviorFeatures: string;
}

interface BehaviorIncident {
  id: string;
  studentId: string;
  reporterId: string;
  type: string;
  description: string;
  status: 'pending' | 'moderated' | 'resolved';
  moderatedBy: string | null;
  moderatedAt: string | null;
  parentNotified: boolean;
  createdAt: string;
}

/* ── Status config ── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  permanent: { label: 'Постоянный', color: '#40c057', bg: 'rgba(64,192,87,0.15)' },
  conditional: { label: 'Условное', color: '#fab005', bg: 'rgba(250,176,5,0.15)' },
  repeating: { label: 'Повторное', color: '#fd7e14', bg: 'rgba(253,126,20,0.15)' },
};

const INCIDENT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Ожидает', color: '#fa5252', bg: 'rgba(250,82,82,0.15)' },
  moderated: { label: 'Проверен', color: '#228be6', bg: 'rgba(34,139,230,0.15)' },
  resolved: { label: 'Решён', color: '#40c057', bg: 'rgba(64,192,87,0.15)' },
};

const INCIDENT_TYPES = [
  { value: 'aggression', label: 'Агрессия' },
  { value: 'rudeness', label: 'Грубость' },
  { value: 'bullying', label: 'Буллинг' },
  { value: 'disruption', label: 'Нарушение дисциплины' },
  { value: 'cheating', label: 'Списывание' },
  { value: 'property_damage', label: 'Порча имущества' },
  { value: 'other', label: 'Другое' },
];

const FOOD_REACTIONS_LIST = [
  'Соль', 'Сладкое', 'Орехи', 'Молочные', 'Яйца', 'Мясо', 'Морепродукты', 'Фрукты',
];

const HEALTH_OPTIONS = [
  { value: 'норма', label: 'Норма' },
  { value: 'нарушение', label: 'Нарушение' },
];

/* ── Grade color ── */
function gradeColor(value: number): string {
  if (value >= 5) return '#40c057';
  if (value >= 4) return '#228be6';
  if (value >= 3) return '#fab005';
  return '#fa5252';
}

function gradeBg(value: number): string {
  if (value >= 5) return 'rgba(64,192,87,0.15)';
  if (value >= 4) return 'rgba(34,139,230,0.15)';
  if (value >= 3) return 'rgba(250,176,5,0.15)';
  return 'rgba(250,82,82,0.15)';
}

/* ── Helpers ── */
function formatClassName(cls: { grade: number; letter: string }): string {
  return `${cls.grade}${cls.letter}`.toUpperCase();
}

function yearsInSchool(enrolledAt: string): number {
  const enrolled = new Date(enrolledAt);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - enrolled.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Table cell styles ── */
const thStyle: React.CSSProperties = {
  color: TEXT_SEC,
  fontSize: 12,
  fontWeight: 600,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  padding: '8px 12px',
  background: 'transparent',
};

const tdStyle: React.CSSProperties = {
  color: 'var(--mantine-color-text)',
  fontSize: 13,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  padding: '8px 12px',
};

/* ── Default data factories ── */
function defaultFamilyData(): FamilyData {
  return {
    mother: { fullName: '', phone: '', education: '', profession: '' },
    father: { fullName: '', phone: '', education: '', profession: '' },
    siblings: [],
    authorizedPickup: [],
    interests: '',
    strengths: '',
    weaknesses: '',
  };
}

function defaultMedicalData(): MedicalData {
  return {
    drugAllergies: '',
    foodReactions: [],
    chronicDiseases: '',
    vision: 'норма',
    hearing: 'норма',
    gastrointestinal: 'норма',
    cardiovascular: 'норма',
    cns: 'норма',
    speechTherapist: false,
    speechTherapistAge: '',
    sleepFeatures: '',
    behaviorFeatures: '',
  };
}

/* ── Styled card ── */
function Card({ children, ...style }: { children: React.ReactNode } & React.CSSProperties) {
  return (
    <Box
      style={{
        background: '#fbfcfd',
        borderRadius: 6,
        border: `1px solid ${SURFACE_BORDER}`,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

/* ── Star badge ── */
function StarBadge({ level }: { level: number }) {
  const stars = Array.from({ length: level }, () => '\u2B50').join('');
  return (
    <Badge
      variant="light"
      color="yellow"
      size="sm"
      radius="sm"
      style={{ fontFamily: 'inherit' }}
    >
      {'Доступ: ' + stars}
    </Badge>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [grades, setGrades] = useState<SubjectGrades[]>([]);
  const [incidents, setIncidents] = useState<BehaviorIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('grades');

  // Family form state
  const [familyForm, setFamilyForm] = useState<FamilyData>(defaultFamilyData());
  const [familySaving, setFamilySaving] = useState(false);

  // Medical form state
  const [medicalForm, setMedicalForm] = useState<MedicalData>(defaultMedicalData());
  const [medicalSaving, setMedicalSaving] = useState(false);

  // Incident modal
  const [incidentModalOpened, { open: openIncidentModal, close: closeIncidentModal }] = useDisclosure(false);
  const [newIncidentType, setNewIncidentType] = useState<string | null>(null);
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [incidentSaving, setIncidentSaving] = useState(false);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/students/${studentId}/incidents`);
      const json = await res.json();
      if (json.success) setIncidents(json.data);
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    }
  }, [studentId]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [studentRes, gradesRes] = await Promise.all([
          fetch(`/api/v1/students/${studentId}`),
          fetch(`/api/v1/students/${studentId}/grades`),
        ]);

        const studentJson = await studentRes.json();
        const gradesJson = await gradesRes.json();

        if (studentJson.success) {
          setStudent(studentJson.data);
          if (studentJson.data.familyData) {
            setFamilyForm({ ...defaultFamilyData(), ...studentJson.data.familyData });
          }
          if (studentJson.data.medicalData) {
            setMedicalForm({ ...defaultMedicalData(), ...studentJson.data.medicalData });
          }
        }
        if (gradesJson.success) setGrades(gradesJson.data);
      } catch (err) {
        console.error('Failed to fetch student data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    fetchIncidents();
  }, [studentId, fetchIncidents]);

  /* ── Save family data ── */
  async function saveFamilyData() {
    setFamilySaving(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyData: familyForm }),
      });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Сохранено', message: 'Анкета обновлена', color: 'green' });
      } else {
        notifications.show({ title: 'Ошибка', message: json.error?.message || 'Не удалось сохранить', color: 'red' });
      }
    } catch {
      notifications.show({ title: 'Ошибка', message: 'Не удалось сохранить анкету', color: 'red' });
    } finally {
      setFamilySaving(false);
    }
  }

  /* ── Save medical data ── */
  async function saveMedicalData() {
    setMedicalSaving(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicalData: medicalForm }),
      });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Сохранено', message: 'Медкарта обновлена', color: 'green' });
      } else {
        notifications.show({ title: 'Ошибка', message: json.error?.message || 'Не удалось сохранить', color: 'red' });
      }
    } catch {
      notifications.show({ title: 'Ошибка', message: 'Не удалось сохранить медкарту', color: 'red' });
    } finally {
      setMedicalSaving(false);
    }
  }

  /* ── Create incident ── */
  async function createIncident() {
    if (!newIncidentType || !newIncidentDesc.trim()) return;
    setIncidentSaving(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newIncidentType, description: newIncidentDesc }),
      });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Создано', message: 'Инцидент добавлен', color: 'green' });
        closeIncidentModal();
        setNewIncidentType(null);
        setNewIncidentDesc('');
        fetchIncidents();
      } else {
        notifications.show({ title: 'Ошибка', message: json.error?.message || 'Не удалось создать', color: 'red' });
      }
    } catch {
      notifications.show({ title: 'Ошибка', message: 'Не удалось создать инцидент', color: 'red' });
    } finally {
      setIncidentSaving(false);
    }
  }

  /* ── Moderate incident ── */
  async function moderateIncident(incidentId: string, status: string) {
    try {
      const res = await fetch(`/api/v1/students/${studentId}/incidents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId, status }),
      });
      const json = await res.json();
      if (json.success) {
        notifications.show({ title: 'Обновлено', message: 'Статус изменён', color: 'green' });
        fetchIncidents();
      }
    } catch {
      notifications.show({ title: 'Ошибка', message: 'Не удалось обновить статус', color: 'red' });
    }
  }

  if (loading) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c={TEXT_SEC}>Загрузка...</Text>
      </Box>
    );
  }

  if (!student) {
    return (
      <Stack align="center" gap="md" p="xl">
        <Text c={TEXT_SEC} size="lg">Ученик не найден</Text>
        <Button variant="subtle" onClick={() => router.push('/students')}>
          Вернуться к списку
        </Button>
      </Stack>
    );
  }

  const statusCfg = STATUS_MAP[student.status] || STATUS_MAP.permanent;
  const fullName = [student.lastName, student.firstName, student.middleName]
    .filter(Boolean)
    .join(' ');
  const initials = `${student.firstName[0]}${student.lastName[0]}`;
  const years = yearsInSchool(student.enrolledAt);

  return (
    <Stack gap="md">
      {/* Back button */}
      <Button
        variant="subtle"
        color="gray"
        size="sm"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => router.push('/students')}
        style={{ alignSelf: 'flex-start' }}
      >
        Назад к списку
      </Button>

      {/* Profile header */}
      <Box
        style={{
          background: SURFACE,
          borderRadius: 6,
          border: `1px solid ${SURFACE_BORDER}`,
          padding: 24,
        }}
      >
        <Group gap="lg" align="flex-start">
          <Avatar size={80} radius="xl" color="eruditBlue" variant="filled" style={{ fontSize: 28 }}>
            {initials}
          </Avatar>

          <Stack gap={4} style={{ flex: 1 }}>
            <Title order={3} c="var(--mantine-color-text)">
              {fullName}
            </Title>

            <Group gap="sm">
              <Badge variant="light" color="blue" size="md" radius="sm">
                {formatClassName(student.class)} класс
              </Badge>
              <Badge
                size="md"
                radius="sm"
                variant="filled"
                style={{
                  backgroundColor: statusCfg.bg,
                  color: statusCfg.color,
                  fontWeight: 500,
                }}
              >
                {statusCfg.label}
              </Badge>
            </Group>

            <Group gap="xl" mt={8}>
              <Box>
                <Text size="xs" c={TEXT_DIM}>Дата рождения</Text>
                <Text size="sm" c="var(--mantine-color-text)">{formatDate(student.dateOfBirth)}</Text>
              </Box>
              <Box>
                <Text size="xs" c={TEXT_DIM}>Ступень</Text>
                <Text size="sm" c="var(--mantine-color-text)">{student.class.level.name}</Text>
              </Box>
              {student.class.curator && (
                <Box>
                  <Text size="xs" c={TEXT_DIM}>Куратор</Text>
                  <Text size="sm" c="var(--mantine-color-text)">
                    {student.class.curator.lastName} {student.class.curator.firstName}
                  </Text>
                </Box>
              )}
              <Box>
                <Text size="xs" c={TEXT_DIM}>В школе</Text>
                <Text size="sm" c="var(--mantine-color-text)">
                  Учится в Bilim OS {years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}
                </Text>
              </Box>
            </Group>

            {/* Parents */}
            {student.parentLinks.length > 0 && (
              <Box mt={8}>
                <Text size="xs" c={TEXT_DIM} mb={4}>Родители</Text>
                <Group gap="md">
                  {student.parentLinks.map((pl, i) => (
                    <Text key={i} size="sm" c="var(--mantine-color-text)">
                      {pl.parent.lastName} {pl.parent.firstName} ({pl.relation})
                      {pl.parent.phone && ` \u2014 ${pl.parent.phone}`}
                    </Text>
                  ))}
                </Group>
              </Box>
            )}
          </Stack>
        </Group>
      </Box>

      {/* Tabs */}
      <Box
        style={{
          background: SURFACE,
          borderRadius: 6,
          border: `1px solid ${SURFACE_BORDER}`,
          padding: 16,
        }}
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md" style={{ flexWrap: 'wrap' }}>
            <Tabs.Tab value="grades" leftSection={<IconBook2 size={16} />}>
              Оценки
            </Tabs.Tab>
            <Tabs.Tab value="attendance" leftSection={<IconCalendarStats size={16} />}>
              Посещаемость
            </Tabs.Tab>
            <Tabs.Tab value="questionnaire" leftSection={<IconUsers size={16} />}>
              Анкета
            </Tabs.Tab>
            <Tabs.Tab value="medical" leftSection={<IconHeartbeat size={16} />}>
              Медицина
            </Tabs.Tab>
            <Tabs.Tab value="behavior" leftSection={<IconAlertTriangle size={16} />}>
              Поведение
            </Tabs.Tab>
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Аналитика
            </Tabs.Tab>
            <Tabs.Tab value="portfolio" leftSection={<IconCertificate size={16} />}>
              Портфолио
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              Документы
            </Tabs.Tab>
          </Tabs.List>

          {/* ── Grades tab ── */}
          <Tabs.Panel value="grades">
            {grades.length === 0 ? (
              <Box p="lg" style={{ textAlign: 'center' }}>
                <Text c={TEXT_SEC}>Оценок пока нет</Text>
              </Box>
            ) : (
              <Stack gap="md">
                {grades.map((subject) => (
                  <Box
                    key={subject.subjectId}
                    style={{
                      background: '#fbfcfd',
                      borderRadius: 6,
                      border: `1px solid ${SURFACE_BORDER}`,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      style={{
                        borderLeft: `4px solid ${subject.subjectColor || '#228be6'}`,
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text fw={600} size="sm" c="var(--mantine-color-text)">
                        {subject.subjectName}
                      </Text>
                      <Group gap={8}>
                        <Text size="xs" c={TEXT_SEC}>Средний балл:</Text>
                        <Badge
                          size="lg"
                          radius="sm"
                          variant="filled"
                          style={{
                            backgroundColor: gradeBg(subject.weightedAverage),
                            color: gradeColor(subject.weightedAverage),
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {subject.weightedAverage.toFixed(2)}
                        </Badge>
                      </Group>
                    </Box>

                    <Box style={{ overflowX: 'auto' }}>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={thStyle}>Категория</Table.Th>
                            <Table.Th style={thStyle}>Оценка</Table.Th>
                            <Table.Th style={thStyle}>Вес</Table.Th>
                            <Table.Th style={thStyle}>Дата</Table.Th>
                            <Table.Th style={thStyle}>Учитель</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {subject.grades.map((g) => (
                            <Table.Tr key={g.id}>
                              <Table.Td style={tdStyle}>{g.categoryName}</Table.Td>
                              <Table.Td style={tdStyle}>
                                <Badge
                                  size="md"
                                  radius="sm"
                                  variant="filled"
                                  style={{
                                    backgroundColor: gradeBg(g.value),
                                    color: gradeColor(g.value),
                                    fontWeight: 700,
                                    minWidth: 32,
                                  }}
                                >
                                  {g.value}
                                </Badge>
                              </Table.Td>
                              <Table.Td style={tdStyle}>
                                <Text size="xs" c={TEXT_SEC}>x{g.weight}</Text>
                              </Table.Td>
                              <Table.Td style={tdStyle}>{formatDate(g.date)}</Table.Td>
                              <Table.Td style={tdStyle}>
                                <Text size="xs" c={TEXT_SEC}>{g.teacherName}</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          {/* ── Attendance tab ── */}
          <Tabs.Panel value="attendance">
            <Box p="lg">
              <Group gap="xl" mb="md">
                <StatBox label="Всего записей" value={student.attendanceSummary.total} color="#228be6" />
                <StatBox label="Присутствовал" value={student.attendanceSummary.present} color="#40c057" />
                <StatBox label="Отсутствовал" value={student.attendanceSummary.absent} color="#fa5252" />
                <StatBox label="Опоздал" value={student.attendanceSummary.late} color="#fab005" />
                <StatBox label="Уважительная" value={student.attendanceSummary.excused} color="#909296" />
              </Group>
              {student.attendanceSummary.total === 0 && (
                <Text c={TEXT_SEC} ta="center">Данных о посещаемости пока нет</Text>
              )}
            </Box>
          </Tabs.Panel>

          {/* ══════════════════════════════════════════════
               Story 2.1: QUESTIONNAIRE TAB (Анкета)
             ══════════════════════════════════════════════ */}
          <Tabs.Panel value="questionnaire">
            <Stack gap="md" p="md">
              <Group justify="space-between">
                <Title order={5} c="var(--mantine-color-text)">Анкета семьи</Title>
                <StarBadge level={4} />
              </Group>

              {/* Mother */}
              <Card>
                <Text fw={600} size="sm" c="var(--mantine-color-text)" mb="sm">Мать</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="ФИО"
                      value={familyForm.mother.fullName}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, mother: { ...f.mother, fullName: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Телефон"
                      value={familyForm.mother.phone}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, mother: { ...f.mother, phone: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Образование"
                      value={familyForm.mother.education}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, mother: { ...f.mother, education: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Профессия"
                      value={familyForm.mother.profession}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, mother: { ...f.mother, profession: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                </Grid>
              </Card>

              {/* Father */}
              <Card>
                <Text fw={600} size="sm" c="var(--mantine-color-text)" mb="sm">Отец</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="ФИО"
                      value={familyForm.father.fullName}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, father: { ...f.father, fullName: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Телефон"
                      value={familyForm.father.phone}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, father: { ...f.father, phone: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Образование"
                      value={familyForm.father.education}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, father: { ...f.father, education: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Профессия"
                      value={familyForm.father.profession}
                      onChange={(e) => setFamilyForm((f) => ({
                        ...f, father: { ...f.father, profession: e.currentTarget.value },
                      }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                </Grid>
              </Card>

              {/* Siblings */}
              <Card>
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="sm" c="var(--mantine-color-text)">Братья / сёстры</Text>
                  {familyForm.siblings.length < 5 && (
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => setFamilyForm((f) => ({
                        ...f, siblings: [...f.siblings, { fullName: '', age: '', school: '' }],
                      }))}
                    >
                      Добавить
                    </Button>
                  )}
                </Group>
                <Stack gap="xs">
                  {familyForm.siblings.map((sib, idx) => (
                    <Group key={idx} gap="xs" align="flex-end">
                      <TextInput
                        label="ФИО"
                        value={sib.fullName}
                        onChange={(e) => {
                          const siblings = [...familyForm.siblings];
                          siblings[idx] = { ...siblings[idx], fullName: e.currentTarget.value };
                          setFamilyForm((f) => ({ ...f, siblings }));
                        }}
                        style={{ flex: 1 }}
                        styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                      />
                      <TextInput
                        label="Возраст"
                        value={sib.age}
                        onChange={(e) => {
                          const siblings = [...familyForm.siblings];
                          siblings[idx] = { ...siblings[idx], age: e.currentTarget.value };
                          setFamilyForm((f) => ({ ...f, siblings }));
                        }}
                        w={80}
                        styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                      />
                      <TextInput
                        label="Школа"
                        value={sib.school}
                        onChange={(e) => {
                          const siblings = [...familyForm.siblings];
                          siblings[idx] = { ...siblings[idx], school: e.currentTarget.value };
                          setFamilyForm((f) => ({ ...f, siblings }));
                        }}
                        style={{ flex: 1 }}
                        styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          const siblings = familyForm.siblings.filter((_, i) => i !== idx);
                          setFamilyForm((f) => ({ ...f, siblings }));
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  ))}
                  {familyForm.siblings.length === 0 && (
                    <Text size="xs" c={TEXT_DIM}>Нет записей</Text>
                  )}
                </Stack>
              </Card>

              {/* Authorized pickup */}
              <Card>
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="sm" c="var(--mantine-color-text)">Кто может забирать ребёнка</Text>
                  {familyForm.authorizedPickup.length < 3 && (
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => setFamilyForm((f) => ({
                        ...f, authorizedPickup: [...f.authorizedPickup, { fullName: '', relation: '', phone: '' }],
                      }))}
                    >
                      Добавить
                    </Button>
                  )}
                </Group>
                <Stack gap="xs">
                  {familyForm.authorizedPickup.map((person, idx) => (
                    <Group key={idx} gap="xs" align="flex-end">
                      <TextInput
                        label="ФИО"
                        value={person.fullName}
                        onChange={(e) => {
                          const list = [...familyForm.authorizedPickup];
                          list[idx] = { ...list[idx], fullName: e.currentTarget.value };
                          setFamilyForm((f) => ({ ...f, authorizedPickup: list }));
                        }}
                        style={{ flex: 1 }}
                        styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                      />
                      <TextInput
                        label="Кем приходится"
                        value={person.relation}
                        onChange={(e) => {
                          const list = [...familyForm.authorizedPickup];
                          list[idx] = { ...list[idx], relation: e.currentTarget.value };
                          setFamilyForm((f) => ({ ...f, authorizedPickup: list }));
                        }}
                        w={160}
                        styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                      />
                      <TextInput
                        label="Телефон"
                        value={person.phone}
                        onChange={(e) => {
                          const list = [...familyForm.authorizedPickup];
                          list[idx] = { ...list[idx], phone: e.currentTarget.value };
                          setFamilyForm((f) => ({ ...f, authorizedPickup: list }));
                        }}
                        w={160}
                        styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          const list = familyForm.authorizedPickup.filter((_, i) => i !== idx);
                          setFamilyForm((f) => ({ ...f, authorizedPickup: list }));
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  ))}
                  {familyForm.authorizedPickup.length === 0 && (
                    <Text size="xs" c={TEXT_DIM}>Нет записей</Text>
                  )}
                </Stack>
              </Card>

              {/* Interests / strengths / weaknesses */}
              <Card>
                <Stack gap="sm">
                  <Textarea
                    label="Интересы, увлечения"
                    value={familyForm.interests}
                    onChange={(e) => setFamilyForm((f) => ({ ...f, interests: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                  <Textarea
                    label="Сильные стороны"
                    value={familyForm.strengths}
                    onChange={(e) => setFamilyForm((f) => ({ ...f, strengths: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                  <Textarea
                    label="Слабые стороны"
                    value={familyForm.weaknesses}
                    onChange={(e) => setFamilyForm((f) => ({ ...f, weaknesses: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                </Stack>
              </Card>

              <Button onClick={saveFamilyData} loading={familySaving} style={{ alignSelf: 'flex-end' }}>
                Сохранить анкету
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* ══════════════════════════════════════════════
               Story 2.2: MEDICAL TAB (Медицина)
             ══════════════════════════════════════════════ */}
          <Tabs.Panel value="medical">
            <Stack gap="md" p="md">
              <Group justify="space-between">
                <Title order={5} c="var(--mantine-color-text)">Медицинская карта</Title>
                <StarBadge level={3} />
              </Group>

              <Card>
                <Stack gap="sm">
                  <Textarea
                    label="Аллергии на медикаменты"
                    value={medicalForm.drugAllergies}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, drugAllergies: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                </Stack>
              </Card>

              <Card>
                <Text fw={600} size="sm" c="var(--mantine-color-text)" mb="sm">Пищевые реакции</Text>
                <Group gap="md">
                  {FOOD_REACTIONS_LIST.map((item) => (
                    <Checkbox
                      key={item}
                      label={item}
                      checked={medicalForm.foodReactions.includes(item)}
                      onChange={(e) => {
                        setMedicalForm((f) => ({
                          ...f,
                          foodReactions: e.currentTarget.checked
                            ? [...f.foodReactions, item]
                            : f.foodReactions.filter((r) => r !== item),
                        }));
                      }}
                      styles={{ label: { color: 'var(--mantine-color-text)' } }}
                    />
                  ))}
                </Group>
              </Card>

              <Card>
                <Stack gap="sm">
                  <Textarea
                    label="Хронические заболевания"
                    value={medicalForm.chronicDiseases}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, chronicDiseases: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                </Stack>
              </Card>

              <Card>
                <Text fw={600} size="sm" c="var(--mantine-color-text)" mb="sm">Системы организма</Text>
                <Grid>
                  <Grid.Col span={4}>
                    <Select
                      label="Зрение"
                      data={HEALTH_OPTIONS}
                      value={medicalForm.vision}
                      onChange={(v) => setMedicalForm((f) => ({ ...f, vision: v || 'норма' }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label="Слух"
                      data={HEALTH_OPTIONS}
                      value={medicalForm.hearing}
                      onChange={(v) => setMedicalForm((f) => ({ ...f, hearing: v || 'норма' }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label="ЖКТ"
                      data={HEALTH_OPTIONS}
                      value={medicalForm.gastrointestinal}
                      onChange={(v) => setMedicalForm((f) => ({ ...f, gastrointestinal: v || 'норма' }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label="Сердечно-сосудистая"
                      data={HEALTH_OPTIONS}
                      value={medicalForm.cardiovascular}
                      onChange={(v) => setMedicalForm((f) => ({ ...f, cardiovascular: v || 'норма' }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label="ЦНС"
                      data={HEALTH_OPTIONS}
                      value={medicalForm.cns}
                      onChange={(v) => setMedicalForm((f) => ({ ...f, cns: v || 'норма' }))}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  </Grid.Col>
                </Grid>
              </Card>

              <Card>
                <Text fw={600} size="sm" c="var(--mantine-color-text)" mb="sm">Логопед</Text>
                <Group gap="lg" align="flex-end">
                  <Switch
                    label="Занимался с логопедом"
                    checked={medicalForm.speechTherapist}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, speechTherapist: e.currentTarget.checked }))}
                    styles={{ label: { color: 'var(--mantine-color-text)' } }}
                  />
                  {medicalForm.speechTherapist && (
                    <TextInput
                      label="С какого возраста"
                      value={medicalForm.speechTherapistAge}
                      onChange={(e) => setMedicalForm((f) => ({ ...f, speechTherapistAge: e.currentTarget.value }))}
                      w={160}
                      styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                    />
                  )}
                </Group>
              </Card>

              <Card>
                <Stack gap="sm">
                  <Textarea
                    label="Особенности сна"
                    value={medicalForm.sleepFeatures}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, sleepFeatures: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                  <Textarea
                    label="Особенности поведения"
                    value={medicalForm.behaviorFeatures}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, behaviorFeatures: e.currentTarget.value }))}
                    minRows={2}
                    styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#ffffff', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                  />
                </Stack>
              </Card>

              <Button onClick={saveMedicalData} loading={medicalSaving} style={{ alignSelf: 'flex-end' }}>
                Сохранить медкарту
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* ══════════════════════════════════════════════
               Story 2.3: BEHAVIOR TAB (Поведение)
             ══════════════════════════════════════════════ */}
          <Tabs.Panel value="behavior">
            <Stack gap="md" p="md">
              <Group justify="space-between">
                <Title order={5} c="var(--mantine-color-text)">Инциденты поведения</Title>
                <Button
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={openIncidentModal}
                >
                  Добавить инцидент
                </Button>
              </Group>

              {incidents.length === 0 ? (
                <Box p="xl" style={{ textAlign: 'center', border: `1px dashed ${SURFACE_BORDER}`, borderRadius: 6 }}>
                  <Text c={TEXT_DIM}>Инцидентов не зафиксировано</Text>
                </Box>
              ) : (
                <Stack gap="sm">
                  {incidents.map((inc) => {
                    const sCfg = INCIDENT_STATUS_MAP[inc.status] || INCIDENT_STATUS_MAP.pending;
                    const typeLabel = INCIDENT_TYPES.find((t) => t.value === inc.type)?.label || inc.type;
                    return (
                      <Box
                        key={inc.id}
                        style={{
                          background: '#fbfcfd',
                          borderRadius: 6,
                          border: `1px solid ${SURFACE_BORDER}`,
                          borderLeft: `4px solid ${sCfg.color}`,
                          padding: '12px 16px',
                        }}
                      >
                        <Group justify="space-between" mb={4}>
                          <Group gap="sm">
                            <Badge
                              size="sm"
                              radius="sm"
                              variant="filled"
                              style={{ backgroundColor: sCfg.bg, color: sCfg.color }}
                            >
                              {sCfg.label}
                            </Badge>
                            <Badge variant="light" color="gray" size="sm" radius="sm">
                              {typeLabel}
                            </Badge>
                          </Group>
                          <Text size="xs" c={TEXT_DIM}>{formatDateShort(inc.createdAt)}</Text>
                        </Group>
                        <Text size="sm" c="var(--mantine-color-text)" mb="xs">{inc.description}</Text>
                        {inc.status === 'pending' && (
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="light"
                              color="blue"
                              onClick={() => moderateIncident(inc.id, 'moderated')}
                            >
                              Подтвердить
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              onClick={() => moderateIncident(inc.id, 'resolved')}
                            >
                              Решено
                            </Button>
                          </Group>
                        )}
                        {inc.status === 'moderated' && (
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            onClick={() => moderateIncident(inc.id, 'resolved')}
                          >
                            Решено
                          </Button>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>

            {/* New incident modal */}
            <Modal
              opened={incidentModalOpened}
              onClose={closeIncidentModal}
              title="Добавить инцидент"
              centered
              styles={{
                header: { backgroundColor: SURFACE, borderBottom: `1px solid ${SURFACE_BORDER}` },
                body: { backgroundColor: SURFACE },
                title: { color: 'var(--mantine-color-text)', fontWeight: 600 },
              }}
            >
              <Stack gap="md">
                <Select
                  label="Тип инцидента"
                  data={INCIDENT_TYPES}
                  value={newIncidentType}
                  onChange={setNewIncidentType}
                  styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#fbfcfd', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                />
                <Textarea
                  label="Описание"
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.currentTarget.value)}
                  minRows={3}
                  styles={{ label: { color: TEXT_SEC }, input: { backgroundColor: '#fbfcfd', borderColor: SURFACE_BORDER, color: 'var(--mantine-color-text)' } }}
                />
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={closeIncidentModal}>Отмена</Button>
                  <Button
                    onClick={createIncident}
                    loading={incidentSaving}
                    disabled={!newIncidentType || !newIncidentDesc.trim()}
                  >
                    Создать
                  </Button>
                </Group>
              </Stack>
            </Modal>
          </Tabs.Panel>

          {/* ══════════════════════════════════════════════
               Story 2.4: ANALYTICS TAB (Аналитика)
             ══════════════════════════════════════════════ */}
          <Tabs.Panel value="analytics">
            <AnalyticsTab
              student={student}
              grades={grades}
              incidents={incidents}
            />
          </Tabs.Panel>

          {/* Portfolio tab */}
          <Tabs.Panel value="portfolio">
            <Box
              p="xl"
              style={{
                textAlign: 'center',
                border: `1px dashed ${SURFACE_BORDER}`,
                borderRadius: 6,
                margin: 16,
              }}
            >
              <Text c={TEXT_DIM}>Раздел портфолио в разработке</Text>
            </Box>
          </Tabs.Panel>

          {/* Documents tab */}
          <Tabs.Panel value="documents">
            <Box
              p="xl"
              style={{
                textAlign: 'center',
                border: `1px dashed ${SURFACE_BORDER}`,
                borderRadius: 6,
                margin: 16,
              }}
            >
              <Text c={TEXT_DIM}>Раздел документов в разработке</Text>
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Stack>
  );
}

/* ══════════════════════════════════════════════
   ANALYTICS TAB COMPONENT
   ══════════════════════════════════════════════ */

interface AnalyticsCategory {
  key: string;
  label: string;
  status: 'good' | 'warning' | 'danger' | 'neutral';
  summary: string;
  details: string;
}

const ANALYTICS_STATUS_MAP: Record<string, { color: string; bg: string; label: string }> = {
  good: { color: '#40c057', bg: 'rgba(64,192,87,0.15)', label: 'Хорошо' },
  warning: { color: '#fab005', bg: 'rgba(250,176,5,0.15)', label: 'Внимание' },
  danger: { color: '#fa5252', bg: 'rgba(250,82,82,0.15)', label: 'Проблема' },
  neutral: { color: '#909296', bg: 'rgba(144,146,150,0.15)', label: 'Нет данных' },
};

function AnalyticsTab({
  student,
  grades,
  incidents,
}: {
  student: StudentDetail;
  grades: SubjectGrades[];
  incidents: BehaviorIncident[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const years = yearsInSchool(student.enrolledAt);

  // Compute overall grade average
  let totalWV = 0;
  let totalW = 0;
  for (const s of grades) {
    for (const g of s.grades) {
      totalWV += g.value * g.weight;
      totalW += g.weight;
    }
  }
  const overallAvg = totalW > 0 ? totalWV / totalW : 0;

  // Compute attendance rate
  const attTotal = student.attendanceSummary.total;
  const attPresent = student.attendanceSummary.present;
  const attRate = attTotal > 0 ? (attPresent / attTotal) * 100 : 0;

  // Compute behavior
  const pendingIncidents = incidents.filter((i) => i.status === 'pending').length;
  const totalIncidents = incidents.length;

  const categories: AnalyticsCategory[] = [
    {
      key: 'learning',
      label: 'Обучение',
      status: overallAvg >= 4 ? 'good' : overallAvg >= 3 ? 'warning' : overallAvg > 0 ? 'danger' : 'neutral',
      summary: overallAvg > 0 ? `Средний балл: ${overallAvg.toFixed(2)}` : 'Нет оценок',
      details: grades.length > 0
        ? grades.map((s) => `${s.subjectName}: ${s.weightedAverage.toFixed(2)}`).join('\n')
        : 'Данных об оценках нет.',
    },
    {
      key: 'nutrition',
      label: 'Питание',
      status: student.medicalData && (student.medicalData as MedicalData).foodReactions?.length > 0 ? 'warning' : 'neutral',
      summary: student.medicalData && (student.medicalData as MedicalData).foodReactions?.length > 0
        ? `Реакции: ${(student.medicalData as MedicalData).foodReactions.length}`
        : 'Нет данных о реакциях',
      details: student.medicalData && (student.medicalData as MedicalData).foodReactions?.length > 0
        ? `Пищевые реакции: ${(student.medicalData as MedicalData).foodReactions.join(', ')}`
        : 'Данных о питании нет.',
    },
    {
      key: 'health',
      label: 'Здоровье',
      status: (() => {
        if (!student.medicalData) return 'neutral' as const;
        const md = student.medicalData as MedicalData;
        const issues = [md.vision, md.hearing, md.gastrointestinal, md.cardiovascular, md.cns]
          .filter((v) => v === 'нарушение').length;
        if (issues > 0) return 'warning' as const;
        return 'good' as const;
      })(),
      summary: (() => {
        if (!student.medicalData) return 'Нет медданных';
        const md = student.medicalData as MedicalData;
        const issues = [md.vision, md.hearing, md.gastrointestinal, md.cardiovascular, md.cns]
          .filter((v) => v === 'нарушение').length;
        return issues > 0 ? `Нарушений: ${issues}` : 'Все показатели в норме';
      })(),
      details: (() => {
        if (!student.medicalData) return 'Медицинская карта не заполнена.';
        const md = student.medicalData as MedicalData;
        const lines = [
          `Зрение: ${md.vision || 'не указано'}`,
          `Слух: ${md.hearing || 'не указано'}`,
          `ЖКТ: ${md.gastrointestinal || 'не указано'}`,
          `Сердечно-сосудистая: ${md.cardiovascular || 'не указано'}`,
          `ЦНС: ${md.cns || 'не указано'}`,
        ];
        if (md.chronicDiseases) lines.push(`Хронические: ${md.chronicDiseases}`);
        if (md.drugAllergies) lines.push(`Аллергии: ${md.drugAllergies}`);
        return lines.join('\n');
      })(),
    },
    {
      key: 'behavior',
      label: 'Поведение',
      status: pendingIncidents > 0 ? 'danger' : totalIncidents > 0 ? 'warning' : 'good',
      summary: totalIncidents > 0
        ? `Инцидентов: ${totalIncidents}, ожидает: ${pendingIncidents}`
        : 'Нет инцидентов',
      details: totalIncidents > 0
        ? incidents.slice(0, 5).map((i) => {
            const typeLabel = INCIDENT_TYPES.find((t) => t.value === i.type)?.label || i.type;
            return `[${INCIDENT_STATUS_MAP[i.status]?.label}] ${typeLabel}: ${i.description.slice(0, 60)}`;
          }).join('\n')
        : 'Инцидентов не зафиксировано.',
    },
    {
      key: 'social',
      label: 'Межличностные отношения',
      status: 'neutral',
      summary: 'Раздел в разработке',
      details: 'Данные о межличностных отношениях будут доступны после интеграции с модулем наблюдений.',
    },
    {
      key: 'olympiads',
      label: 'Олимпиады',
      status: 'neutral',
      summary: 'Раздел в разработке',
      details: 'Данные об участии в олимпиадах будут доступны после интеграции с модулем портфолио.',
    },
    {
      key: 'projects',
      label: 'Проекты',
      status: 'neutral',
      summary: 'Раздел в разработке',
      details: 'Данные о проектной деятельности будут доступны после интеграции с модулем портфолио.',
    },
  ];

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={5} c="var(--mantine-color-text)">Аналитика</Title>
        <Badge variant="light" color="blue" size="md" radius="sm">
          Учится в Bilim OS {years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}
        </Badge>
      </Group>

      {/* Attendance summary */}
      {attTotal > 0 && (
        <Card>
          <Group gap="xl">
            <Box>
              <Text size="xs" c={TEXT_DIM}>Посещаемость</Text>
              <Text fw={700} size="lg" style={{ color: attRate >= 90 ? '#40c057' : attRate >= 75 ? '#fab005' : '#fa5252' }}>
                {attRate.toFixed(1)}%
              </Text>
            </Box>
            <Box>
              <Text size="xs" c={TEXT_DIM}>Средний балл</Text>
              <Text fw={700} size="lg" style={{ color: overallAvg >= 4 ? '#40c057' : overallAvg >= 3 ? '#fab005' : '#fa5252' }}>
                {overallAvg > 0 ? overallAvg.toFixed(2) : '\u2014'}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c={TEXT_DIM}>Инциденты</Text>
              <Text fw={700} size="lg" style={{ color: pendingIncidents > 0 ? '#fa5252' : '#40c057' }}>
                {totalIncidents}
              </Text>
            </Box>
          </Group>
        </Card>
      )}

      {/* Category grid */}
      <Grid>
        {categories.map((cat) => {
          const cfg = ANALYTICS_STATUS_MAP[cat.status];
          const isOpen = expanded === cat.key;
          return (
            <Grid.Col key={cat.key} span={{ base: 12, sm: 6, md: 4 }}>
              <Box
                style={{
                  background: '#fbfcfd',
                  borderRadius: 6,
                  border: `1px solid ${SURFACE_BORDER}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  borderColor: isOpen ? cfg.color : SURFACE_BORDER,
                }}
                onClick={() => setExpanded(isOpen ? null : cat.key)}
              >
                <Box p="md">
                  <Group justify="space-between" mb={4}>
                    <Text fw={600} size="sm" c="var(--mantine-color-text)">{cat.label}</Text>
                    <Badge
                      size="sm"
                      radius="sm"
                      variant="filled"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </Badge>
                  </Group>
                  <Text size="xs" c={TEXT_SEC}>{cat.summary}</Text>
                </Box>
                <Collapse in={isOpen}>
                  <Box
                    p="md"
                    style={{ borderTop: `1px solid ${SURFACE_BORDER}` }}
                  >
                    <Text size="xs" c="var(--mantine-color-text)" style={{ whiteSpace: 'pre-line' }}>
                      {cat.details}
                    </Text>
                  </Box>
                </Collapse>
              </Box>
            </Grid.Col>
          );
        })}
      </Grid>
    </Stack>
  );
}

/* ── Stat box for attendance ── */
function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box
      style={{
        background: '#fbfcfd',
        borderRadius: 6,
        padding: '12px 20px',
        textAlign: 'center',
        minWidth: 100,
      }}
    >
      <Text fw={700} size="xl" style={{ color, lineHeight: 1 }}>
        {value}
      </Text>
      <Text size="xs" c={TEXT_SEC} mt={4}>
        {label}
      </Text>
    </Box>
  );
}
