import { exportToExcel } from '@/shared/lib/excel-export';

type ExcelColumn = { key: string; header: string };

type AttendanceStatus = 'present' | 'absent' | 'excused';
type AttendanceDay = { id: string; date: string };
type AttendanceParticipant = { studentId: string; fio: string; className: string };
type AttendanceMark = { studentId: string; date: string; status: AttendanceStatus };
type AttendanceGrid = {
  days: AttendanceDay[];
  participants: AttendanceParticipant[];
  marks: AttendanceMark[];
};

type AwardValue = { value: string; label: string };
type OlympiadEnrollment = {
  fio: string;
  className: string;
  tour: string | null;
  status: string | null;
  awardValue: string | null;
  score: number | null;
  comment: string | null;
};
type OlympiadResultsSource = {
  olympiad: {
    name: string;
    awardScheme: { values: unknown } | null;
  };
  enrollments: OlympiadEnrollment[];
};

export const EXCEL_EXPORT_LABEL = 'Экспорт в Excel';
export const EXCEL_EXPORT_RESULTS_LABEL = 'Экспорт результатов в Excel';

const EMPTY_LABEL = '—';

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Присутствовал',
  absent: 'Отсутствовал',
  excused: 'Уважительная',
};

const RESULT_STATUS_LABELS: Record<string, string> = {
  enrolled: 'Записан',
  participated: 'Участвовал',
  no_show: 'Не явился',
};

function isoDay(value: string) {
  return value.slice(0, 10);
}

function markKey(studentId: string, date: string) {
  return `${studentId}:${date}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(new Date(value));
}

function parseAwards(value: unknown): AwardValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const value = String(row.value ?? '').trim();
      if (!value) return null;
      return { value, label: String(row.label ?? value) };
    })
    .filter((item): item is AwardValue => Boolean(item));
}

export function buildAttendanceColumns(days: AttendanceDay[]): ExcelColumn[] {
  return [
    { key: 'fio', header: 'ФИО' },
    { key: 'className', header: 'Класс' },
    ...days.map((day) => ({ key: `d_${isoDay(day.date)}`, header: formatShortDate(day.date) })),
    { key: 'itogo', header: 'Посещений' },
  ];
}

export function buildAttendanceRows(grid: AttendanceGrid) {
  const days = grid.days.map((day) => ({ ...day, key: isoDay(day.date) }));
  const marks = new Map(grid.marks.map((mark) => [markKey(mark.studentId, mark.date), mark.status]));

  return grid.participants.map((participant) => {
    const row: Record<string, string | number> = {
      fio: participant.fio,
      className: participant.className || EMPTY_LABEL,
      itogo: 0,
    };

    for (const day of days) {
      const status = marks.get(markKey(participant.studentId, day.key));
      row[`d_${day.key}`] = status ? ATTENDANCE_STATUS_LABELS[status] : EMPTY_LABEL;
      if (status === 'present') row.itogo = Number(row.itogo) + 1;
    }

    return row;
  });
}

export function exportOlympiadAttendanceExcel(grid: AttendanceGrid, intensiveNameOrId: string) {
  exportToExcel(
    buildAttendanceRows(grid),
    buildAttendanceColumns(grid.days),
    `Посещаемость-${intensiveNameOrId}`,
  );
}

export function buildResultsColumns(): ExcelColumn[] {
  return [
    { key: 'fio', header: 'ФИО' },
    { key: 'className', header: 'Класс' },
    { key: 'tour', header: 'Тур' },
    { key: 'statusLabel', header: 'Статус' },
    { key: 'awardLabel', header: 'Награда' },
    { key: 'score', header: 'Балл' },
    { key: 'comment', header: 'Комментарий' },
  ];
}

export function buildResultsRows(data: OlympiadResultsSource) {
  const awards = parseAwards(data.olympiad.awardScheme?.values);

  return data.enrollments.map((row) => ({
    fio: row.fio,
    className: row.className || EMPTY_LABEL,
    tour: row.tour || EMPTY_LABEL,
    statusLabel: row.status ? RESULT_STATUS_LABELS[row.status] ?? row.status : EMPTY_LABEL,
    awardLabel: awards.find((award) => award.value === row.awardValue)?.label ?? EMPTY_LABEL,
    score: row.score ?? '',
    comment: row.comment ?? '',
  }));
}

export function exportOlympiadResultsExcel(data: OlympiadResultsSource) {
  exportToExcel(
    buildResultsRows(data),
    buildResultsColumns(),
    `Результаты-${data.olympiad.name}`,
  );
}
