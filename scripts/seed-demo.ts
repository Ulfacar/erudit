import { PrismaClient, type Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('--- seed-demo: добавляем недостающие demo-данные ---')

  // 0. Демо-юзеры для недостающих ролей (analyst, secretary, curator, specialist)
  const missingRoles: Array<{ login: string; role: Role; email: string }> = [
    { login: 'analyst1', role: 'analyst', email: 'analyst@erudit.kg' },
    { login: 'secretary1', role: 'secretary', email: 'secretary@erudit.kg' },
    { login: 'curator1', role: 'curator', email: 'curator@erudit.kg' },
    { login: 'specialist1', role: 'specialist', email: 'specialist@erudit.kg' },
  ]
  const pwHash = await hash('erudit2025', 10)
  for (const u of missingRoles) {
    const existing = await prisma.user.findUnique({ where: { login: u.login } })
    if (existing) continue
    await prisma.user.create({
      data: {
        login: u.login,
        email: u.email,
        password: pwHash,
        role: u.role,
        starLevel: 1,
        isActive: true,
      },
    })
    console.log(`  + user: ${u.login} (${u.role})`)
  }

  const period = await prisma.academicPeriod.findFirst({ where: { isActive: true } })
  if (!period) throw new Error('No active academic period — run main seed first')

  const adminUser = await prisma.user.findFirst({ where: { role: 'super_admin' } })
  const zavuchUser = await prisma.user.findFirst({ where: { role: 'zavuch' } })
  if (!adminUser || !zavuchUser) throw new Error('No super_admin/zavuch — run main seed first')

  // 1. Категории с requiresModeration=true (если ещё нет)
  const moderatedCats = [
    { name: 'Контрольная работа', order: 100 },
    { name: 'Зачёт', order: 101 },
    { name: 'Триместровая работа', order: 102 },
    { name: 'Итоговая работа', order: 103 },
    { name: 'Экзамен', order: 104 },
  ]
  for (const c of moderatedCats) {
    const existing = await prisma.gradeCategory.findFirst({ where: { name: c.name } })
    if (!existing) {
      await prisma.gradeCategory.create({
        data: { name: c.name, weight: 5, order: c.order, isAssessment: true, requiresModeration: true, enabledForTeachers: false },
      })
      console.log(`  + category: ${c.name}`)
    }
  }

  const kontrolnaya = await prisma.gradeCategory.findFirst({ where: { name: 'Контрольная работа' } })
  if (!kontrolnaya) throw new Error('Контрольная работа not created')

  // 2. Demo-оценки в разных статусах
  const teacherSubjects = await prisma.teacherSubject.findMany({
    take: 4,
    include: { teacher: true, subject: true },
  })
  if (teacherSubjects.length === 0) throw new Error('No teacher-subjects')

  const statusBuckets: Array<'draft' | 'submitted' | 'moderated' | 'published'> = [
    'draft', 'draft', 'draft',
    'submitted', 'submitted', 'submitted',
    'moderated', 'moderated', 'moderated',
    'published', 'published', 'published',
  ]

  let demoGradeCount = 0
  for (let i = 0; i < statusBuckets.length; i++) {
    const ts = teacherSubjects[i % teacherSubjects.length]
    const student = await prisma.student.findFirst({
      where: { classId: ts.classId },
      skip: i % 3,
    })
    if (!student) continue
    const dup = await prisma.grade.findFirst({
      where: { studentId: student.id, subjectId: ts.subjectId, categoryId: kontrolnaya.id, periodId: period.id },
    })
    if (dup) continue
    await prisma.grade.create({
      data: {
        studentId: student.id,
        subjectId: ts.subjectId,
        categoryId: kontrolnaya.id,
        teacherId: ts.teacherId,
        periodId: period.id,
        value: [3, 4, 5][i % 3],
        scale: 'FIVE',
        date: new Date(),
        status: statusBuckets[i],
        comment: statusBuckets[i] === 'moderated' ? 'Проверено завучем' : null,
      },
    })
    demoGradeCount++
  }
  console.log(`  + demo grades created: ${demoGradeCount}`)

  // 3. GradeAuditLog — для нескольких опубликованных оценок (показать историю правок)
  const someGrades = await prisma.grade.findMany({ where: { status: 'published' }, take: 5 })
  let auditCount = 0
  for (const g of someGrades) {
    const existing = await prisma.gradeAuditLog.findFirst({ where: { gradeId: g.id } })
    if (existing) continue
    await prisma.gradeAuditLog.create({
      data: {
        gradeId: g.id,
        userId: zavuchUser.id,
        oldValue: g.value === 5 ? 4 : g.value - 1,
        newValue: g.value,
        action: 'updated',
      },
    })
    auditCount++
  }
  console.log(`  + audit log entries: ${auditCount}`)

  // 4. TeacherLoadTransfer — Айгуль → Жанара (если такие учителя есть; иначе первые 2)
  const teachers = await prisma.teacher.findMany({ take: 4, include: { subjects: true } })
  if (teachers.length >= 2 && teachers[0].subjects.length > 0) {
    const fromT = teachers[0]
    const toT = teachers[1]
    const subj = fromT.subjects[0]
    const existing = await prisma.teacherLoadTransfer.findFirst({
      where: { fromTeacherId: fromT.id, toTeacherId: toT.id, subjectId: subj.subjectId, classId: subj.classId },
    })
    if (!existing) {
      await prisma.teacherLoadTransfer.create({
        data: {
          fromTeacherId: fromT.id,
          toTeacherId: toT.id,
          subjectId: subj.subjectId,
          classId: subj.classId,
          reason: 'Декретный отпуск с 15.05.2026',
          transferredBy: zavuchUser.id,
        },
      })
      console.log(`  + load transfer: ${fromT.lastName} → ${toT.lastName}`)
    }
    if (teachers.length >= 3 && teachers[2].subjects.length > 0) {
      const fromT2 = teachers[2]
      const toT2 = teachers[1]
      const subj2 = fromT2.subjects[0]
      const existing2 = await prisma.teacherLoadTransfer.findFirst({
        where: { fromTeacherId: fromT2.id, toTeacherId: toT2.id, subjectId: subj2.subjectId, classId: subj2.classId },
      })
      if (!existing2) {
        await prisma.teacherLoadTransfer.create({
          data: {
            fromTeacherId: fromT2.id,
            toTeacherId: toT2.id,
            subjectId: subj2.subjectId,
            classId: subj2.classId,
            reason: 'Длительная болезнь',
            transferredBy: zavuchUser.id,
          },
        })
        console.log(`  + load transfer: ${fromT2.lastName} → ${toT2.lastName}`)
      }
    }
  }

  // 5. TeacherDescriptor — 5 пометок на 3 уровнях
  const descSamples = [
    { i: 0, year: 2025, text: 'Образцовое ведение классной работы, рекомендуется к награждению.', accessLevel: 1 },
    { i: 1, year: 2025, text: 'Опоздание 12.09.2025 — устное замечание.', accessLevel: 2 },
    { i: 1, year: 2025, text: 'Повторное опоздание 20.09.2025 — выговор с занесением в личное дело.', accessLevel: 2 },
    { i: 2, year: 2025, text: 'Конфликт с родителями ученика 7А — обсуждено на педсовете, претензии сняты.', accessLevel: 2 },
    { i: 3, year: 2025, text: 'Конфиденциально: рассматривается перевод на 0.5 ставки по семейным обстоятельствам.', accessLevel: 3 },
  ]
  let descCount = 0
  for (const d of descSamples) {
    if (!teachers[d.i]) continue
    const existing = await prisma.teacherDescriptor.findFirst({
      where: { teacherId: teachers[d.i].id, text: d.text },
    })
    if (existing) continue
    await prisma.teacherDescriptor.create({
      data: {
        teacherId: teachers[d.i].id,
        year: d.year,
        text: d.text,
        accessLevel: d.accessLevel,
        authorId: zavuchUser.id,
      },
    })
    descCount++
  }
  console.log(`  + teacher descriptors: ${descCount}`)

  // 6. Домашние задания — иначе вкладка «ДЗ» в дневнике ученика/родителя пустая.
  //    Идемпотентно: классам, у которых ещё нет ДЗ, добавляем 3 задания с будущими сроками.
  const tsAll = await prisma.teacherSubject.findMany({ include: { subject: true } })
  const classIds = Array.from(
    new Set(tsAll.map((t) => t.classId).filter((c): c is string => !!c)),
  )
  const hwTemplates: Array<(s: string) => string> = [
    (s) => `${s}: выполнить упражнения по новой теме, стр. 42–44`,
    (s) => `${s}: повторить пройденный материал, подготовиться к устному опросу`,
    (s) => `${s}: письменное задание в тетради, задачи 5–9`,
  ]
  const DAY = 864e5
  let hwCount = 0
  for (const classId of classIds) {
    const existing = await prisma.homework.count({ where: { classId } })
    if (existing > 0) continue
    const pick = tsAll.filter((t) => t.classId === classId).slice(0, 3)
    for (let i = 0; i < pick.length; i++) {
      const ts = pick[i]
      await prisma.homework.create({
        data: {
          classId,
          subjectId: ts.subjectId,
          teacherId: ts.teacherId,
          description: hwTemplates[i % hwTemplates.length](ts.subject.name),
          dueDate: new Date(Date.now() + (i + 1) * 2 * DAY),
        },
      })
      hwCount++
    }
  }
  console.log(`  + homework created: ${hwCount}`)

  // 7. Срочные вопросы — для живого дашборда
  const urgentCount = await prisma.urgentIssue.count()
  if (urgentCount === 0) {
    const urgentItems = [
      { title: 'Протечка в кабинете 305', description: 'Обнаружена течь в потолке кабинета 305, нужен срочный вызов сантехника.', priority: 'high' as const, visibleTo: ['super_admin', 'zavuch', 'secretary'] },
      { title: 'Жалоба от родителей 7А', description: 'Родители 7А обратились с жалобой на замену педагога по математике.', priority: 'high' as const, visibleTo: ['super_admin', 'zavuch', 'curator'] },
      { title: 'Замена педагога на пятницу', description: 'Учитель физики Калыков И.Д. отсутствует в пятницу, нужна замена на 3 урока.', priority: 'medium' as const, visibleTo: ['super_admin', 'zavuch'] },
      { title: 'Обновление учебных материалов', description: 'Методобъединение запрашивает закупку новых пособий по английскому для 5-6 классов.', priority: 'low' as const, visibleTo: ['super_admin', 'zavuch', 'teacher'] },
      { title: 'Подготовка к родительскому собранию', description: 'Собрание запланировано на следующую среду, нужны отчёты по успеваемости от классных руководителей.', priority: 'medium' as const, visibleTo: ['super_admin', 'zavuch', 'curator'] },
    ]
    for (const item of urgentItems) {
      await prisma.urgentIssue.create({
        data: { ...item, authorId: zavuchUser.id, status: 'open' },
      })
    }
    console.log(`  + urgent issues: ${urgentItems.length}`)
  }

  // 8. Происшествия — для живого дашборда
  const incidentCount = await prisma.incident.count()
  if (incidentCount === 0) {
    const incidentItems = [
      { title: 'Конфликт между учениками', description: 'В 8А классе произошёл конфликт на перемене. Классный руководитель уведомлён, назначена беседа с психологом.', type: 'behavior' as const, severity: 'high' as const },
      { title: 'Неисправность проектора', description: 'В кабинете информатики вышел из строя проектор. Заявка на ремонт подана.', type: 'equipment' as const, severity: 'medium' as const },
      { title: 'Проверка пожарной безопасности', description: 'Плановая проверка пройдена успешно. Замечаний нет.', type: 'safety' as const, severity: 'low' as const },
    ]
    for (const item of incidentItems) {
      await prisma.incident.create({
        data: { ...item, authorId: zavuchUser.id, status: 'open' },
      })
    }
    console.log(`  + incidents: ${incidentItems.length}`)
  }

  console.log('--- seed-demo: готово ---')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
