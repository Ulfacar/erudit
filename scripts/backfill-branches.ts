import { PrismaClient } from '@prisma/client'

/**
 * Идемпотентный бэкфилл многофилиальности: создаёт филиал «Главный» и
 * проставляет branchId всем существующим сущностям, где он пустой.
 */
async function main() {
  const prisma = new PrismaClient()
  let main = await prisma.branch.findFirst({ where: { name: 'Главный' } })
  if (!main) {
    main = await prisma.branch.create({ data: { name: 'Главный', isActive: true } })
    console.log('  + создан филиал «Главный»:', main.id)
  }
  const bid = main.id
  const contractsByBranch = await prisma.contract.findMany({
    where: { branchId: null },
    select: { id: true, studentId: true },
  })
  const students = await prisma.student.findMany({
    where: { id: { in: contractsByBranch.map((contract) => contract.studentId) }, branchId: { not: null } },
    select: { id: true, branchId: true },
  })
  const studentBranch = new Map(students.map((student) => [student.id, student.branchId]))
  const contractIdsByBranch = new Map<string, string[]>()
  for (const contract of contractsByBranch) {
    const branchId = studentBranch.get(contract.studentId)
    if (!branchId) continue
    contractIdsByBranch.set(branchId, [...(contractIdsByBranch.get(branchId) ?? []), contract.id])
  }
  let contracts = 0
  for (const [branchId, ids] of contractIdsByBranch) {
    contracts += (await prisma.contract.updateMany({ where: { branchId: null, id: { in: ids } }, data: { branchId } })).count
  }
  const r = {
    students: (await prisma.student.updateMany({ where: { branchId: null }, data: { branchId: bid } })).count,
    classes: (await prisma.class.updateMany({ where: { branchId: null }, data: { branchId: bid } })).count,
    staff: (await prisma.staffMember.updateMany({ where: { branchId: null }, data: { branchId: bid } })).count,
    leads: (await prisma.admissionLead.updateMany({ where: { branchId: null }, data: { branchId: bid } })).count,
    expenses: (await prisma.expense.updateMany({ where: { branchId: null }, data: { branchId: bid } })).count,
    contracts,
    // сотрудники получают домашний филиал; ученики/родители — null (видят своё через связь)
    staffUsers: (await prisma.user.updateMany({ where: { branchId: null, role: { notIn: ['student', 'parent', 'super_admin', 'analyst'] } }, data: { branchId: bid } })).count,
  }
  console.log('  backfill:', JSON.stringify(r))
  const total = await prisma.branch.count()
  console.log('  branches total:', total)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
