'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Button, FileInput, Loader, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface InviteData {
  fullName: string;
  position: string | null;
  status: string;
}

export default function EmployeeOnboardingPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    position: '',
    phone: '',
    email: '',
    education: '',
    experience: '',
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const json = await fetch(`/api/v1/public/onboarding/${token}`).then((res) => res.json()).catch(() => null);
      if (!alive) return;

      if (!json?.success) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const data = json.data as InviteData;
      setInvite(data);
      setForm((current) => ({
        ...current,
        fullName: data.fullName ?? '',
        position: data.position ?? '',
      }));
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const body = new FormData();
    for (const [key, value] of Object.entries(form)) {
      body.append(key, value);
    }
    for (const file of files) {
      body.append('files', file);
    }

    const json = await fetch(`/api/v1/public/onboarding/${token}`, { method: 'POST', body })
      .then((res) => res.json())
      .catch(() => null);

    setSaving(false);
    if (!json?.success) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: json?.error?.message ?? 'Не удалось отправить анкету',
      });
      return;
    }

    setSubmitted(true);
  }

  return (
    <Box mih="100vh" px="md" py={48} bg="gray.0">
      <Paper withBorder shadow="sm" radius="md" p="xl" maw={560} mx="auto">
        <Stack gap="md">
          <Title order={2}>Анкета сотрудника</Title>

          {loading ? (
            <Box py="xl" ta="center"><Loader /></Box>
          ) : notFound ? (
            <Text c="red">Приглашение не найдено</Text>
          ) : submitted ? (
            <Text fw={600}>Спасибо, данные отправлены</Text>
          ) : (
            <>
              <Text c="dimmed">
                Здравствуйте, {invite?.fullName}
                {invite?.position ? `, ${invite.position}` : ''}. Заполните данные и приложите сканы документов.
              </Text>
              <form onSubmit={submit}>
                <Stack gap="sm">
                  <TextInput
                    label="ФИО"
                    required
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.currentTarget.value })}
                  />
                  <TextInput
                    label="Должность"
                    value={form.position}
                    onChange={(event) => setForm({ ...form, position: event.currentTarget.value })}
                  />
                  <TextInput
                    label="Телефон"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
                  />
                  <TextInput
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
                  />
                  <Textarea
                    label="Образование"
                    minRows={3}
                    value={form.education}
                    onChange={(event) => setForm({ ...form, education: event.currentTarget.value })}
                  />
                  <Textarea
                    label="Опыт работы"
                    minRows={3}
                    value={form.experience}
                    onChange={(event) => setForm({ ...form, experience: event.currentTarget.value })}
                  />
                  <FileInput
                    multiple
                    label="Сканы документов (паспорт, диплом, справки)"
                    accept="application/pdf,image/*,.doc,.docx"
                    value={files}
                    onChange={setFiles}
                  />
                  <Button type="submit" loading={saving}>Отправить</Button>
                </Stack>
              </form>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
