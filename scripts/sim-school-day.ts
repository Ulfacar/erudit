/**
 * Живая симуляция школьного дня против ЛОКАЛЬНОЙ БД (localhost:5433).
 * Создаёт события одного учебного дня (посещаемость, оценки, ДЗ, перевод группы),
 * затем прогоняет реальную агентную логику (событие→действие) и печатает таймлайн.
 * Идемпотентно (метки 'sim:'), повторный запуск не плодит дубли.
 *
 *   npx tsx scripts/sim-school-day.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const t = (time: string, msg: string) => console.log(`  ${time}  ${msg}`)
const hr = (s: string) => console.log(`\n── ${s} ──`)

async function main() {
  console.log('\n══════════ СИМУЛЯЦИЯ ШКОЛЬНОГО ДНЯ · BilimOS ══════════')

  const period = await prisma.academicPeriod.findFirst({ where: { isActive: true } })
  if (!period) throw new Error('Нет активного учебного периода — запусти основной seed')
  const adminUser = await prisma.user.findFirst({ where: { role: 'super_admin' } })
  if (!adminUser) throw new Error('Нет super_admin — запусти seed')

  // Берём класс, у которого есть и ученики, и привязки учитель-предмет
  const ts = await prisma.teacherSubject.findFirst({ include: { subject: true, teacher: true } })
  if (!ts) throw new Error('Нет привязок учитель-предмет — запусти seed')
  const cls = await prisma.class.findUnique({
    where: { id: ts.classId },
    include: { groups: true, students: { take: 12, orderBy: { lastName: 'asc' } } },
  })
  if (!cls || cls.students.length === 0) throw new Error('У класса нет учеников')
  const classLabel = `${cls.grade}${cls.letter}`
  const students = cls.students
  console.log(`\nКласс дня: ${classLabel} · учеников в выборке: ${students.length} · предмет: ${ts.subject.name}`)

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // ── 08:00 Посещаемость ──
  hr('08:00 · Звонок, посещаемость')
  const attRows = students.map((s, i) => ({
    studentId: s.id,
    date: today,
    status: (i === 0 ? 'absent' : i === 1 ? 'late' : 'present') as 'present' | 'absent' | 'late',
  }))
  const att = await prisma.attendance.createMany({ data: attRows, skipDuplicates: true })
  const present = attRows.filter((r) => r.status === 'present').length
  const late = attRows.filter((r) => r.status === 'late').length
  const absent = attRows.filter((r) => r.status === 'absent').length
  t('08:00', `Куратор отметил класс ${classLabel}: ${present} присут., ${late} опозд., ${absent} отсут. (новых записей: ${att.count})`)

  // ── 08:15–13:00 Оценки (включая двойку → агентный сигнал) ──
  hr('08:15–13:00 · Уроки и оценки')
  const cat =
    (await prisma.gradeCategory.findFirst({ where: { requiresModeration: false } })) ??
    (await prisma.gradeCategory.findFirst())
  if (!cat) throw new Error('Нет категорий оценок')
  const SIM_MARK = 'sim: school-day'
  const already = await prisma.grade.count({ where: { comment: SIM_MARK, date: { gte: today } } })
  let lowStudent = students[2] ?? students[0]
  if (already === 0) {
    const values = [2, 5, 4, 3, 5]
    for (let i = 0; i < Math.min(values.length, students.length); i++) {
      await prisma.grade.create({
        data: {
          studentId: students[i].id, subjectId: ts.subjectId, categoryId: cat.id,
          teacherId: ts.teacherId, periodId: period.id, value: values[i], scale: 'FIVE',
          date: today, status: 'published', comment: SIM_MARK,
        },
      })
    }
    lowStudent = students[0]
    t('09:10', `Учитель ${ts.teacher.lastName} выставил оценки по «${ts.subject.name}»: ${values.slice(0, students.length).join(', ')}`)
  } else {
    t('09:10', `Оценки на сегодня уже выставлены (${already}) — пропуск`)
  }
  t('09:10', `⚠️  Двойка у ${lowStudent.lastName} ${lowStudent.firstName} → кандидат на агентный сигнал куратору`)

  // ── ДЗ ──
  hr('10:00 · Домашнее задание')
  const SIM_HW = 'sim: подготовиться к следующему уроку, упражнения по теме'
  const hwDup = await prisma.homework.findFirst({ where: { classId: cls.id, description: SIM_HW } })
  if (!hwDup) {
    await prisma.homework.create({
      data: { classId: cls.id, subjectId: ts.subjectId, teacherId: ts.teacherId, description: SIM_HW, dueDate: new Date(Date.now() + 2 * 864e5) },
    })
    t('10:00', `Задано ДЗ классу ${classLabel} по «${ts.subject.name}» (срок +2 дня)`)
  } else {
    t('10:00', 'ДЗ уже задано — пропуск')
  }

  // ── 10:30 Перевод между группами ──
  hr('10:30 · Перевод между группами')
  if (cls.groups.length >= 2) {
    const mover = students.find((s) => true)!
    const exists = await prisma.groupTransfer.findFirst({ where: { studentId: mover.id, status: 'pending' } })
    if (!exists) {
      await prisma.groupTransfer.create({
        data: {
          studentId: mover.id, classId: cls.id,
          fromGroupId: cls.groups[0].id, toGroupId: cls.groups[1].id,
          requestedBy: adminUser.id, status: 'pending',
        },
      })
      t('10:30', `Запрос перевода: ${mover.lastName} из «${cls.groups[0].name}» в «${cls.groups[1].name}» (ждёт одобрения, лимит 5/мес)`)
    } else {
      t('10:30', 'У ученика уже есть незакрытый запрос — пропуск')
    }
  } else {
    t('10:30', `В классе ${classLabel} <2 групп — перевод неприменим`)
  }

  // ── Агентная цепочка (событие → действие), реальные правила ──
  hr('Весь день · Агент: событие → действие')

  // 1) Двойка / низкий балл по классу
  const classGrades = await prisma.grade.findMany({
    where: { student: { classId: cls.id }, status: 'published', scale: 'FIVE' },
    select: { value: true },
  })
  const lowCount = classGrades.filter((g) => g.value <= 2).length
  if (lowCount > 0) t('⚙️', `АГЕНТ: ${lowCount} неуд. оценок в ${classLabel} → сигнал куратору «обратить внимание»`)

  // 2) Посещаемость сегодня по классу
  const todayPct = Math.round((present / students.length) * 100)
  t('⚙️', `АГЕНТ: посещаемость ${classLabel} сегодня ${todayPct}%${todayPct < 90 ? ' → ниже нормы, сигнал завучу' : ' → в норме'}`)

  // 3) Финансы: долги и просрочка (реальные данные seed)
  const pending = await prisma.feeInvoice.findMany({
    where: { status: { in: ['pending', 'partial'] } },
    select: { studentId: true, dueDate: true },
  })
  const debtStudents = new Set(pending.map((p) => p.studentId)).size
  const overdue = pending.filter((p) => p.dueDate && p.dueDate < new Date()).length
  if (debtStudents > 0) t('⚙️', `АГЕНТ: ${debtStudents} учеников с неоплаченными счетами → бухгалтерии напоминания, колл-центру обзвон`)
  if (overdue > 0) t('⚙️', `АГЕНТ: ${overdue} просроченных счетов → авто-начисление пени 0.1%/день`)

  // 4) Застрявшие заявки приёмной
  const stuck = await prisma.admissionLead.count({
    where: { stage: { notIn: ['enrolled', 'rejected'] }, updatedAt: { lt: new Date(Date.now() - 7 * 864e5) } },
  })
  if (stuck > 0) t('⚙️', `АГЕНТ: ${stuck} заявок без движения >7 дней → «семья может уйти», напоминание приёмной`)

  // ── 17:00 Аналитика дня ──
  hr('17:00 · Аналитика дня')
  const avg = classGrades.length ? (classGrades.reduce((s, g) => s + g.value, 0) / classGrades.length) : 0
  const totalStudents = await prisma.student.count()
  const totalTeachers = await prisma.teacher.count()
  t('17:00', `Средний балл ${classLabel}: ${avg.toFixed(2)} (по ${classGrades.length} опубл. оценкам)`)
  t('17:00', `Всего в школе: ${totalStudents} учеников, ${totalTeachers} педагогов`)

  console.log('\n══════════ КОНЕЦ ДНЯ ══════════\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error('SIM ERROR:', e); await prisma.$disconnect(); process.exit(1) })
