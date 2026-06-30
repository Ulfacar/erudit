'use client';

import { useEffect, useState } from 'react';
import {
  Anchor,
  Box,
  Button,
  FileInput,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconUserCheck } from '@tabler/icons-react';
import type { Role } from '@prisma/client';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const PAGE_ROLES: Role[] = ['teacher', 'curator'];

interface QuestionnaireData {
  birthDate?: string;
  phone?: string;
  address?: string;
  education?: string;
  experience?: string;
  extra?: string;
  [key: string]: unknown;
}

interface TeacherProfile {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position?: string | null;
  data?: QuestionnaireData | null;
}

interface TeacherDocument {
  id: string;
  title: string;
  fileName: string | null;
  kind: string;
  createdAt: string;
}

interface ProfileResponse {
  teacher: TeacherProfile;
  documents: TeacherDocument[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

const emptyForm = {
  birthDate: '',
  phone: '',
  address: '',
  education: '',
  experience: '',
  extra: '',
};

type FormKey = keyof typeof emptyForm;

async function readJson<T>(res: Response): Promise<ApiResponse<T>> {
  return (await res.json()) as ApiResponse<T>;
}

function teacherName(teacher: TeacherProfile | null) {
  if (!teacher) return '';
  return [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ');
}

function stringValue(data: QuestionnaireData | null | undefined, key: FormKey) {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

export default function MyQuestionnairePage() {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [documents, setDocuments] = useState<TeacherDocument[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('');

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher/profile');
      const json = await readJson<ProfileResponse>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить анкету');

      setTeacher(json.data.teacher);
      setDocuments(json.data.documents);
      setForm({
        birthDate: stringValue(json.data.teacher.data, 'birthDate'),
        phone: stringValue(json.data.teacher.data, 'phone'),
        address: stringValue(json.data.teacher.data, 'address'),
        education: stringValue(json.data.teacher.data, 'education'),
        experience: stringValue(json.data.teacher.data, 'experience'),
        extra: stringValue(json.data.teacher.data, 'extra'),
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось загрузить анкету',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function updateField(key: FormKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/teacher/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: form }),
      });
      const json = await readJson<TeacherProfile>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить анкету');

      setTeacher(json.data);
      notifications.show({ color: 'green', title: 'Сохранено', message: 'Анкета обновлена' });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось сохранить анкету',
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument() {
    if (!file) {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Выберите файл' });
      return;
    }

    setUploading(true);
    try {
      const payload = new FormData();
      payload.append('file', file);
      if (kind.trim()) payload.append('kind', kind.trim());

      const res = await fetch('/api/v1/teacher/profile', {
        method: 'POST',
        body: payload,
      });
      const json = await readJson<TeacherDocument>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить документ');

      setFile(null);
      setKind('');
      await loadProfile();
      notifications.show({ color: 'green', title: 'Загружено', message: 'Документ добавлен' });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось загрузить документ',
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <RoleGate roles={PAGE_ROLES}>
      <Stack gap="md">
        <Group gap="sm">
          <IconUserCheck size={24} color="#228be6" />
          <Box>
            <Text fw={700} size="xl">
              Моя анкета
            </Text>
            <Text size="sm" c="dimmed">
              Личные данные и документы педагога
            </Text>
          </Box>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <>
            <Box p="md" style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff' }}>
              <Stack gap="xs">
                <Text fw={600}>{teacherName(teacher)}</Text>
                <Text size="sm" c="dimmed">
                  {teacher?.position || 'Должность не указана'}
                </Text>
              </Stack>
            </Box>

            <Box p="md" style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff' }}>
              <Stack gap="sm">
                <Text fw={600}>Анкета</Text>
                <TextInput
                  label="Дата рождения"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => updateField('birthDate', event.currentTarget.value)}
                />
                <TextInput
                  label="Телефон"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.currentTarget.value)}
                />
                <TextInput
                  label="Адрес"
                  value={form.address}
                  onChange={(event) => updateField('address', event.currentTarget.value)}
                />
                <Textarea
                  label="Образование"
                  minRows={3}
                  autosize
                  value={form.education}
                  onChange={(event) => updateField('education', event.currentTarget.value)}
                />
                <Textarea
                  label="Опыт работы"
                  minRows={3}
                  autosize
                  value={form.experience}
                  onChange={(event) => updateField('experience', event.currentTarget.value)}
                />
                <Textarea
                  label="Доп. сведения"
                  minRows={3}
                  autosize
                  value={form.extra}
                  onChange={(event) => updateField('extra', event.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button onClick={saveProfile} loading={saving}>
                    Сохранить
                  </Button>
                </Group>
              </Stack>
            </Box>

            <Box p="md" style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff' }}>
              <Stack gap="sm">
                <Text fw={600}>Документы</Text>
                <FileInput
                  label="Файл"
                  placeholder="PDF, DOC, DOCX или изображение"
                  value={file}
                  onChange={setFile}
                  clearable
                />
                <TextInput
                  label="Вид документа"
                  placeholder="Например: диплом, удостоверение, медсправка"
                  value={kind}
                  onChange={(event) => setKind(event.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button leftSection={<IconUpload size={16} />} onClick={uploadDocument} loading={uploading}>
                    Загрузить
                  </Button>
                </Group>

                <Stack gap={6}>
                  {documents.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Документы ещё не загружены
                    </Text>
                  ) : (
                    documents.map((doc) => (
                      <Group key={doc.id} justify="space-between" gap="sm" wrap="nowrap">
                        <Anchor href={`/api/v1/documents/file/${doc.id}`} target="_blank" size="sm">
                          {doc.fileName ?? doc.title}
                        </Anchor>
                        <Text size="sm" c="dimmed">
                          {doc.kind}
                        </Text>
                      </Group>
                    ))
                  )}
                </Stack>
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </RoleGate>
  );
}
