import { PrismaClient } from '@prisma/client'

// Base seed: ТОЛЬКО справочные данные (схемы наград), безопасные для реальной школы.
// НЕ создаёт и НЕ трогает пользователей — демо-аккаунты ролей вынесены в
// scripts/seed-demo-users.ts (запускается только при SEED_DEMO=1). Так обычный
// production-рестарт не создаёт демо-юзеров, не активирует и не меняет пароли/роли/филиал.
const prisma = new PrismaClient()

async function main() {

  const awardSchemes = [
    {
      id: 'award-places',
      name: 'Места',
      type: 'places',
      isPreset: true,
      values: [
        { value: 'place_1', label: '1 место', weight: 100 },
        { value: 'place_2', label: '2 место', weight: 80 },
        { value: 'place_3', label: '3 место', weight: 60 },
        { value: 'diploma', label: 'Диплом/грамота', weight: 40 },
        { value: 'participant', label: 'Участие', weight: 10 },
      ],
    },
    {
      id: 'award-medals',
      name: 'Медали',
      type: 'medals',
      isPreset: true,
      values: [
        { value: 'gold', label: 'Золото', weight: 100 },
        { value: 'silver', label: 'Серебро', weight: 80 },
        { value: 'bronze', label: 'Бронза', weight: 60 },
        { value: 'honorable', label: 'Похвальная грамота', weight: 40 },
        { value: 'participant', label: 'Участие', weight: 10 },
      ],
    },
  ]
  for (const scheme of awardSchemes) {
    await prisma.awardScheme.upsert({
      where: { id: scheme.id },
      update: {},
      create: scheme,
    })
  }

  console.log(`[seed-roles] ok (${awardSchemes.length} схем наград; демо-пользователи в seed-demo-users при SEED_DEMO=1)`)
}

main().catch((e) => { console.error('[seed-roles]', e) }).finally(() => prisma.$disconnect())
