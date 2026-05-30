'use client';

/**
 * Универсальная CRUD-страница: таблица + модалка создания + (опц.) удаление.
 * Питается конфигом — закрывает типовые модули (журнал записей по сущности).
 * Сложные модули (библиотека, бухгалтерия, КТП) делаются отдельными страницами.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'switch';

export interface FieldOption {
  value: string;
  label: string;
}

export interface ResourceField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[]; // для select/multiselect статичные
  /** endpoint, отдающий { success, data: [...] } для динамических опций */
  optionsEndpoint?: string;
  /** маппер строки данных в { value, label } */
  optionsMap?: (row: Record<string, unknown>) => FieldOption;
  defaultValue?: unknown;
  searchable?: boolean;
}

export type LookupMaps = Record<string, Record<string, string>>;
export type ResourceRow = Record<string, unknown> & { id: string };

export interface ResourceLookup {
  /** ключ карты в maps, напр. 'students' */
  key: string;
  endpoint: string;
  /** маппер строки в [id, label] */
  map: (row: Record<string, unknown>) => [string, string];
}

export interface ResourceColumn {
  key: string;
  label: string;
  render?: (row: ResourceRow, maps: LookupMaps) => React.ReactNode;
  width?: number | string;
}

export interface ResourcePageProps {
  title: string;
  icon?: React.ReactNode;
  endpoint: string;
  /** доп. query-параметры для GET (например ?kind=speech) */
  query?: Record<string, string>;
  columns: ResourceColumn[];
  fields?: ResourceField[];
  /** можно ли создавать (если false — только просмотр) */
  canCreate?: boolean;
  /** можно ли удалять (DELETE endpoint/:id) */
  canDelete?: boolean;
  createLabel?: string;
  emptyText?: string;
  /** справочники для резолва id→label в колонках */
  lookups?: ResourceLookup[];
  /** трансформация payload перед POST */
  transformPayload?: (raw: Record<string, unknown>) => Record<string, unknown>;
}

export function ResourcePage({
  title,
  icon,
  endpoint,
  query,
  columns,
  fields = [],
  canCreate = true,
  canDelete = false,
  createLabel = 'Добавить',
  emptyText = 'Пока нет записей',
  lookups,
  transformPayload,
}: ResourcePageProps) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [dynOptions, setDynOptions] = useState<Record<string, FieldOption[]>>({});
  const [maps, setMaps] = useState<LookupMaps>({});

  // Загрузить справочники (один раз) для резолва id→label в колонках
  useEffect(() => {
    if (!lookups || lookups.length === 0) return;
    (async () => {
      const next: LookupMaps = {};
      for (const lk of lookups) {
        try {
          const res = await fetch(lk.endpoint);
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const m: Record<string, string> = {};
            for (const r of json.data) {
              const [id, label] = lk.map(r);
              m[id] = label;
            }
            next[lk.key] = m;
          }
        } catch {
          /* ignore */
        }
      }
      setMaps(next);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = useMemo(() => {
    if (!query) return '';
    const p = new URLSearchParams(query).toString();
    return p ? `?${p}` : '';
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}${qs}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [endpoint, qs]);

  useEffect(() => {
    load();
  }, [load]);

  // Загрузить динамические опции для полей при первом открытии модалки
  useEffect(() => {
    if (!open) return;
    const toLoad = fields.filter((f) => f.optionsEndpoint && !dynOptions[f.name]);
    if (toLoad.length === 0) return;
    (async () => {
      const next: Record<string, FieldOption[]> = {};
      for (const f of toLoad) {
        try {
          const res = await fetch(f.optionsEndpoint!);
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            next[f.name] = json.data.map(
              f.optionsMap ?? ((r: Record<string, unknown>) => ({ value: String(r.id), label: String(r.name ?? r.id) })),
            );
          }
        } catch {
          /* ignore */
        }
      }
      if (Object.keys(next).length) setDynOptions((prev) => ({ ...prev, ...next }));
    })();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal() {
    const init: Record<string, unknown> = {};
    for (const f of fields) if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
    setForm(init);
    setError('');
    setOpen(true);
  }

  async function submit() {
    for (const f of fields) {
      if (f.required && (form[f.name] === undefined || form[f.name] === '' || form[f.name] === null)) {
        setError(`Заполните поле «${f.label}»`);
        return;
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = transformPayload ? transformPayload(form) : form;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setOpen(false);
        load();
      } else {
        setError(json.error?.message || 'Ошибка при сохранении');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить запись?')) return;
    try {
      const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) load();
    } catch {
      /* ignore */
    }
  }

  function setField(name: string, value: unknown) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function renderField(f: ResourceField) {
    const val = form[f.name];
    const opts = f.options ?? dynOptions[f.name] ?? [];
    switch (f.type) {
      case 'textarea':
        return (
          <Textarea key={f.name} label={f.label} placeholder={f.placeholder} required={f.required}
            value={(val as string) ?? ''} onChange={(e) => setField(f.name, e.currentTarget.value)} autosize minRows={2} />
        );
      case 'number':
        return (
          <NumberInput key={f.name} label={f.label} placeholder={f.placeholder} required={f.required}
            value={val as number} onChange={(v) => setField(f.name, v)} />
        );
      case 'date':
        return (
          <TextInput key={f.name} label={f.label} type="date" required={f.required}
            value={(val as string) ?? ''} onChange={(e) => setField(f.name, e.currentTarget.value)} />
        );
      case 'select':
        return (
          <Select key={f.name} label={f.label} placeholder={f.placeholder} required={f.required}
            data={opts} value={(val as string) ?? null} onChange={(v) => setField(f.name, v)}
            searchable={f.searchable} clearable />
        );
      case 'multiselect':
        return (
          <MultiSelect key={f.name} label={f.label} placeholder={f.placeholder}
            data={opts} value={(val as string[]) ?? []} onChange={(v) => setField(f.name, v)}
            searchable={f.searchable} />
        );
      case 'switch':
        return (
          <Switch key={f.name} label={f.label} checked={Boolean(val)}
            onChange={(e) => setField(f.name, e.currentTarget.checked)} />
        );
      default:
        return (
          <TextInput key={f.name} label={f.label} placeholder={f.placeholder} required={f.required}
            value={(val as string) ?? ''} onChange={(e) => setField(f.name, e.currentTarget.value)} />
        );
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap={8}>
          {icon}
          <Title order={3} c="var(--mantine-color-text)">{title}</Title>
          <Badge variant="light" color="gray" radius="sm">{rows.length}</Badge>
        </Group>
        {canCreate && fields.length > 0 && (
          <Button leftSection={<IconPlus size={16} />} onClick={openModal} color="eruditBlue">
            {createLabel}
          </Button>
        )}
      </Group>

      <Paper style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }} radius="sm">
        {loading ? (
          <Group justify="center" p="xl"><Loader color="blue" /></Group>
        ) : rows.length === 0 ? (
          <Text c={TEXT_SEC} ta="center" p="xl">{emptyText}</Text>
        ) : (
          <ScrollArea>
            <Table highlightOnHover style={{ minWidth: 600 }}>
              <Table.Thead>
                <Table.Tr>
                  {columns.map((c) => (
                    <Table.Th key={c.key} style={{ color: TEXT_SEC, fontSize: 12, width: c.width }}>{c.label}</Table.Th>
                  ))}
                  {canDelete && <Table.Th style={{ width: 48 }} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.id}>
                    {columns.map((c) => (
                      <Table.Td key={c.key} style={{ fontSize: 13 }}>
                        {c.render ? c.render(row, maps) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </Table.Td>
                    ))}
                    {canDelete && (
                      <Table.Td>
                        <ActionIcon variant="subtle" color="red" onClick={() => remove(row.id)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      <Modal opened={open} onClose={() => setOpen(false)} title={createLabel} centered>
        <Stack gap="sm">
          {fields.map(renderField)}
          {error && <Text c="red" size="sm">{error}</Text>}
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={submit} loading={submitting} color="eruditBlue">Сохранить</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
