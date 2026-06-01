import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const p = new PrismaClient()

async function main() {
  console.log('=== AUDIT ===')

  // 1. Find bad period names
  const periods = await p.academicPeriod.findMany({ orderBy: { startDate: 'asc' } })
  for (const per of periods) {
    console.log(`Period: "${per.name}" active:${per.isActive} id:${per.id}`)
    if (per.name === 'dasdasd' || per.name.match(/^[a-z]+$/i)) {
      console.log(`  → FIXING: renaming to "3 Триместр 2025-2026"`)
      await p.academicPeriod.update({
        where: { id: per.id },
        data: { name: '3 Триместр 2025-2026' },
      })
    }
  }

  // 2. Rename admin user to Kyrgyz director name
  const admin = await p.user.findUnique({ where: { login: 'admin' } })
  if (admin) {
    console.log(`\nAdmin user: ${admin.login}, updating display...`)
    // Create teacher record for admin if not exists
    const existingTeacher = await p.teacher.findFirst({ where: { userId: admin.id } })
    if (!existingTeacher) {
      await p.teacher.create({
        data: {
          firstName: 'Айдай',
          lastName: 'Бекмуратова',
          middleName: 'Талантовна',
          position: 'Директор школы',
          userId: admin.id,
        },
      })
      console.log('  → Created teacher record: Бекмуратова Айдай Талантовна')
    } else {
      console.log(`  → Teacher already exists: ${existingTeacher.lastName}`)
    }
  }

  // 3. Seed attendance for today and this week (~93% present)
  const students = await p.student.findMany({ select: { id: true } })
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existingToday = await p.attendance.count({ where: { date: { gte: today } } })
  console.log(`\nAttendance today: ${existingToday} records`)

  if (existingToday === 0) {
    console.log('  → Seeding attendance for past 7 days...')
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today)
      date.setDate(date.getDate() - dayOffset)
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue

      const existing = await p.attendance.count({ where: { date } })
      if (existing > 0) continue

      for (const student of students) {
        // ~93% present, 4% absent, 2% late, 1% excused
        const rand = Math.random()
        let status: string
        if (rand < 0.93) status = 'present'
        else if (rand < 0.97) status = 'absent'
        else if (rand < 0.99) status = 'late'
        else status = 'excused'

        await p.attendance.create({
          data: { studentId: student.id, date, status },
        })
      }
      console.log(`    Day -${dayOffset}: seeded ${students.length} records`)
    }
  }

  // 4. Check curators and assign missing ones
  const classes = await p.class.findMany({
    include: { curator: true },
    orderBy: { grade: 'asc' },
  })
  const teachers = await p.teacher.findMany()
  let teacherIdx = 0

  for (const cls of classes) {
    if (!cls.curatorId) {
      const teacher = teachers[teacherIdx % teachers.length]
      await p.class.update({
        where: { id: cls.id },
        data: { curatorId: teacher.id },
      })
      console.log(`\nAssigned curator ${teacher.lastName} to ${cls.grade}${cls.letter}`)
      teacherIdx++
    }
  }

  // 5. Check grades are linked to active period
  const activePeriod = periods.find((per) => per.isActive)
  if (activePeriod) {
    const gradesInActive = await p.grade.count({ where: { periodId: activePeriod.id } })
    console.log(`\nGrades in active period "${activePeriod.name}": ${gradesInActive}`)

    if (gradesInActive < 100) {
      console.log('  → Seeding additional grades for active period...')
      const subjects = await p.subject.findMany()
      const categories = await p.gradeCategory.findMany()
      const allStudents = await p.student.findMany({ include: { class: true } })
      const teacherSubjects = await p.teacherSubject.findMany()

      let count = 0
      for (const ts of teacherSubjects.slice(0, 30)) {
        const classStudents = allStudents.filter((s) => s.classId === ts.classId)
        for (const student of classStudents.slice(0, 10)) {
          const cat = categories[Math.floor(Math.random() * categories.length)]
          const value = [3, 4, 4, 4, 5, 5, 5, 4, 3, 5][Math.floor(Math.random() * 10)]
          const existing = await p.grade.findFirst({
            where: {
              studentId: student.id,
              subjectId: ts.subjectId,
              periodId: activePeriod.id,
              teacherId: ts.teacherId,
            },
          })
          if (existing) continue

          await p.grade.create({
            data: {
              studentId: student.id,
              subjectId: ts.subjectId,
              periodId: activePeriod.id,
              teacherId: ts.teacherId,
              categoryId: cat.id,
              value,
              scale: 'FIVE',
              status: 'published',
              date: new Date(),
            },
          })
          count++
        }
      }
      console.log(`  → Created ${count} grades`)
    }
  }

  // 6. Fix schedule for class 1A — realistic 5 lessons per day
  const class1A = classes.find((c) => c.grade === 1 && c.letter === 'а')
  if (class1A) {
    const scheduleCount = await p.scheduleEntry.count({ where: { classId: class1A.id } })
    console.log(`\nSchedule 1А: ${scheduleCount} entries`)
    if (scheduleCount > 30) {
      // Too many — delete all and reseed with 5 per day
      console.log('  → Cleaning excess schedule entries (keeping max 5 per day)...')
      const entries = await p.scheduleEntry.findMany({
        where: { classId: class1A.id },
        orderBy: [{ dayOfWeek: 'asc' }, { slotId: 'asc' }],
      })

      // Group by day
      const byDay = new Map<number, typeof entries>()
      for (const e of entries) {
        if (!byDay.has(e.dayOfWeek)) byDay.set(e.dayOfWeek, [])
        byDay.get(e.dayOfWeek)!.push(e)
      }

      for (const [day, dayEntries] of byDay) {
        // Keep first 5, delete rest
        const toDelete = dayEntries.slice(5)
        for (const e of toDelete) {
          await p.scheduleEntry.delete({ where: { id: e.id } })
        }
        if (toDelete.length > 0) {
          console.log(`    Day ${day}: removed ${toDelete.length} excess lessons`)
        }
      }
    }
  }

  // Final counts
  const totalGrades = await p.grade.count()
  const totalAtt = await p.attendance.count()
  const todayAtt = await p.attendance.count({ where: { date: { gte: today } } })
  console.log(`\n=== FINAL ===`)
  console.log(`Total grades: ${totalGrades}`)
  console.log(`Total attendance: ${totalAtt}`)
  console.log(`Attendance today: ${todayAtt}`)
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
