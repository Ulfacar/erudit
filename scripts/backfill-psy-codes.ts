import { PrismaClient } from '@prisma/client'

/**
 * Идемпотентный backfill: каждому ученику — персональный номер участника психослужбы
 * `У-####` (ТЗ Эмира: «каждому ученику необходимо ID прикрепить» для конфиденциальности —
 * по коду, а не по ФИО). Поле Student.psyCode @unique.
 *
 * Идемпотентность: пропускаем учеников, у кого psyCode уже есть; нумерация продолжается
 * с максимального существующего. Не фатальный — запускается в predeploy.
 */

async function main() {
  const prisma = new PrismaClient()
  try {
    const without = await prisma.student.findMany({
      where: { psyCode: null },
      select: { id: true },
      orderBy: { enrolledAt: 'asc' },
    })
    if (without.length === 0) {
      console.log('  = backfill-psy-codes: у всех учеников уже есть psyCode, пропускаем')
      return
    }

    // продолжаем нумерацию с максимума существующих кодов
    const existing = await prisma.student.findMany({
      where: { psyCode: { not: null } },
      select: { psyCode: true },
    })
    let next = existing.reduce((max, s) => {
      const n = parseInt(String(s.psyCode).replace(/\D/g, ''), 10)
      return Number.isFinite(n) && n > max ? n : max
    }, 0) + 1

    let assigned = 0
    for (const s of without) {
      const code = `У-${String(next).padStart(4, '0')}`
      await prisma.student.update({ where: { id: s.id }, data: { psyCode: code } })
      next++
      assigned++
    }
    console.log(`  + backfill-psy-codes: присвоено кодов ${assigned}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('backfill-psy-codes error:', e)
  process.exit(1)
})
