import type { ResourceField, ResourceLookup } from './ResourcePage';

export function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    return new Date(String(v)).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(v);
  }
}

export function fmtMoney(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return `${Number(v).toLocaleString('ru-RU')} сом`;
}

/* ── Student ── */
export const studentField: ResourceField = {
  name: 'studentId',
  label: 'Ученик',
  type: 'select',
  required: true,
  searchable: true,
  optionsEndpoint: '/api/v1/students',
  optionsMap: (r) => ({ value: String(r.id), label: `${r.lastName} ${r.firstName}` }),
};

export const studentLookup: ResourceLookup = {
  key: 'students',
  endpoint: '/api/v1/students',
  map: (r) => [String(r.id), `${r.lastName} ${r.firstName}`],
};

/* ── Class ── */
export const classField: ResourceField = {
  name: 'classId',
  label: 'Класс',
  type: 'select',
  searchable: true,
  optionsEndpoint: '/api/v1/classes',
  optionsMap: (r) => ({ value: String(r.id), label: `${r.grade}${r.letter}` }),
};

export const classLookup: ResourceLookup = {
  key: 'classes',
  endpoint: '/api/v1/classes',
  map: (r) => [String(r.id), `${r.grade}${r.letter}`],
};

/* ── Subject ── */
export const subjectField: ResourceField = {
  name: 'subjectId',
  label: 'Предмет',
  type: 'select',
  searchable: true,
  optionsEndpoint: '/api/v1/grading/subjects',
  optionsMap: (r) => ({ value: String(r.id), label: String(r.name) }),
};

export const subjectLookup: ResourceLookup = {
  key: 'subjects',
  endpoint: '/api/v1/grading/subjects',
  map: (r) => [String(r.id), String(r.name)],
};
