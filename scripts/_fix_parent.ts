import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  // Remove old link to 7Б student
  await p.parentStudent.delete({
    where: {
      parentId_studentId: {
        parentId: 'cmpjtgdtt0140ukogdz5muezo',
        studentId: 'cmpjtf6c400rcukog2qz1jukh',
      },
    },
  })
  console.log('Removed old link')

  // Find a student from elementary school (2А)
  const kid = await p.student.findFirst({
    where: { class: { grade: 2, letter: 'а' } },
    include: { class: { include: { level: true } } },
  })
  if (!kid) throw new Error('No student found in 2А')
  console.log('New kid:', kid.firstName, kid.lastName, kid.class.grade + kid.class.letter, kid.class.level.name)

  // Link to parent1
  await p.parentStudent.create({
    data: {
      parentId: 'cmpjtgdtt0140ukogdz5muezo',
      studentId: kid.id,
      relation: 'мать',
    },
  })

  // Verify
  const v = await p.parent.findFirst({
    where: { id: 'cmpjtgdtt0140ukogdz5muezo' },
    include: {
      children: {
        include: { student: { include: { class: { include: { level: true } } } } },
      },
    },
  })
  console.log('parent1 kids:')
  v!.children.forEach((c) =>
    console.log(' ', c.student.firstName, c.student.lastName, c.student.class.grade + c.student.class.letter, '-', c.student.class.level.name)
  )
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
