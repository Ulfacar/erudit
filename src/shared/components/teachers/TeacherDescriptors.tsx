'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconLock,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react'
import { useRole } from '@/shared/hooks/useRole'

interface DescriptorItem {
  id: string
  teacherId: string
  year: number
  text: string
  accessLevel: number
  authorId: string
  createdAt: string
  updatedAt: string
}

interface Props {
  teacherId: string
  /** Максимальный уровень дескриптора, доступный текущему пользователю. */
  viewerMaxLevel: number
}

const LEVEL_BADGE: Record<number, { label: string; color: string }> = {
  1: { label: '★ общий доступ', color: 'gray' },
  2: { label: '★★ только завучи', color: 'blue' },
  3: { label: '★★★ только аналитик', color: 'red' },
}

export function TeacherDescriptors({ teacherId, viewerMaxLevel }: Props) {
  const { role } = useRole()
  const canEdit = role === 'super_admin' || role === 'analyst' || role === 'zavuch'
  const maxAuthorLevel = role === 'super_admin' || role === 'analyst' ? 3 : role === 'zavuch' ? 2 : 0

  const [items, setItems] = useState<DescriptorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<string | null>(null)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [formYear, setFormYear] = useState<number | string>(new Date().getFullYear())
  const [formText, setFormText] = useState('')
  const [formLevel, setFormLevel] = useState<string>('1')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function load() {
    if (viewerMaxLevel === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (yearFilter) params.set('year', yearFilter)
      const res = await fetch(`/api/v1/teachers/${teacherId}/descriptors?${params}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки')
      setItems(json.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, yearFilter, viewerMaxLevel])

  const years = useMemo(() => {
    const set = new Set<number>(items.map((i) => i.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [items])

  async function submit() {
    setFormError(null)
    const yearNum = typeof formYear === 'number' ? formYear : parseInt(String(formYear), 10)
    if (!Number.isFinite(yearNum)) {
      setFormError('Укажите год')
      return
    }
    if (!formText.trim()) {
      setFormError('Текст дескриптора обязателен')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/teachers/${teacherId}/descriptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: yearNum,
          text: formText,
          accessLevel: Number(formLevel),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка')
      setFormOpen(false)
      setFormText('')
      setFormLevel('1')
      await load()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  if (viewerMaxLevel === 0) {
    return (
      <Card withBorder>
        <Group gap="sm">
          <IconLock size={16} />
          <Text size="sm" c="dimmed">
            Дескрипторы педагога недоступны для вашей роли.
          </Text>
        </Group>
      </Card>
    )
  }

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={4}>Дескрипторы педагога</Title>
          <Text size="xs" c="dimmed">
            Пометки о качестве работы, выговорах, повышениях и т.п. Уровень доступа: 1★ — общий, 2★ — только завучи, 3★ — только аналитик.
          </Text>
        </Box>
        <Group gap={6}>
          <Select
            placeholder="Все годы"
            value={yearFilter}
            onChange={setYearFilter}
            data={years.map((y) => ({ value: String(y), label: String(y) }))}
            clearable
            size="xs"
            w={120}
          />
          <ActionIcon variant="subtle" onClick={load} title="Обновить">
            <IconRefresh size={16} />
          </ActionIcon>
          {canEdit && (
            <Button
              leftSection={<IconPlus size={14} />}
              size="xs"
              onClick={() => setFormOpen(true)}
            >
              Добавить
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={14} />} mb="md">
          {error}
        </Alert>
      )}

      {loading ? (
        <Box ta="center" py="md"><Loader size="sm" /></Box>
      ) : items.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Нет дескрипторов
        </Text>
      ) : (
        <Stack gap="xs">
          {items.map((d) => {
            const badge = LEVEL_BADGE[d.accessLevel] ?? { label: `★${d.accessLevel}`, color: 'gray' }
            return (
              <Card key={d.id} withBorder padding="sm" radius="sm">
                <Group justify="space-between" mb={4}>
                  <Group gap={6}>
                    <Badge size="sm" color="violet" variant="light">{d.year} учебный год</Badge>
                    <Tooltip label="Уровень доступа">
                      <Badge size="sm" color={badge.color} variant="light">
                        {badge.label}
                      </Badge>
                    </Tooltip>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {new Date(d.createdAt).toLocaleDateString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </Text>
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{d.text}</Text>
              </Card>
            )
          })}
        </Stack>
      )}

      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title="Новый дескриптор"
        size="lg"
      >
        <Stack>
          {formError && (
            <Alert color="red" icon={<IconAlertCircle size={14} />}>{formError}</Alert>
          )}
          <NumberInput
            label="Учебный год (начало)"
            value={formYear}
            onChange={(v) => setFormYear(v)}
            min={2020}
            max={2100}
            required
          />
          <Textarea
            label="Текст дескриптора"
            placeholder="Например: «Повышение в должности до завуча средней школы. Подтверждено приказом №12 от 01.09.»"
            value={formText}
            onChange={(e) => setFormText(e.currentTarget.value)}
            minRows={4}
            maxLength={2000}
            required
          />
          <Select
            label="Уровень доступа"
            value={formLevel}
            onChange={(v) => setFormLevel(v ?? '1')}
            data={[
              { value: '1', label: '★ общий — видят завучи и сам педагог' },
              ...(maxAuthorLevel >= 2 ? [{ value: '2', label: '★★ только завучи и аналитик' }] : []),
              ...(maxAuthorLevel >= 3 ? [{ value: '3', label: '★★★ только аналитик/super_admin' }] : []),
            ]}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFormOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={submit} loading={submitting}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
