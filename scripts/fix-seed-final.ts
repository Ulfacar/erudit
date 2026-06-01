import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  console.log('=== FIX 1: Merge duplicate periods ===')

  const periods = await p.academicPeriod.findMany({ orderBy: { startDate: 'asc' } })
  for (const per of periods) {
    console.log(`  "${per.name}" id:${per.id} active:${per.isActive}`)
  }

  const real3 = periods.find((per) => per.name === '3 триместр')
  const fake3 = periods.find((per) => per.name === '3 Триместр 2025-2026')

  if (real3 && fake3) {
    // Move grades from fake to real
    const moved = await p.grade.updateMany({
      where: { periodId: fake3.id },
      data: { periodId: real3.id },
    })
    console.log(`  Moved ${moved.count} grades from "${fake3.name}" → "${real3.name}"`)

    // Make real3 active
    await p.academicPeriod.update({ where: { id: real3.id }, data: { isActive: true } })

    // Delete fake
    await p.academicPeriod.delete({ where: { id: fake3.id } })
    console.log(`  Deleted "${fake3.name}"`)
    console.log(`  "${real3.name}" is now active`)
  }

  console.log('\n=== FIX 2: Seed grades for 1 триместр ===')

  const trim1 = periods.find((per) => per.name === '1 триместр')
  if (trim1) {
    const existing = await p.grade.count({ where: { periodId: trim1.id } })
    console.log(`  Grades in "${trim1.name}": ${existing}`)

    if (existing < 50) {
      const teacherSubjects = await p.teacherSubject.findMany()
      const categories = await p.gradeCategory.findMany()
      const students = await p.student.findMany({ select: { id: true, classId: true } })

      let count = 0
      // Seed ~300 grades across classes
      for (const ts of teacherSubjects.slice(0, 40)) {
        const classStudents = students.filter((s) => s.classId === ts.classId)
        for (const student of classStudents.slice(0, 8)) {
          const cat = categories[Math.floor(Math.random() * categories.length)]
          // Slightly lower avg for trim1 (show growth)
          const values = [3, 3, 4, 4, 4, 5, 5, 4, 3, 4]
          const value = values[Math.floor(Math.random() * values.length)]

          const exists = await p.grade.findFirst({
            where: { studentId: student.id, subjectId: ts.subjectId, periodId: trim1.id },
          })
          if (exists) continue

          await p.grade.create({
            data: {
              studentId: student.id,
              subjectId: ts.subjectId,
              periodId: trim1.id,
              teacherId: ts.teacherId,
              categoryId: cat.id,
              value,
              scale: 'FIVE',
              status: 'published',
              date: new Date('2025-10-15'),
            },
          })
          count++
        }
      }
      console.log(`  Created ${count} grades for 1 триместр`)
    }
  }

  console.log('\n=== FIX 3: Fix schedule 1A — realistic 5 lessons/day ===')

  const class1A = await p.class.findFirst({
    where: { grade: 1, letter: 'а' },
  })

  if (class1A) {
    // Delete ALL schedule entries for 1A
    const deleted = await p.scheduleEntry.deleteMany({ where: { classId: class1A.id } })
    console.log(`  Deleted ${deleted.count} old entries for 1А`)

    // Get bell slots (lessons only)
    const bells = await p.bellSchedule.findMany({
      where: { type: 'lesson' },
      orderBy: { slotNumber: 'asc' },
    })
    const lessonSlots = bells.slice(0, 5) // First 5 lesson slots only
    console.log(`  Using ${lessonSlots.length} lesson slots`)

    // Get subjects available for 1A
    const ts = await p.teacherSubject.findMany({
      where: { classId: class1A.id },
      include: { subject: true, teacher: true },
    })
    console.log(`  Subjects available: ${ts.map((t) => t.subject.name).join(', ')}`)

    if (ts.length === 0) {
      console.log('  ⚠ No teacher-subject links for 1А, skipping')
    } else {
      // Realistic schedule: 5 lessons/day, Mon-Fri, no 3 same subjects in a row
      const days = [1, 2, 3, 4, 5] // Mon-Fri

      // Get period dates
      const activePeriod = await p.academicPeriod.findFirst({ where: { isActive: true } })

      let created = 0
      for (const day of days) {
        const daySubjects: string[] = []

        for (let slotIdx = 0; slotIdx < Math.min(5, lessonSlots.length); slotIdx++) {
          // Pick subject - avoid 3 in a row
          let picked = ts[Math.floor(Math.random() * ts.length)]
          let attempts = 0
          while (attempts < 10) {
            const last2 = daySubjects.slice(-2)
            if (last2.length === 2 && last2[0] === picked.subjectId && last2[1] === picked.subjectId) {
              picked = ts[Math.floor(Math.random() * ts.length)]
              attempts++
            } else {
              break
            }
          }

          daySubjects.push(picked.subjectId)

          await p.scheduleEntry.create({
            data: {
              classId: class1A.id,
              teacherId: picked.teacherId,
              subjectId: picked.subjectId,
              slotId: lessonSlots[slotIdx].id,
              dayOfWeek: day,
              periodStart: activePeriod?.startDate ?? new Date('2025-09-01'),
              periodEnd: activePeriod?.endDate ?? new Date('2026-05-31'),
            },
          })
          created++
        }
      }
      console.log(`  Created ${created} schedule entries (5 days × 5 lessons)`)
    }
  }

  // Final verification
  console.log('\n=== VERIFICATION ===')
  const finalPeriods = await p.academicPeriod.findMany({ orderBy: { startDate: 'asc' } })
  for (const per of finalPeriods) {
    const gradeCount = await p.grade.count({ where: { periodId: per.id } })
    console.log(`  "${per.name}" active:${per.isActive} grades:${gradeCount}`)
  }

  const schedule1A = await p.scheduleEntry.count({
    where: { class: { grade: 1, letter: 'а' } },
  })
  console.log(`  Schedule 1А: ${schedule1A} entries`)

  const totalGrades = await p.grade.count()
  console.log(`  Total grades: ${totalGrades}`)
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
