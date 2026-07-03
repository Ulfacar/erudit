import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const branch =
    (await prisma.branch.findFirst({ where: { name: 'Филиал Юг' } })) ??
    (await prisma.branch.create({ data: { name: 'Филиал Юг', isActive: true } }))

  const level =
    (await prisma.schoolLevel.findFirst({ where: { fromGrade: { lte: 1 }, toGrade: { gte: 1 } } })) ??
    (await prisma.schoolLevel.create({ data: { name: 'Начальная школа', fromGrade: 1, toGrade: 4 } }))

  const klass =
    (await prisma.class.findFirst({ where: { grade: 1, letter: 'Ю', branchId: branch.id } })) ??
    (await prisma.class.create({
      data: { grade: 1, letter: 'Ю', levelId: level.id, branchId: branch.id, capacity: 24 },
    }))

  const password = await hash('erudit2025', 10)
  const teacherUser = await prisma.user.upsert({
    where: { login: 'teacher_south1' },
    update: { role: 'teacher', branchId: branch.id, isActive: true },
    create: {
      login: 'teacher_south1',
      email: 'teacher_south1@erudit.local',
      password,
      role: 'teacher',
      starLevel: 1,
      isActive: true,
      branchId: branch.id,
    },
  })

  const teacher =
    (await prisma.teacher.findUnique({ where: { userId: teacherUser.id } })) ??
    (await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        firstName: 'Айжан',
        lastName: 'Южная',
        middleName: 'Муратовна',
        position: 'Учитель начальных классов',
      },
    }))

  if (!klass.curatorId) {
    await prisma.class.update({ where: { id: klass.id }, data: { curatorId: teacher.id } })
  }

  const studentsData = [
    { firstName: 'Алихан', lastName: 'Юсупов', middleName: 'Бакытович' },
    { firstName: 'Сабина', lastName: 'Юнусова', middleName: 'Тимуровна' },
  ]
  const students = []
  for (const data of studentsData) {
    const student =
      (await prisma.student.findFirst({
        where: { firstName: data.firstName, lastName: data.lastName, classId: klass.id },
      })) ??
      (await prisma.student.create({
        data: { ...data, classId: klass.id, branchId: branch.id, status: 'permanent' },
      }))
    if (student.branchId !== branch.id) {
      students.push(await prisma.student.update({ where: { id: student.id }, data: { branchId: branch.id } }))
    } else {
      students.push(student)
    }
  }

  const author = (await prisma.user.findFirst({ where: { role: 'super_admin' } })) ?? teacherUser
  const existingContract = await prisma.contract.findFirst({ where: { number: 'SOUTH-2026-001' } })
  if (!existingContract) {
    await prisma.contract.create({
      data: {
        number: 'SOUTH-2026-001',
        studentId: students[0].id,
        branchId: branch.id,
        year: '2026-2027',
        baseAmount: 80000,
        amount: 80000,
        discountPct: 0,
        prepaymentPct: 0,
        scheduleType: 'monthly',
        scheduleMonths: 9,
        paymentDay: 10,
        createdById: author.id,
      },
    })
  }

  console.log(`seed-branch2: branch=${branch.id}, class=${klass.id}, students=${students.length}, teacher=${teacherUser.login}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
