'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconHistory, IconLock } from '@tabler/icons-react'

interface TransferRecord {
  transfer: {
    id: string
    fromTeacherId: string
    toTeacherId: string
    subjectId: string
    classId: string
    reason: string | null
    transferredAt: string
    transferredBy: string
  }
  readonlyGrades: Array<{
    id: string
    studentId: string
    value: number
    scale: string
    date: string
    status: string
    category: { name: string; weight: number }
  }>
  readonlySchedule: Array<{
    id: string
    dayOfWeek: number
    periodStart: string
    periodEnd: string
    slot: { slotNumber: number; startTime: string; endTime: string }
  }>
}

interface Props {
  teacherId: string
}

const DOW = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function TeacherTransfers({ teacherId }: Props) {
  const [items, setItems] = useState<TransferRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/workload/transfer?toTeacherId=${teacherId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItems(j.data)
        else setError(j.error?.message ?? 'Ошибка')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false))
  }, [teacherId])

  if (loading) {
    return (
      <Card withBorder>
        <Box ta="center" py="md"><Loader size="sm" /></Box>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={14} />}>{error}</Alert>
    )
  }

  if (items.length === 0) {
    return null // нет передач — не показываем ничего
  }

  return (
    <Card withBorder padding="md">
      <Group gap={6} mb="sm">
        <IconHistory size={18} />
        <Title order={4}>Передачи нагрузки</Title>
        <Badge size="sm" color="violet" variant="light">{items.length}</Badge>
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Прошлые оценки и расписание от предыдущих педагогов до даты передачи. Только для просмотра.
      </Text>

      <Stack gap="md">
        {items.map((rec) => (
          <Card key={rec.transfer.id} withBorder padding="sm" radius="sm">
            <Group justify="space-between" mb={4}>
              <Group gap={6}>
                <Badge size="sm" color="grape" variant="light">
                  Передано {new Date(rec.transfer.transferredAt).toLocaleDateString('ru-RU')}
                </Badge>
                <Badge size="sm" color="gray" variant="light" leftSection={<IconLock size={10} />}>
                  read-only
                </Badge>
              </Group>
              {rec.transfer.reason && (
                <Text size="xs" c="dimmed">{rec.transfer.reason}</Text>
              )}
            </Group>

            <Group align="flex-start" gap="md">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={600} mb={4}>Оценки за прошлый период ({rec.readonlyGrades.length})</Text>
                {rec.readonlyGrades.length === 0 ? (
                  <Text size="xs" c="dimmed">Оценок нет</Text>
                ) : (
                  <Table striped fz={11}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Дата</Table.Th>
                        <Table.Th>Категория</Table.Th>
                        <Table.Th>Оценка</Table.Th>
                        <Table.Th>Шкала</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rec.readonlyGrades.slice(0, 10).map((g) => (
                        <Table.Tr key={g.id}>
                          <Table.Td>{new Date(g.date).toLocaleDateString('ru-RU')}</Table.Td>
                          <Table.Td>{g.category.name}</Table.Td>
                          <Table.Td><b>{g.value}</b></Table.Td>
                          <Table.Td>{g.scale}</Table.Td>
                        </Table.Tr>
                      ))}
                      {rec.readonlyGrades.length > 10 && (
                        <Table.Tr>
                          <Table.Td colSpan={4} ta="center">
                            <Text size="xs" c="dimmed">…ещё {rec.readonlyGrades.length - 10}</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                )}
              </Box>

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={600} mb={4}>Расписание ({rec.readonlySchedule.length})</Text>
                {rec.readonlySchedule.length === 0 ? (
                  <Text size="xs" c="dimmed">Записей нет</Text>
                ) : (
                  <Table striped fz={11}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>День</Table.Th>
                        <Table.Th>Слот</Table.Th>
                        <Table.Th>Время</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rec.readonlySchedule.slice(0, 10).map((s) => (
                        <Table.Tr key={s.id}>
                          <Table.Td>{DOW[s.dayOfWeek] ?? s.dayOfWeek}</Table.Td>
                          <Table.Td>№{s.slot.slotNumber}</Table.Td>
                          <Table.Td>{s.slot.startTime}–{s.slot.endTime}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Box>
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  )
}
