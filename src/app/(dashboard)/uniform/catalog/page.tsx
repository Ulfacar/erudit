'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconClipboardList,
  IconHanger2,
  IconShirt,
  IconShoppingBagPlus,
  IconShoppingCartOff,
  IconUsers,
} from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['parent', 'student', 'uniform_manager', 'super_admin'] as const;

type CatalogVariant = { id: string; size: string; available: number };
type CatalogItem = {
  id: string;
  name: string;
  category: string | null;
  image: string | null;
  basic: boolean;
  price: number | null;
  variants: CatalogVariant[];
};
type Child = { studentId: string; firstName: string; lastName: string; className: string | null };
type Me = {
  role: string;
  studentId: string | null;
  student?: { id: string; firstName: string; lastName: string } | null;
  children: Child[];
};
type Reservation = {
  id: string;
  item: { name: string };
  size: string;
  status: string | null;
  paid: boolean;
  amount: number | null;
  issuedAt: string;
};

function priceLabel(item: CatalogItem) {
  return item.basic ? 'Базовый набор' : `${item.price ?? 0} сом`;
}

function categoryLabel(category: string | null) {
  return category === 'merch' ? 'Мерч' : 'Форма';
}

function CatalogItemPhoto({ item, isMerch }: { item: CatalogItem; isMerch: boolean }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [item.image]);

  if (item.image && !imgError) {
    return <Image src={item.image} alt={item.name} h={140} fit="cover" onError={() => setImgError(true)} />;
  }

  return (
    <Group justify="center" h="100%">
      <ThemeIcon
        variant="white"
        color={isMerch ? 'orange' : 'blue'}
        size={64}
        radius="xl"
      >
        {isMerch ? <IconShirt size={34} /> : <IconHanger2 size={34} />}
      </ThemeIcon>
    </Group>
  );
}

function UniformCatalogContent() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const isParent = me?.role === 'parent';
  const isStudent = me?.role === 'student';
  const targetStudentId = isParent ? childId : isStudent ? me?.studentId ?? null : null;

  const childOptions = useMemo(
    () => (me?.children ?? []).map((child) => ({
      value: child.studentId,
      label: `${child.lastName} ${child.firstName}${child.className ? ` · ${child.className}` : ''}`,
    })),
    [me?.children],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [catalogJson, meJson] = await Promise.all([
          fetch('/api/v1/uniform/catalog').then((r) => r.json()),
          fetch('/api/v1/me').then((r) => r.json()),
        ]);
        if (!catalogJson.success) throw new Error(catalogJson.error?.message ?? 'Не удалось загрузить каталог');
        if (!meJson.success) throw new Error(meJson.error?.message ?? 'Не удалось загрузить профиль');

        setItems(catalogJson.data ?? []);
        setMe(meJson.data);
        const firstChildId = meJson.data?.children?.[0]?.studentId ?? null;
        setChildId(firstChildId);
      } catch (error) {
        notifications.show({
          color: 'red',
          title: 'Ошибка',
          message: error instanceof Error ? error.message : 'Не удалось загрузить каталог формы',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadReservations(studentId = targetStudentId) {
    setReservationsLoading(true);
    try {
      const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
      const json = await fetch(`/api/v1/uniform/reservations${query}`).then((r) => r.json());
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить брони');
      setReservations(json.data ?? []);
    } catch (error) {
      setReservations([]);
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось загрузить брони',
      });
    } finally {
      setReservationsLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    void loadReservations(targetStudentId);
  }, [me, targetStudentId]);

  async function reserve(item: CatalogItem, variant: CatalogVariant) {
    if (!targetStudentId) {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Выберите ученика для брони' });
      return;
    }

    const key = `${item.id}:${variant.size}`;
    setSubmittingKey(key);
    try {
      const res = await fetch('/api/v1/uniform/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, size: variant.size, studentId: targetStudentId }),
      });
      const json = await res.json();
      await loadReservations(targetStudentId);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось забронировать размер');

      notifications.show({
        color: 'green',
        title: 'Готово',
        message: `Бронь создана: ${item.name}, размер ${variant.size}`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось забронировать размер',
      });
    } finally {
      setSubmittingKey(null);
    }
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <ThemeIcon variant="light" color="orange" size={38} radius="md">
          <IconHanger2 size={22} />
        </ThemeIcon>
        <div>
          <Title order={3}>Школьная форма и мерч</Title>
          <Text size="sm" c="dimmed">Выберите товар и размер, чтобы забронировать</Text>
        </div>
        <Badge variant="light" color="orange" radius="sm" ml={4}>{items.length}</Badge>
      </Group>

      {isParent && (
        <Paper withBorder radius="md" p="md" style={{ borderColor: 'var(--mantine-color-orange-4)' }}>
          <Group align="flex-end" gap="md" wrap="wrap">
            <ThemeIcon variant="light" color="orange" size={40} radius="xl">
              <IconUsers size={22} />
            </ThemeIcon>
            <Select
              label="Для кого бронируем"
              description="Выберите ребёнка — размеры станут доступны для брони"
              data={childOptions}
              value={childId}
              onChange={setChildId}
              w={{ base: '100%', sm: 320 }}
              searchable
            />
          </Group>
        </Paper>
      )}

      {loading ? (
        <Paper withBorder radius="md">
          <Group justify="center" p="xl"><Loader /></Group>
        </Paper>
      ) : items.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="xs">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconHanger2 size={30} />
            </ThemeIcon>
            <Text fw={600}>Витрина пока пуста</Text>
            <Text size="sm" c="dimmed" ta="center">Доступных размеров пока нет — загляните позже.</Text>
          </Stack>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {items.map((item) => {
            const isMerch = item.category === 'merch';
            return (
              <Card
                key={item.id}
                withBorder
                radius="md"
                padding="lg"
                shadow="xs"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <Card.Section
                  style={{
                    background: isMerch
                      ? 'var(--mantine-color-orange-light)'
                      : 'var(--mantine-color-blue-light)',
                    height: 140,
                    overflow: 'hidden',
                  }}
                >
                  <CatalogItemPhoto item={item} isMerch={isMerch} />
                </Card.Section>

                <Stack gap="xs" mt="md" style={{ flexGrow: 1 }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Text fw={600} lineClamp={2}>{item.name}</Text>
                    <Badge variant="light" color={isMerch ? 'orange' : 'blue'} radius="sm" style={{ flexShrink: 0 }}>
                      {categoryLabel(item.category)}
                    </Badge>
                  </Group>
                  <Text fw={700} size="lg" c={item.basic ? 'dimmed' : undefined}>
                    {priceLabel(item)}
                  </Text>

                  <Divider label="Размеры и остаток" labelPosition="left" mt="auto" />
                  <Group gap="xs">
                    {item.variants.map((variant) => {
                      const key = `${item.id}:${variant.size}`;
                      return (
                        <Button
                          key={variant.id}
                          size="compact-sm"
                          variant="light"
                          color="orange"
                          radius="xl"
                          leftSection={<IconShoppingBagPlus size={14} />}
                          loading={submittingKey === key}
                          disabled={!targetStudentId}
                          onClick={() => reserve(item, variant)}
                        >
                          {variant.size} · {variant.available}
                        </Button>
                      );
                    })}
                  </Group>
                  {!targetStudentId && (isParent || isStudent) && (
                    <Text size="xs" c="dimmed">Выберите ученика, чтобы забронировать размер</Text>
                  )}
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      <Paper withBorder radius="md" p="md">
        <Group gap="xs" mb="sm">
          <ThemeIcon variant="light" color="orange" size={32} radius="md">
            <IconClipboardList size={18} />
          </ThemeIcon>
          <Text fw={600}>Мои брони</Text>
          {reservations.length > 0 && (
            <Badge variant="light" color="gray" radius="sm">{reservations.length}</Badge>
          )}
        </Group>
        {reservationsLoading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : reservations.length === 0 ? (
          <Stack align="center" gap="xs" py="lg">
            <ThemeIcon variant="light" color="gray" size={48} radius="xl">
              <IconShoppingCartOff size={26} />
            </ThemeIcon>
            <Text size="sm" c="dimmed" ta="center">Броней пока нет — выберите размер на витрине выше.</Text>
          </Stack>
        ) : (
          <Stack gap="xs">
            {reservations.map((reservation) => (
              <Paper key={reservation.id} withBorder radius="md" p="sm">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon variant="light" color="orange" size={34} radius="md">
                      <IconShirt size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">{reservation.item?.name ?? '—'}</Text>
                      <Text size="xs" c="dimmed">Размер: {reservation.size}</Text>
                    </div>
                  </Group>
                  <Badge variant="light" color={reservation.status === 'reserved' ? 'yellow' : reservation.status === 'cancelled' ? 'red' : 'green'} radius="sm">
                    {reservation.status === 'reserved' ? 'Бронь' : reservation.status === 'cancelled' ? 'Отменена' : 'Выдано'}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {!isParent && !isStudent && (
        <Text size="sm" c="dimmed">
          Каталог доступен для просмотра. Бронь из интерфейса оформляют родитель или ученик.
        </Text>
      )}
    </Stack>
  );
}

export default function UniformCatalogPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <UniformCatalogContent />
    </RoleGate>
  );
}
