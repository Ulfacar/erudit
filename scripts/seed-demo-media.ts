import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.mediaRequest.count()
  if (existing > 0) {
    console.log(`[seed-demo-media] skipped (${existing} media requests already exist)`)
    return
  }

  const requester =
    (await prisma.user.findFirst({ where: { login: 'event1', isActive: true }, select: { id: true, login: true, role: true } })) ||
    (await prisma.user.findFirst({ where: { role: 'super_admin', isActive: true }, select: { id: true, login: true, role: true } })) ||
    (await prisma.user.findFirst({ where: { isActive: true }, select: { id: true, login: true, role: true } }))

  if (!requester) {
    console.warn('[seed-demo-media] skipped: no active users found for requesterId')
    return
  }

  const requests = [
    {
      title: 'Съемка: открытый урок физики',
      description: 'STEM-урок, 8 класс',
      location: 'каб. 305',
      priority: 'high' as const,
      status: 'open' as const,
      source: 'lesson',
    },
    {
      title: 'Съемка: городской турнир',
      description: 'награждение для сайта школы',
      location: 'Актовый зал',
      priority: 'high' as const,
      status: 'in_progress' as const,
      source: 'event',
    },
    {
      title: 'Съемка: выпускной альбом',
      location: 'Фотозона',
      priority: 'medium' as const,
      status: 'done' as const,
      source: 'event',
    },
  ]

  await prisma.mediaRequest.createMany({
    data: requests.map((request) => ({
      ...request,
      requesterId: requester.id,
      requesterName: requester.login,
      requesterRole: requester.role,
    })),
  })

  console.log(`[seed-demo-media] ok (${requests.length} media requests, requester: ${requester.login})`)
}

main().catch((e) => { console.error('[seed-demo-media]', e) }).finally(() => prisma.$disconnect())
