'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'

export type GradeScale = 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER'

interface CategoryOption {
  id: string
  name: string
  weight: number
}

interface AddGradeFormProps {
  studentId: string
  subjectId: string
  periodId: string
  teacherId: string
  categories: CategoryOption[]
  /** Default category (e.g. "Работа на уроке") */
  defaultCategoryId?: string
  /** Default scale (FIVE/TWELVE/HUNDRED/LETTER) */
  defaultScale?: GradeScale
  onSuccess?: () => void
  onCancel?: () => void
}

const SCALE_DATA: { value: GradeScale; label: string; min: number; max: number }[] = [
  { value: 'FIVE', label: '5', min: 1, max: 5 },
  { value: 'TWELVE', label: '12', min: 1, max: 12 },
  { value: 'HUNDRED', label: '%', min: 0, max: 100 },
  { value: 'LETTER', label: 'A-F', min: 0, max: 14 },
]

const LETTER_VALUES = [
  { value: '14', label: 'A+' },
  { value: '13', label: 'A' },
  { value: '12', label: 'A-' },
  { value: '11', label: 'B+' },
  { value: '10', label: 'B' },
  { value: '9', label: 'B-' },
  { value: '8', label: 'C+' },
  { value: '7', label: 'C' },
  { value: '6', label: 'C-' },
  { value: '5', label: 'D+' },
  { value: '4', label: 'D' },
  { value: '3', label: 'D-' },
  { value: '2', label: 'F+' },
  { value: '1', label: 'F' },
  { value: '0', label: 'F-' },
]

export function AddGradeForm({
  studentId,
  subjectId,
  periodId,
  teacherId,
  categories,
  defaultCategoryId,
  defaultScale = 'FIVE',
  onSuccess,
  onCancel,
}: AddGradeFormProps) {
  const [scale, setScale] = useState<GradeScale>(defaultScale)
  const [value, setValue] = useState<number | string>('')
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId ?? categories[0]?.id ?? null,
  )
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const scaleInfo = useMemo(() => SCALE_DATA.find((s) => s.value === scale)!, [scale])

  // Сброс значения при смене шкалы — границы разные
  useEffect(() => {
    setValue('')
  }, [scale])

  async function submit() {
    setError(null)
    setSuccess(false)

    if (!categoryId) {
      setError('Выберите категорию оценки')
      return
    }

    const numericValue = typeof value === 'number' ? value : parseFloat(value as string)
    if (Number.isNaN(numericValue)) {
      setError('Укажите оценку')
      return
    }
    if (numericValue < scaleInfo.min || numericValue > scaleInfo.max) {
      setError(`Оценка должна быть от ${scaleInfo.min} до ${scaleInfo.max}`)
      return
    }
    if (comment.length > 500) {
      setError('Комментарий — не более 500 символов')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/grading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          subjectId,
          categoryId,
          teacherId,
          periodId,
          value: numericValue,
          scale,
          comment: comment || undefined,
          date: new Date().toISOString(),
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message ?? 'Не удалось сохранить оценку')
      }
      setSuccess(true)
      setValue('')
      setComment('')
      onSuccess?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const willGoToModeration = (selectedCategory?.weight ?? 1) >= 3

  return (
    <Stack gap="sm">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert color="green" icon={<IconCheck size={16} />}>
          Оценка сохранена{willGoToModeration ? ' и ушла на модерацию' : ''}
        </Alert>
      )}

      <Box>
        <Text size="xs" fw={500} mb={4}>Шкала</Text>
        <SegmentedControl
          fullWidth
          value={scale}
          onChange={(v) => setScale(v as GradeScale)}
          data={SCALE_DATA.map((s) => ({ value: s.value, label: s.label }))}
        />
      </Box>

      <Group grow align="flex-start">
        <Select
          label="Категория"
          value={categoryId}
          onChange={setCategoryId}
          data={categories.map((c) => ({
            value: c.id,
            label: `${c.name} (вес ${c.weight})`,
          }))}
          searchable
          required
        />
        {scale === 'LETTER' ? (
          <Select
            label="Оценка"
            value={value === '' ? null : String(value)}
            onChange={(v) => setValue(v === null ? '' : Number(v))}
            data={LETTER_VALUES}
            placeholder="A+ … F-"
            required
          />
        ) : (
          <NumberInput
            label="Оценка"
            value={value}
            onChange={(v) => setValue(v)}
            min={scaleInfo.min}
            max={scaleInfo.max}
            step={scale === 'HUNDRED' ? 1 : 1}
            decimalScale={0}
            required
          />
        )}
      </Group>

      <Textarea
        label="Комментарий (дискрипт)"
        placeholder="До 500 символов"
        value={comment}
        onChange={(e) => setComment(e.currentTarget.value)}
        minRows={2}
        maxLength={500}
      />

      {willGoToModeration && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
          Категория «{selectedCategory?.name}» имеет вес {selectedCategory?.weight}. Оценка будет
          отправлена на модерацию завучу, затем аналитику. Родитель/ученик увидят её только после публикации.
        </Alert>
      )}

      <Group justify="flex-end" gap="sm">
        {onCancel && (
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
        )}
        <Button onClick={submit} loading={submitting}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  )
}
