import { PrismaClient, type Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('--- seed-demo: добавляем недостающие demo-данные ---')

  // 0. Демо-юзеры для недостающих ролей (analyst, secretary, curator, specialist)
  const missingRoles: Array<{ login: string; role: Role; email: string; star?: number }> = [
    { login: 'analyst1', role: 'analyst', email: 'analyst@erudit.kg' },
    { login: 'secretary1', role: 'secretary', email: 'secretary@erudit.kg' },
    { login: 'curator1', role: 'curator', email: 'curator@erudit.kg' },
    { login: 'specialist1', role: 'specialist', email: 'specialist@erudit.kg' },
    // Узкие роли сотрудников («заходишь как бухгалтер — другие функции»)
    { login: 'accountant1', role: 'accountant', email: 'accountant@erudit.kg' },
    { login: 'psychologist1', role: 'psychologist', email: 'psychologist@erudit.kg' },
    { login: 'doctor1', role: 'doctor', email: 'doctor@erudit.kg' },
    { login: 'hr1', role: 'hr', email: 'hr@erudit.kg' },
    { login: 'librarian1', role: 'librarian', email: 'librarian@erudit.kg' },
    { login: 'cook1', role: 'cook', email: 'cook@erudit.kg' },
    { login: 'zavhoz1', role: 'zavhoz', email: 'zavhoz@erudit.kg' },
    // eSPSMS: психологическая служба
    { login: 'senior_psy', role: 'senior_psychologist', email: 'senior.psy@erudit.kg' },
    { login: 'safeguard', role: 'safeguarding_lead', email: 'safeguard@erudit.kg' },
    // финансы
    { login: 'callcenter1', role: 'call_center', email: 'callcenter@erudit.kg' },
    // Ивент-менеджер + завучи (наследуют доступ zavuch); 4★ для полноты демо
    { login: 'event1', role: 'event_manager', email: 'event@erudit.kg', star: 4 },
    { login: 'zavuch_primary1', role: 'zavuch_primary', email: 'zavuch.primary@erudit.kg', star: 4 },
    { login: 'zavuch_senior1', role: 'zavuch_senior', email: 'zavuch.senior@erudit.kg', star: 4 },
    { login: 'zavuch_academic1', role: 'zavuch_academic', email: 'zavuch.academic@erudit.kg', star: 4 },
    { login: 'cambridge1', role: 'cambridge_coord', email: 'cambridge@erudit.kg', star: 4 },
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
        starLevel: u.star ?? 1,
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

  // 9. Приёмная (CRM): ~12 лидов по всем этапам воронки
  const leadCount = await prisma.admissionLead.count()
  if (leadCount === 0) {
    const secretaryUser = await prisma.user.findFirst({ where: { role: 'secretary' } })
    const createdById = secretaryUser?.id ?? adminUser.id
    const someClass = await prisma.class.findFirst({ select: { id: true } })
    const leads: Array<Record<string, unknown>> = [
      { stage: 'lead', childName: 'Айдана Токтогулова', targetGrade: 1, parentName: 'Гулнара Токтогулова', phone: '+996 555 111 221', source: 'Звонок' },
      { stage: 'lead', childName: 'Эмир Жумабеков', targetGrade: 5, parentName: 'Бакыт Жумабеков', phone: '+996 700 222 331', source: 'Instagram' },
      { stage: 'lead', childName: 'Алия Касымова', targetGrade: 2, parentName: 'Айгуль Касымова', phone: '+996 555 333 441', source: 'Сайт' },
      { stage: 'testing', childName: 'Тимур Алиев', targetGrade: 7, parentName: 'Эльмира Алиева', phone: '+996 770 444 551', source: 'Рекомендация' },
      { stage: 'testing', childName: 'Сезим Бекова', targetGrade: 3, parentName: 'Нурлан Беков', phone: '+996 555 555 661', source: 'Звонок' },
      { stage: 'psych', childName: 'Адилет Мамытов', targetGrade: 6, parentName: 'Жылдыз Мамытова', phone: '+996 700 666 771', source: 'WhatsApp', mathScore: 78, englishScore: 64 },
      { stage: 'psych', childName: 'Каныкей Орозова', targetGrade: 4, parentName: 'Талант Орозов', phone: '+996 555 777 881', source: 'Сайт', mathScore: 91, englishScore: 85 },
      { stage: 'director', childName: 'Бекзат Иманалиев', targetGrade: 8, parentName: 'Чолпон Иманалиева', phone: '+996 770 888 991', source: 'Рекомендация', mathScore: 84, englishScore: 72, psychNote: 'Адаптивность высокая, мотивация к учёбе выраженная. Рекомендован к зачислению.' },
      { stage: 'contract', childName: 'Айпери Сыдыкова', targetGrade: 1, parentName: 'Мирлан Сыдыков', phone: '+996 555 999 101', source: 'Звонок', mathScore: 88, englishScore: 90, psychNote: 'Готовность к школе полная, развитая речь.', decisionNote: 'Принять. Сильный кандидат.' },
      { stage: 'contract', childName: 'Нурсултан Абдыкадыров', targetGrade: 9, parentName: 'Венера Абдыкадырова', phone: '+996 700 101 112', source: 'Instagram', mathScore: 73, englishScore: 68, psychNote: 'Лёгкая тревожность, рекомендовано сопровождение психолога в адаптационный период.', decisionNote: 'Принять с сопровождением психолога.', contractAmount: 12000, paymentSchedule: 'monthly' },
      { stage: 'enrolled', childName: 'Дастан Эсенов', targetGrade: 5, parentName: 'Айзада Эсенова', phone: '+996 555 121 314', source: 'Рекомендация', mathScore: 95, englishScore: 88, psychNote: 'Отличная готовность, лидерские качества.', decisionNote: 'Принять.', contractAmount: 12000, paymentSchedule: 'quarterly', classId: someClass?.id ?? null },
      { stage: 'rejected', childName: 'Амина Шарипова', targetGrade: 6, parentName: 'Руслан Шарипов', phone: '+996 770 141 516', source: 'Сайт', mathScore: 55, englishScore: 49, rejectReason: 'Родители выбрали школу ближе к дому (переезд в Ош).' },
    ]
    for (const l of leads) {
      await prisma.admissionLead.create({ data: { ...(l as object), createdById } as never })
    }
    console.log(`  + admission leads: ${leads.length}`)
  }

  // 10. Финансы: счета + оплаты ~15 ученикам (для ассистента и финансовой сводки)
  const invoiceCount = await prisma.feeInvoice.count()
  if (invoiceCount < 10) {
    const finStudents = await prisma.student.findMany({ take: 15, select: { id: true } })
    const months = ['сентябрь', 'октябрь', 'ноябрь']
    let invCount = 0
    for (let si = 0; si < finStudents.length; si++) {
      const s = finStudents[si]
      for (let mi = 0; mi < months.length; mi++) {
        const due = new Date()
        due.setMonth(due.getMonth() - (months.length - mi) + 1)
        due.setDate(10)
        // первые 2 месяца оплачены, последний — у половины долг
        const isPaid = mi < 2 || si % 2 === 0
        const inv = await prisma.feeInvoice.create({
          data: {
            studentId: s.id,
            title: `Обучение, ${months[mi]}`,
            period: months[mi],
            amount: 8000,
            status: isPaid ? 'paid' : 'pending',
            dueDate: due,
          },
        })
        if (isPaid) {
          await prisma.payment.create({
            data: { invoiceId: inv.id, amount: 8000, method: si % 3 === 0 ? 'нал' : 'банк', paidAt: due },
          })
        }
        invCount++
      }
    }
    console.log(`  + fee invoices: ${invCount}`)
  }

  // 11. Специалисты: сессии/рекомендации/прогресс психолога и логопеда ~6 ученикам
  const sessCount = await prisma.specialistSession.count()
  if (sessCount === 0) {
    const specialistUser = await prisma.user.findFirst({ where: { role: 'specialist' } })
    if (specialistUser) {
      const psyStudents = await prisma.student.findMany({ take: 6, select: { id: true } })
      const DAY2 = 864e5
      let psyCount = 0
      for (let i = 0; i < psyStudents.length; i++) {
        const s = psyStudents[i]
        const kind = i < 4 ? 'psych' : 'speech'
        // 3 сессии с шагом в неделю
        for (let k = 0; k < 3; k++) {
          await prisma.specialistSession.create({
            data: {
              kind: kind as never,
              studentId: s.id,
              specialistId: specialistUser.id,
              date: new Date(Date.now() - (21 - k * 7) * DAY2),
              startTime: '10:00',
              endTime: '10:45',
              note: kind === 'psych'
                ? ['Первичная диагностика: лёгкая тревожность в период адаптации.', 'Динамика положительная, тревожность снижается.', 'Стабильное состояние, продолжаем поддерживающие встречи.'][k]
                : ['Постановка звука «Р»: подготовительные упражнения.', 'Звук поставлен изолированно, автоматизация в слогах.', 'Автоматизация в словах и фразах.'][k],
            },
          })
          psyCount++
        }
        await prisma.specialistRecommendation.create({
          data: {
            kind: kind as never,
            studentId: s.id,
            specialistId: specialistUser.id,
            text: kind === 'psych'
              ? 'Рекомендации родителям: соблюдать режим дня, хвалить за усилия, не сравнивать с другими детьми. Повторная встреча через 2 недели.'
              : 'Ежедневные артикуляционные упражнения дома по 10 минут, контроль звука в свободной речи.',
            date: new Date(Date.now() - 7 * DAY2),
          },
        })
        // динамика метрики 3 точки
        const metric = kind === 'psych' ? 'тревожность' : 'звук «Р»'
        const values = kind === 'psych' ? [62, 48, 35] : [30, 55, 75]
        for (let k = 0; k < 3; k++) {
          await prisma.specialistProgress.create({
            data: {
              kind: kind as never,
              studentId: s.id,
              specialistId: specialistUser.id,
              metric,
              value: values[k],
              date: new Date(Date.now() - (21 - k * 7) * DAY2),
            },
          })
        }
      }
      console.log(`  + specialist sessions: ${psyCount} (+recs +progress)`)
    }
  }

  // 12. Посещаемость за 30 дней — сэмплу учеников (для трендов ассистента)
  const since30 = new Date(Date.now() - 30 * 864e5)
  const attCount = await prisma.attendance.count({ where: { date: { gte: since30 } } })
  if (attCount < 100) {
    const attStudents = await prisma.student.findMany({ take: 20, select: { id: true } })
    const rows: Array<{ studentId: string; date: Date; status: 'present' | 'absent' | 'late' }> = []
    for (let d = 0; d <= 30; d++) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - d)
      if (date.getDay() === 0 || date.getDay() === 6) continue // выходные
      for (let si = 0; si < attStudents.length; si++) {
        // детерминированный «рандом»: в основном присутствие, изредка пропуски/опоздания
        const roll = (d * 7 + si * 13) % 20
        const status = roll === 0 ? 'absent' : roll === 1 ? 'late' : 'present'
        rows.push({ studentId: attStudents[si].id, date, status })
      }
    }
    const created = await prisma.attendance.createMany({ data: rows, skipDuplicates: true })
    console.log(`  + attendance rows: ${created.count}`)
  }

  // 13. База знаний школы — документы для ассистента («отвечает за менеджера»)
  const kbCount = await prisma.knowledgeDoc.count()
  if (kbCount === 0) {
    const kbDocs = [
      {
        title: 'Режим работы школы',
        category: 'режим',
        content:
          'Школа работает с понедельника по пятницу. Уроки начинаются в 08:30, заканчиваются в 15:10. ' +
          'Продолжительность урока — 45 минут, перемены по 10 минут, большая перемена после 3-го урока — 20 минут. ' +
          'Завтрак для начальных классов в 09:15, обед — с 12:00 до 13:00 по графику классов. ' +
          'Продлёнка и секции (внеурочка) — с 15:30 до 18:00. Суббота и воскресенье — выходные. ' +
          'Вход учеников открыт с 08:00, дежурный администратор встречает детей у входа.',
      },
      {
        title: 'Как проходит приём в школу',
        category: 'приём',
        content:
          'Приём нового ученика проходит в несколько этапов. 1) Заявка: родитель звонит или оставляет заявку на сайте/в Instagram. ' +
          '2) Тестирование: ребёнок проходит базовый тест по математике, при желании — по английскому языку. ' +
          '3) Психолог: беседа и психологическое тестирование, заключение о готовности и адаптации. ' +
          '4) Директор: знакомится с семьёй, изучает результаты и принимает решение. ' +
          '5) Договор: ассистент директора оформляет договор и согласовывает график оплаты (помесячно, по триместрам или за год). ' +
          '6) Зачисление: ученик добавляется в класс, родители получают доступы к системе. ' +
          'В адаптационный период (1–2 месяца) с ребёнком дополнительно работает психолог.',
      },
      {
        title: 'Оплата обучения',
        category: 'оплата',
        content:
          'Оплата обучения производится по договору. Доступны графики: помесячно (до 10 числа каждого месяца), ' +
          'по триместрам или единовременно за учебный год. Способы оплаты: наличными в бухгалтерии, банковским переводом по реквизитам из договора. ' +
          'При задолженности бухгалтерия направляет напоминание родителю. Вопросы по оплате: бухгалтерия школы, кабинет на 1 этаже, ' +
          'часы работы 09:00–17:00 в будние дни.',
      },
      {
        title: 'Контакты и адрес школы',
        category: 'общее',
        content:
          'Школа находится в городе Бишкек. Приёмная работает в будние дни с 08:00 до 17:00. ' +
          'По вопросам приёма обращайтесь к ассистенту директора (приёмная, 1 этаж). ' +
          'Связь с учителями и кураторами — через чаты в системе Bilim OS или через классного куратора. ' +
          'Экстренные вопросы — через раздел «Срочные вопросы» или дежурного администратора.',
      },
    ]
    const kbAuthor = adminUser.id
    for (const d of kbDocs) {
      await prisma.knowledgeDoc.create({ data: { ...d, authorId: kbAuthor } })
    }
    console.log(`  + knowledge docs: ${kbDocs.length}`)
  }

  // 14. PRE-данные: заключения психолога уже зачисленных лидов → кабинет психолога
  const enrolledLeads = await prisma.admissionLead.findMany({
    where: { stage: 'enrolled', enrolledStudentId: { not: null }, psychNote: { not: null } },
    select: { enrolledStudentId: true, psychNote: true },
  })
  if (enrolledLeads.length) {
    const psychUser = await prisma.user.findFirst({ where: { role: 'psychologist' } })
      ?? await prisma.user.findFirst({ where: { role: 'specialist' } })
      ?? adminUser
    let preCount = 0
    for (const l of enrolledLeads) {
      const existing = await prisma.specialistRecommendation.findFirst({
        where: { studentId: l.enrolledStudentId!, text: { startsWith: 'Заключение при поступлении' } },
      })
      if (existing) continue
      await prisma.specialistRecommendation.create({
        data: {
          kind: 'psych',
          studentId: l.enrolledStudentId!,
          specialistId: psychUser.id,
          text: `Заключение при поступлении: ${l.psychNote}`.slice(0, 2000),
        },
      })
      preCount++
    }
    if (preCount) console.log(`  + PRE psych notes transferred: ${preCount}`)
  }

  // 15. Демо-кейс для AI-инсайтов: у ученика заметное падение успеваемости
  //     (хорошие оценки месяц назад → слабые за последние 2 недели)
  const dropMarker = await prisma.grade.findFirst({ where: { comment: 'seed: динамика для AI-инсайтов' } })
  if (!dropMarker) {
    const ts0 = teacherSubjects[0]
    const dropStudent = await prisma.student.findFirst({
      where: { classId: ts0.classId },
      skip: 2,
      select: { id: true, lastName: true },
    })
    if (dropStudent) {
      const mk = (value: number, daysAgo: number) =>
        prisma.grade.create({
          data: {
            studentId: dropStudent.id,
            subjectId: ts0.subjectId,
            categoryId: kontrolnaya.id,
            teacherId: ts0.teacherId,
            periodId: period.id,
            value,
            scale: 'FIVE',
            date: new Date(Date.now() - daysAgo * 864e5),
            status: 'published',
            comment: 'seed: динамика для AI-инсайтов',
          },
        })
      // месяц назад — отличник; последние 2 недели — просел
      await Promise.all([mk(5, 40), mk(5, 35), mk(4, 30), mk(5, 25), mk(3, 10), mk(2, 7), mk(3, 4), mk(2, 1)])
      console.log(`  + AI-insight drop case: ${dropStudent.lastName}`)
    }
  }

  // 15b. Этап 2: итоговые оценки идут через модерацию завуча (по ТЗ)
  const modFix = await prisma.gradeCategory.updateMany({
    where: { name: { contains: 'Итоговая' }, requiresModeration: false },
    data: { requiresModeration: true },
  })
  if (modFix.count) console.log(`  + final categories set to moderation: ${modFix.count}`)

  // 16. Этап 2: назначения-колонки журнала + баллы + заметки-эмодзи
  const asgCount = await prisma.assignment.count()
  if (asgCount === 0) {
    // назначение создаём для пары учителя matematik (демо-учитель показа)
    const demoTeacher = await prisma.teacher.findFirst({
      where: { user: { login: 'matematik' } },
      include: { subjects: { take: 1 } },
    })
    const ts0 = demoTeacher?.subjects[0]
      ? { teacherId: demoTeacher.id, subjectId: demoTeacher.subjects[0].subjectId, classId: demoTeacher.subjects[0].classId }
      : teacherSubjects[0]
    const classnaya = await prisma.gradeCategory.findFirst({ where: { name: { contains: 'лассная' } } })
      ?? await prisma.gradeCategory.findFirst()
    const DAY3 = 864e5
    const asgDefs = [
      { title: 'Классная работа', shortName: 'КЛ1', maxPoints: 20, daysAgo: 12, categoryId: classnaya?.id },
      { title: 'Домашняя работа', shortName: 'ДЗ1', maxPoints: 20, daysAgo: 8, categoryId: classnaya?.id },
      { title: 'Контрольная работа', shortName: 'КР1', maxPoints: 40, daysAgo: 4, categoryId: kontrolnaya.id },
    ]
    const created: { id: string; maxPoints: number; categoryId: string | null; date: Date }[] = []
    for (const d of asgDefs) {
      const a = await prisma.assignment.create({
        data: {
          title: d.title,
          shortName: d.shortName,
          classId: ts0.classId,
          subjectId: ts0.subjectId,
          teacherId: ts0.teacherId,
          periodId: period.id,
          categoryId: d.categoryId ?? null,
          maxPoints: d.maxPoints,
          date: new Date(Date.now() - d.daysAgo * DAY3),
        },
      })
      created.push({ id: a.id, maxPoints: d.maxPoints, categoryId: d.categoryId ?? null, date: a.date })
    }
    // баллы 8 ученикам по назначениям (реалистичный разброс)
    const asgStudents = await prisma.student.findMany({ where: { classId: ts0.classId }, take: 8, select: { id: true } })
    let asgGrades = 0
    for (let si = 0; si < asgStudents.length; si++) {
      for (let ai = 0; ai < created.length; ai++) {
        const a = created[ai]
        const ratio = [0.95, 0.85, 0.7, 0.9, 0.55, 0.8, 0.65, 0.75][(si + ai) % 8]
        await prisma.grade.create({
          data: {
            studentId: asgStudents[si].id,
            subjectId: ts0.subjectId,
            categoryId: a.categoryId ?? kontrolnaya.id,
            teacherId: ts0.teacherId,
            periodId: period.id,
            assignmentId: a.id,
            value: Math.round(a.maxPoints * ratio),
            scale: 'HUNDRED',
            date: a.date,
            status: 'published',
          },
        })
        asgGrades++
      }
    }
    console.log(`  + assignments: ${created.length}, баллов: ${asgGrades}`)

    // заметки-эмодзи (этап 2)
    const noteDefs = [
      { i: 0, type: 'active', description: 'Активно работал у доски' },
      { i: 1, type: 'late', description: 'Опоздал на 10 минут' },
      { i: 2, type: 'good_behavior', description: 'Помог дежурным' },
      { i: 3, type: 'no_homework', description: 'Не принёс домашнюю работу' },
      { i: 4, type: 'excellent', description: 'Лучшая работа в классе' },
    ]
    let noteCount = 0
    for (const n of noteDefs) {
      const st = asgStudents[n.i]
      if (!st) continue
      const dup = await prisma.behaviorIncident.findFirst({ where: { studentId: st.id, type: n.type } })
      if (dup) continue
      await prisma.behaviorIncident.create({
        data: { studentId: st.id, reporterId: adminUser.id, type: n.type, description: n.description, status: 'moderated', parentNotified: true },
      })
      noteCount++
    }
    console.log(`  + notes: ${noteCount}`)
  }

  // 17. Демо-долг у ребёнка parent1: просроченный счёт (пеня) + частично оплаченный.
  //     Нужен для показа таба «Оплата» в дневнике, должников в /finance и напоминаний.
  const parent1 = await prisma.user.findUnique({
    where: { login: 'parent1' },
    select: { parent: { select: { children: { select: { studentId: true }, take: 1 } } } },
  })
  const debtStudentId = parent1?.parent?.children[0]?.studentId
  if (debtStudentId) {
    const overdueMarker = await prisma.feeInvoice.findFirst({
      where: { studentId: debtStudentId, title: 'Обучение, демо-долг' },
    })
    if (!overdueMarker) {
      // просроченный на 30 дней — пеня уже капает
      await prisma.feeInvoice.create({
        data: {
          studentId: debtStudentId,
          title: 'Обучение, демо-долг',
          period: 'прошлый месяц',
          amount: 8000,
          status: 'pending',
          dueDate: new Date(Date.now() - 30 * 864e5),
        },
      })
      // частично оплаченный — текущий месяц
      const partial = await prisma.feeInvoice.create({
        data: {
          studentId: debtStudentId,
          title: 'Обучение, текущий месяц',
          period: 'текущий месяц',
          amount: 8000,
          status: 'partial',
          dueDate: new Date(Date.now() + 5 * 864e5),
        },
      })
      await prisma.payment.create({
        data: { invoiceId: partial.id, amount: 3000, method: 'банк', note: 'Частичная оплата (демо)' },
      })
      console.log('  + демо-долг parent1: просроченный + частичный счёт')
    }
  }

  // 18. eSPSMS: демо психологической службы (кейсы, сессии, методика+версия, замеры, алерт)
  const psyOwner = await prisma.user.findFirst({ where: { role: 'psychologist' } })
  const seniorPsy = await prisma.user.findFirst({ where: { role: 'senior_psychologist' } })
  const psyCaseCount = await prisma.psyCase.count()
  if (psyOwner && psyCaseCount === 0) {
    const psyStudents = await prisma.student.findMany({ take: 4, select: { id: true } })
    if (psyStudents.length >= 3) {
      const DAYP = 864e5
      let tplV2Id: string | null = null
      if (seniorPsy) {
        const v1 = await prisma.psyDiagnosticTemplate.create({ data: { name: 'Шкала тревожности', version: 1, authorId: seniorPsy.id, schema: { metric: 'тревожность', scaleMin: 1, scaleMax: 5, questions: [] }, isActive: false } })
        const v2 = await prisma.psyDiagnosticTemplate.create({ data: { name: 'Шкала тревожности', version: 2, parentTemplateId: v1.id, authorId: seniorPsy.id, schema: { metric: 'тревожность', scaleMin: 1, scaleMax: 10, questions: [] }, mappingRule: { op: 'divide', factor: 2 }, isActive: true } })
        tplV2Id = v2.id
      }
      // кейс 1: зелёный, динамика улучшения (склейка версий через mapping)
      const c1 = await prisma.psyCase.create({ data: { studentId: psyStudents[0].id, ownerId: psyOwner.id, title: 'Адаптация', reason: 'Трудности адаптации в новом классе', riskLevel: 'green', status: 'in_progress' } })
      await prisma.psySession.create({ data: { caseId: c1.id, authorId: psyOwner.id, type: 'primary_diagnosis', rawNote: 'Первичная встреча', dapData: 'Ребёнок замкнут, избегает контакта.', dapAssessment: 'Лёгкая тревожность периода адаптации.', dapPlan: 'Поддерживающие встречи раз в неделю.', isHumanVerified: true, verifiedAt: new Date() } })
      await prisma.psySession.create({ data: { caseId: c1.id, authorId: psyOwner.id, type: 'planned', dapData: 'Стал активнее, появились друзья.', dapAssessment: 'Положительная динамика.', dapPlan: 'Продолжаем наблюдение.', isHumanVerified: true, verifiedAt: new Date() } })
      await prisma.psyMeasurement.create({ data: { caseId: c1.id, metric: 'тревожность', value: 4, templateVersion: 1, date: new Date(Date.now() - 21 * DAYP) } })
      if (tplV2Id) {
        await prisma.psyMeasurement.create({ data: { caseId: c1.id, metric: 'тревожность', value: 6, templateId: tplV2Id, templateVersion: 2, date: new Date(Date.now() - 14 * DAYP) } })
        await prisma.psyMeasurement.create({ data: { caseId: c1.id, metric: 'тревожность', value: 4, templateId: tplV2Id, templateVersion: 2, date: new Date(Date.now() - 7 * DAYP) } })
      }
      // кейс 2: жёлтый
      await prisma.psyCase.create({ data: { studentId: psyStudents[1].id, ownerId: psyOwner.id, title: 'Конфликты со сверстниками', reason: 'Частые конфликты на переменах', riskLevel: 'yellow', status: 'in_progress' } })
      // кейс 3: красный + safeguarding-алерт
      const redReason = 'Подозрение на жестокое обращение в семье. Требуется немедленное реагирование.'
      const c3 = await prisma.psyCase.create({ data: { studentId: psyStudents[2].id, ownerId: psyOwner.id, title: 'Кризисная ситуация', reason: 'Срочное обращение классного руководителя', riskLevel: 'red', riskJustification: redReason, status: 'in_progress' } })
      await prisma.psyAlert.create({ data: { caseId: c3.id, reason: redReason, status: 'open' } })
      console.log('  + eSPSMS demo: 3 кейса, сессии, методика v1/v2, замеры, 1 safeguarding-алерт')
    }
  }

  console.log('--- seed-demo: готово ---')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
