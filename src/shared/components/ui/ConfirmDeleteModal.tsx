'use client'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

interface ConfirmDeleteModalProps {
  opened: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title?: string
  /** Question shown to the user. Default — "Удалить запись?" */
  message?: string
  /** Secondary line shown beneath message in dimmed tone. */
  detail?: string
  /** Loading state while confirm is pending. */
  loading?: boolean
  confirmLabel?: string
  cancelLabel?: string
}

export function ConfirmDeleteModal({
  opened,
  onClose,
  onConfirm,
  title = 'Подтвердите удаление',
  message = 'Удалить запись?',
  detail,
  loading,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={loading ? () => undefined : onClose}
      title={
        <Group gap={8}>
          <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
          <Text fw={600}>{title}</Text>
        </Group>
      }
      centered
      size="sm"
      withCloseButton={!loading}
    >
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        {detail && <Text size="xs" c="dimmed">{detail}</Text>}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button color="red" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
