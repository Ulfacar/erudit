import { PrismaClient } from '@prisma/client'

/**
 * Идемпотентный backfill: у учеников есть счета (FeeInvoice), но нет договора (Contract),
 * поэтому в профиле колл-центр видит вкладку «Договоры» пустой («Договоров пока нет»),
 * хотя по ученику числится долг. Смоук J-CC-01.
 *
 * Чиним данные: для каждого ученика со счетами, но без договора, создаём ОДИН активный
 * договор и привязываем к нему его существующие счета (contractId). Тогда:
 *   - вкладка «Договор и платежи» показывает договор;
 *   - баланс считает остаток = долг (total = сумма счетов, paid = сумма оплат);
 *   - «График платежей» = реальные счета (просроченные — красным).
 *
 * Идемпотентность: если у ученика уже есть хоть один Contract — пропускаем.
 * Не фатальный: запускается в predeploy, перебой не валит старт.
 */

async function main() {
  const prisma = new PrismaClient()
  try {
    // ученики, у которых есть счета
    const withInvoices = await prisma.feeInvoice.findMany({
      select: { studentId: true },
      distinct: ['studentId'],
    })
    const studentIds = withInvoices.map((r) => r.studentId)
    if (studentIds.length === 0) {
      console.log('  = backfill-debtor-contracts: счетов нет, пропускаем')
      return
    }

    // у кого уже есть договор — исключаем
    const withContract = await prisma.contract.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true },
      distinct: ['studentId'],
    })
    const haveContract = new Set(withContract.map((r) => r.studentId))
    const targets = studentIds.filter((id) => !haveContract.has(id))
    if (targets.length === 0) {
      console.log('  = backfill-debtor-contracts: у всех учеников со счетами уже есть договор, пропускаем')
      return
    }

    const author = await prisma.user.findFirst({
      where: { role: { in: ['super_admin', 'secretary', 'analyst'] }, isActive: true },
      select: { id: true },
    })
    if (!author) {
      console.warn('  ! backfill-debtor-contracts: нет пользователя-автора, пропускаем')
      return
    }

    let created = 0
    let n = 1
    for (const studentId of targets) {
      const invoices = await prisma.feeInvoice.findMany({
        where: { studentId, contractId: null },
        orderBy: { dueDate: 'asc' },
        select: { id: true, amount: true },
      })
      if (invoices.length === 0) continue

      const total = invoices.reduce((s, inv) => s + inv.amount, 0)
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { branchId: true } })

      await prisma.$transaction(async (tx) => {
        const contract = await tx.contract.create({
          data: {
            studentId,
            number: `Д-${String(n).padStart(3, '0')}`,
            year: '2026–2027',
            baseAmount: total,
            discountPct: 0,
            amount: total,
            prepaymentPct: 0,
            scheduleType: 'monthly',
            scheduleMonths: invoices.length,
            paymentDay: 10,
            status: 'active',
            branchId: student?.branchId ?? null,
            createdById: author.id,
          },
        })
        await tx.feeInvoice.updateMany({
          where: { id: { in: invoices.map((i) => i.id) } },
          data: { contractId: contract.id },
        })
      })
      created++
      n++
    }

    console.log(`  + backfill-debtor-contracts: создано договоров ${created} (привязаны существующие счета)`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('backfill-debtor-contracts error:', e)
  process.exit(1)
})
