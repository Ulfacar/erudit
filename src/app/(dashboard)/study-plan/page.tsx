'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react'
import { RoleGate } from '@/shared/components/auth/RoleGate'

interface ClassRow {
  id: string
  grade: number
  letter: string
  levelId: string | null
}

interface SubjectCol {
  id: string
  name: string
  color: string | null
}

type CellStatus = 'matched' | 'overload' | 'partial' | 'missing' | 'idle'
interface Cell {
  declared: number
  actual: number
  status: CellStatus
}

interface CurriculumData {
  classes: ClassRow[]
  subjects: SubjectCol[]
  matrix: Record<string, Record<string, Cell>>
  totals: Record<string, { declared: number; actual: number }>
}

const STATUS_COLORS: Record<CellStatus, string | null> = {
  matched: 'green',
  partial: 'yellow',
  overload: 'red',
  missing: 'orange',
  idle: null,
}

const STATUS_LABEL: Record<CellStatus, string> = {
  matched: 'часов = плану',
  partial: 'не вся нагрузка расставлена',
  overload: 'часы сверх нагрузки',
  missing: 'есть в расписании, но не в БУП',
  idle: 'нет в этом классе',
}

function StudyPlanInner() {
  const [data, setData] = useState<CurriculumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/v1/curriculum-plan')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data)
        else setError(j.error?.message ?? 'Не удалось загрузить план')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false))
  }, [])

  // Скрыть классы, где все ячейки idle (нет ни плана ни расписания)
  const visibleClasses = useMemo(() => {
    if (!data) return []
    return data.classes.filter((c) => {
      const t = data.totals[c.id]
      return t && (t.declared > 0 || t.actual > 0)
    })
  }, [data])

  if (loading) {
    return (
      <Box p="xl" ta="center"><Loader /></Box>
    )
  }
  if (error) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={16} />} m="md">
        {error}
      </Alert>
    )
  }
  if (!data) return null

  return (
    <Stack p="md" gap="md">
      <Box>
        <Title order={2}>Базисный учебный план</Title>
        <Text size="sm" c="dimmed">
          Часы в неделю по предметам в каждом классе. Цвет — расхождение между БУП и фактическим расписанием.
        </Text>
      </Box>

      <Group gap="xs">
        <Badge color="green" variant="light">факт = плану</Badge>
        <Badge color="yellow" variant="light">часть нагрузки не расставлена</Badge>
        <Badge color="red" variant="light">часы сверх плана</Badge>
        <Badge color="orange" variant="light">нет в БУП, но есть в расписании</Badge>
      </Group>

      <Card withBorder padding={0}>
        <ScrollArea>
          <Table striped highlightOnHover withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 2 }}>
                  Класс
                </Table.Th>
                {data.subjects.map((s) => (
                  <Table.Th key={s.id} style={{ minWidth: 90, textAlign: 'center' }}>
                    {s.name}
                  </Table.Th>
                ))}
                <Table.Th style={{ textAlign: 'center' }}>Всего</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleClasses.map((c) => {
                const t = data.totals[c.id]
                return (
                  <Table.Tr key={c.id}>
                    <Table.Td style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 1, fontWeight: 600 }}>
                      {c.grade}{c.letter}
                    </Table.Td>
                    {data.subjects.map((s) => {
                      const cell = data.matrix[c.id]?.[s.id]
                      if (!cell || cell.status === 'idle') {
                        return <Table.Td key={s.id} style={{ textAlign: 'center', color: 'var(--mantine-color-dimmed)' }}>—</Table.Td>
                      }
                      const color = STATUS_COLORS[cell.status]
                      const tooltip = `${STATUS_LABEL[cell.status]}: план ${cell.declared} ч, факт ${cell.actual} ч`
                      const display = cell.declared === cell.actual
                        ? `${cell.declared}`
                        : `${cell.actual}/${cell.declared}`
                      return (
                        <Table.Td key={s.id} style={{ textAlign: 'center', padding: 4 }}>
                          <Tooltip label={tooltip} withArrow>
                            <Badge
                              variant="light"
                              color={color ?? 'gray'}
                              radius="sm"
                              style={{ minWidth: 50 }}
                            >
                              {display}
                            </Badge>
                          </Tooltip>
                        </Table.Td>
                      )
                    })}
                    <Table.Td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {t.actual}/{t.declared}
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Alert variant="light" icon={<IconInfoCircle size={16} />}>
        <Text size="sm">
          БУП формируется автоматически из назначенной нагрузки педагогов и текущего расписания.
          Расхождения между планом и фактом не блокируют действия — это индикатор для завуча.
        </Text>
      </Alert>
    </Stack>
  )
}

export default function StudyPlanPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch']}>
      <StudyPlanInner />
    </RoleGate>
  )
}
