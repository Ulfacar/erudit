import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'

const adapter = new PrismaPg(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

const hash = (pw: string) => hashSync(pw, 10)
const PASSWORD = hash('erudit2025')

// Deterministic pseudo-random for reproducible seeds
let _seed = 42
function seededRandom() {
  _seed = (_seed * 16807) % 2147483647
  return (_seed - 1) / 2147483646
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)]
}
function randInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min
}

async function main() {
  console.log('Seeding database...')

  // =============================================
  // STEP 1: SCHOOL STRUCTURE
  // =============================================

  // Levels
  const levelPrimary = await prisma.schoolLevel.create({
    data: { name: 'Начальная школа', fromGrade: 0, toGrade: 3 },
  })
  const levelMiddle = await prisma.schoolLevel.create({
    data: { name: 'Средняя школа', fromGrade: 4, toGrade: 6 },
  })
  const levelSenior = await prisma.schoolLevel.create({
    data: { name: 'Старшая школа', fromGrade: 7, toGrade: 11 },
  })

  // Classes
  const classDefinitions: { grade: number; letter: string; levelId: string }[] = [
    // Primary
    { grade: 1, letter: 'а', levelId: levelPrimary.id },
    { grade: 1, letter: 'б', levelId: levelPrimary.id },
    { grade: 2, letter: 'а', levelId: levelPrimary.id },
    { grade: 2, letter: 'б', levelId: levelPrimary.id },
    { grade: 3, letter: 'а', levelId: levelPrimary.id },
    { grade: 3, letter: 'б', levelId: levelPrimary.id },
    // Middle
    { grade: 5, letter: 'а', levelId: levelMiddle.id },
    { grade: 5, letter: 'б', levelId: levelMiddle.id },
    { grade: 6, letter: 'а', levelId: levelMiddle.id },
    { grade: 6, letter: 'б', levelId: levelMiddle.id },
    // Senior
    { grade: 7, letter: 'а', levelId: levelSenior.id },
    { grade: 7, letter: 'б', levelId: levelSenior.id },
    { grade: 8, letter: 'а', levelId: levelSenior.id },
    { grade: 8, letter: 'б', levelId: levelSenior.id },
    { grade: 9, letter: 'а', levelId: levelSenior.id },
    { grade: 9, letter: 'б', levelId: levelSenior.id },
    { grade: 10, letter: '', levelId: levelSenior.id },
    { grade: 11, letter: '', levelId: levelSenior.id },
  ]

  const classes: Record<string, Awaited<ReturnType<typeof prisma.class.create>>> = {}
  for (const def of classDefinitions) {
    const key = `${def.grade}${def.letter}`
    classes[key] = await prisma.class.create({ data: def })
  }

  // Academic periods (trimesters)
  const period1 = await prisma.academicPeriod.create({
    data: {
      name: '1 триместр',
      type: 'trimester',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-11-30'),
      isActive: false,
    },
  })
  const period2 = await prisma.academicPeriod.create({
    data: {
      name: '2 триместр',
      type: 'trimester',
      startDate: new Date('2025-12-01'),
      endDate: new Date('2026-02-28'),
      isActive: true,
    },
  })
  const period3 = await prisma.academicPeriod.create({
    data: {
      name: '3 триместр',
      type: 'trimester',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-05-31'),
      isActive: false,
    },
  })
  const activePeriod = period2

  // Bell schedule: 21 slots
  const bellSlots = [
    { slotNumber: 1, startTime: '08:00', endTime: '08:20', type: 'breakfast' as const },
    { slotNumber: 2, startTime: '08:30', endTime: '09:10', type: 'lesson' as const },
    { slotNumber: 3, startTime: '09:10', endTime: '09:20', type: 'break_time' as const },
    { slotNumber: 4, startTime: '09:20', endTime: '10:00', type: 'lesson' as const },
    { slotNumber: 5, startTime: '10:00', endTime: '10:15', type: 'break_time' as const },
    { slotNumber: 6, startTime: '10:15', endTime: '10:55', type: 'lesson' as const },
    { slotNumber: 7, startTime: '10:55', endTime: '11:10', type: 'break_time' as const },
    { slotNumber: 8, startTime: '11:10', endTime: '11:50', type: 'lesson' as const },
    { slotNumber: 9, startTime: '11:50', endTime: '12:20', type: 'lunch' as const },
    { slotNumber: 10, startTime: '12:20', endTime: '13:00', type: 'lesson' as const },
    { slotNumber: 11, startTime: '13:00', endTime: '13:10', type: 'break_time' as const },
    { slotNumber: 12, startTime: '13:10', endTime: '13:50', type: 'lesson' as const },
    { slotNumber: 13, startTime: '13:50', endTime: '14:00', type: 'break_time' as const },
    { slotNumber: 14, startTime: '14:00', endTime: '14:40', type: 'lesson' as const },
    { slotNumber: 15, startTime: '14:40', endTime: '14:50', type: 'break_time' as const },
    { slotNumber: 16, startTime: '14:50', endTime: '15:30', type: 'lesson' as const },
    { slotNumber: 17, startTime: '15:30', endTime: '15:50', type: 'snack' as const },
    { slotNumber: 18, startTime: '15:50', endTime: '16:30', type: 'lesson' as const },
    { slotNumber: 19, startTime: '16:30', endTime: '16:40', type: 'break_time' as const },
    { slotNumber: 20, startTime: '16:40', endTime: '17:20', type: 'lesson' as const },
    { slotNumber: 21, startTime: '17:20', endTime: '17:30', type: 'dismissal' as const },
  ]

  const bellSchedule: Record<number, Awaited<ReturnType<typeof prisma.bellSchedule.create>>> = {}
  for (const slot of bellSlots) {
    bellSchedule[slot.slotNumber] = await prisma.bellSchedule.create({ data: slot })
  }

  // Lesson-only slots for schedule entries
  const lessonSlotNumbers = bellSlots.filter(s => s.type === 'lesson').map(s => s.slotNumber)
  // [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] — 10 lesson slots

  // Grade categories — 1-в-1 из ТЗ (раздел "Оценивание", таблица 26 категорий)
  // requiresModeration=true → оценка идёт на модерацию (ТЗ: КР, триместр, год, экзамен, зачёт)
  // isAssessment=true → "является проверочной работой" (для отчёта №4 — диктанты, эссе, лабы и т.д.)
  const categoryDefs = [
    { name: 'Правила (терминология)',     weight: 2, order: 1,  isAssessment: false },
    { name: 'Пятиминутка',                weight: 2, order: 2,  isAssessment: false },
    { name: 'Разноуровневые задания',     weight: 3, order: 3,  isAssessment: false },
    { name: 'Домашнее задание',           weight: 1, order: 4,  isAssessment: false },
    { name: 'Устный ответ/работа у доски', weight: 3, order: 5,  isAssessment: false },
    { name: 'Письменные работы',          weight: 3, order: 6,  isAssessment: true },
    { name: 'Диктант',                    weight: 5, order: 7,  isAssessment: true },
    { name: 'Словарный диктант',          weight: 5, order: 8,  isAssessment: true },
    { name: 'Тест',                       weight: 4, order: 9,  isAssessment: true },
    { name: 'Аудирование',                weight: 3, order: 10, isAssessment: false },
    { name: 'Грамматика',                 weight: 3, order: 11, isAssessment: false },
    { name: 'Чтение и понимание',         weight: 3, order: 12, isAssessment: false },
    { name: 'Контрольное списывание',     weight: 3, order: 13, isAssessment: true },
    { name: 'Эссе',                       weight: 4, order: 14, isAssessment: true },
    { name: 'Лабораторная работа',        weight: 4, order: 15, isAssessment: true },
    { name: 'Проект',                     weight: 3, order: 16, isAssessment: false },
    { name: 'Презентация',                weight: 3, order: 17, isAssessment: false },
    { name: 'Творческие работы',          weight: 2, order: 18, isAssessment: false },
    { name: 'Самооценивание',             weight: 1, order: 19, isAssessment: false },
    { name: 'Работа в группах (коммуникация)', weight: 2, order: 20, isAssessment: false },
    { name: 'Олимпиадные задания',        weight: 5, order: 21, isAssessment: false },
    // Категории на модерацию (по ТЗ — серые до утверждения)
    { name: 'Контрольная работа',         weight: 5, order: 22, isAssessment: true,  requiresModeration: true },
    { name: 'Зачёт',                      weight: 5, order: 23, isAssessment: true,  requiresModeration: true },
    { name: 'Триместровая работа',        weight: 5, order: 24, isAssessment: true,  requiresModeration: true },
    { name: 'Итоговая работа',            weight: 5, order: 25, isAssessment: true,  requiresModeration: true },
    { name: 'Экзамен',                    weight: 5, order: 26, isAssessment: true,  requiresModeration: true },
  ] as Array<{ name: string; weight: number; order: number; isAssessment: boolean; requiresModeration?: boolean }>;

  const gradeCategories: Awaited<ReturnType<typeof prisma.gradeCategory.create>>[] = []
  for (const cat of categoryDefs) {
    gradeCategories.push(await prisma.gradeCategory.create({ data: cat }))
  }

  // =============================================
  // STEP 2: SUBJECTS
  // =============================================

  const subjectDefs = [
    { name: 'Кыргызский язык', color: '#e74c3c' },
    { name: 'Русский язык', color: '#3498db' },
    { name: 'Математика', color: '#2ecc71' },
    { name: 'Английский язык', color: '#9b59b6' },
    { name: 'Биология', color: '#27ae60' },
    { name: 'География', color: '#f39c12' },
    { name: 'Информатика', color: '#1abc9c' },
    { name: 'Физика', color: '#e67e22' },
    { name: 'Химия', color: '#e91e63' },
    { name: 'Чтение', color: '#8e44ad' },
    { name: 'Окружающий мир', color: '#16a085' },
    { name: 'ИЗО', color: '#f1c40f' },
    { name: 'Музыка', color: '#d35400' },
    { name: 'Физкультура', color: '#c0392b' },
    { name: 'Труд', color: '#7f8c8d' },
    { name: 'История', color: '#795548' },
  ]

  const subjects: Record<string, Awaited<ReturnType<typeof prisma.subject.create>>> = {}
  for (const s of subjectDefs) {
    subjects[s.name] = await prisma.subject.create({ data: s })
  }

  // =============================================
  // STEP 3: ADMIN & ZAVUCH USERS (non-teacher)
  // =============================================

  await prisma.user.create({
    data: {
      login: 'admin',
      email: 'admin@erudit.kg',
      password: PASSWORD,
      role: 'super_admin',
    },
  })

  const zavuchUser = await prisma.user.create({
    data: {
      login: 'kozlova',
      email: 'kozlova@erudit.kg',
      password: PASSWORD,
      role: 'zavuch',
    },
  })

  // =============================================
  // STEP 4: TEACHERS WITH WORKLOAD
  // =============================================

  interface TeacherDef {
    firstName: string
    lastName: string
    middleName?: string
    login: string
    position?: string
    assignments: { subject: string; classKeys: string[]; hoursPerWeek: number }[]
  }

  const teacherDefs: TeacherDef[] = [
    {
      firstName: 'Махабат', lastName: 'Ажибаева', middleName: 'Касымовна',
      login: 'azhibaeva', position: 'Учитель кыргызского языка',
      assignments: [
        { subject: 'Кыргызский язык', classKeys: ['7а','7б','8а','8б','9а','9б','10','11'], hoursPerWeek: 3 },
      ],
    },
    {
      firstName: 'Елена', lastName: 'Хайдарова', middleName: 'Викторовна',
      login: 'khaydarova', position: 'Учитель русского языка',
      assignments: [
        { subject: 'Русский язык', classKeys: ['6а','6б','7а','8б'], hoursPerWeek: 5 },
      ],
    },
    {
      firstName: 'Зульфия', lastName: 'Пулатова', middleName: 'Рахимовна',
      login: 'pulatova', position: 'Учитель математики',
      assignments: [
        { subject: 'Математика', classKeys: ['5а','5б','6а','6б'], hoursPerWeek: 5 },
      ],
    },
    {
      firstName: 'Назира', lastName: 'Сагынтай кызы',
      login: 'sagyntai', position: 'Учитель математики',
      assignments: [
        { subject: 'Математика', classKeys: ['7а','7б','8а'], hoursPerWeek: 5 },
      ],
    },
    {
      firstName: 'Валентина', lastName: 'Егорова', middleName: 'Сергеевна',
      login: 'egorova', position: 'Учитель английского языка',
      assignments: [
        { subject: 'Английский язык', classKeys: ['6а','6б','7а','8а'], hoursPerWeek: 4 },
      ],
    },
    {
      firstName: 'Жанна', lastName: 'Фоминых', middleName: 'Александровна',
      login: 'fominykh', position: 'Учитель биологии',
      assignments: [
        { subject: 'Биология', classKeys: ['5а','5б','6а','6б','7а','7б','8а','8б','9а','9б'], hoursPerWeek: 2 },
      ],
    },
    {
      firstName: 'Илья', lastName: 'Калыков', middleName: 'Дмитриевич',
      login: 'kalykov', position: 'Учитель географии',
      assignments: [
        { subject: 'География', classKeys: ['5а','5б','6а','6б','7а','7б','8а','8б'], hoursPerWeek: 2 },
      ],
    },
    {
      firstName: 'Сулейман', lastName: 'Имашев', middleName: 'Бекович',
      login: 'imashev', position: 'Учитель информатики',
      assignments: [
        { subject: 'Информатика', classKeys: ['5а','5б','6а','6б','7а','7б','8а','8б','9а','9б','10','11'], hoursPerWeek: 1 },
      ],
    },
    {
      firstName: 'Артур', lastName: 'Сатаркулов', middleName: 'Маратович',
      login: 'satarkulov', position: 'Учитель физики',
      assignments: [
        { subject: 'Физика', classKeys: ['7а','7б','8а','8б','9а','9б','10'], hoursPerWeek: 2 },
      ],
    },
    {
      firstName: 'Гулжамал', lastName: 'Бакашова', middleName: 'Токтосуновна',
      login: 'bakashova', position: 'Учитель химии',
      assignments: [
        { subject: 'Химия', classKeys: ['7а','7б','8а','8б','9а','9б','10'], hoursPerWeek: 2 },
      ],
    },
    // 5 primary school teachers — each teaches their own class
    {
      firstName: 'Айгуль', lastName: 'Токтобекова', middleName: 'Нурлановна',
      login: 'toktobekova', position: 'Учитель начальных классов',
      assignments: [
        { subject: 'Русский язык', classKeys: ['1а'], hoursPerWeek: 5 },
        { subject: 'Математика', classKeys: ['1а'], hoursPerWeek: 4 },
        { subject: 'Чтение', classKeys: ['1а'], hoursPerWeek: 4 },
        { subject: 'Окружающий мир', classKeys: ['1а'], hoursPerWeek: 2 },
        { subject: 'ИЗО', classKeys: ['1а'], hoursPerWeek: 1 },
        { subject: 'Музыка', classKeys: ['1а'], hoursPerWeek: 1 },
        { subject: 'Физкультура', classKeys: ['1а'], hoursPerWeek: 2 },
        { subject: 'Труд', classKeys: ['1а'], hoursPerWeek: 1 },
      ],
    },
    {
      firstName: 'Марина', lastName: 'Ковалева', middleName: 'Петровна',
      login: 'kovaleva', position: 'Учитель начальных классов',
      assignments: [
        { subject: 'Русский язык', classKeys: ['1б'], hoursPerWeek: 5 },
        { subject: 'Математика', classKeys: ['1б'], hoursPerWeek: 4 },
        { subject: 'Чтение', classKeys: ['1б'], hoursPerWeek: 4 },
        { subject: 'Окружающий мир', classKeys: ['1б'], hoursPerWeek: 2 },
        { subject: 'ИЗО', classKeys: ['1б'], hoursPerWeek: 1 },
        { subject: 'Музыка', classKeys: ['1б'], hoursPerWeek: 1 },
        { subject: 'Физкультура', classKeys: ['1б'], hoursPerWeek: 2 },
        { subject: 'Труд', classKeys: ['1б'], hoursPerWeek: 1 },
      ],
    },
    {
      firstName: 'Оксана', lastName: 'Федорова', middleName: 'Андреевна',
      login: 'fedorova', position: 'Учитель начальных классов',
      assignments: [
        { subject: 'Русский язык', classKeys: ['2а','2б'], hoursPerWeek: 5 },
        { subject: 'Математика', classKeys: ['2а','2б'], hoursPerWeek: 4 },
        { subject: 'Чтение', classKeys: ['2а','2б'], hoursPerWeek: 4 },
        { subject: 'Окружающий мир', classKeys: ['2а','2б'], hoursPerWeek: 2 },
      ],
    },
    {
      firstName: 'Наталья', lastName: 'Сидорова', middleName: 'Игоревна',
      login: 'sidorova', position: 'Учитель начальных классов',
      assignments: [
        { subject: 'Русский язык', classKeys: ['3а','3б'], hoursPerWeek: 5 },
        { subject: 'Математика', classKeys: ['3а','3б'], hoursPerWeek: 4 },
        { subject: 'Чтение', classKeys: ['3а','3б'], hoursPerWeek: 4 },
        { subject: 'Окружающий мир', classKeys: ['3а','3б'], hoursPerWeek: 2 },
      ],
    },
    {
      firstName: 'Динара', lastName: 'Асанова', middleName: 'Кайратовна',
      login: 'asanova', position: 'Учитель истории',
      assignments: [
        { subject: 'История', classKeys: ['5а','5б','6а','6б','7а','7б','8а','8б','9а','9б'], hoursPerWeek: 2 },
      ],
    },
  ]

  // Create teachers and their assignments
  interface TeacherRecord {
    teacher: Awaited<ReturnType<typeof prisma.teacher.create>>
    userId: string
    def: TeacherDef
  }
  const teachers: Record<string, TeacherRecord> = {}

  // Also track TeacherSubject records for schedule/grade generation
  interface TSRecord {
    teacherId: string
    subjectId: string
    classId: string
    classKey: string
    subjectName: string
    hoursPerWeek: number
    teacherLogin: string
  }
  const allTeacherSubjects: TSRecord[] = []

  for (const def of teacherDefs) {
    const user = await prisma.user.create({
      data: {
        login: def.login,
        email: `${def.login}@erudit.kg`,
        password: PASSWORD,
        role: 'teacher',
      },
    })
    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        firstName: def.firstName,
        lastName: def.lastName,
        middleName: def.middleName,
        position: def.position,
        hireDate: new Date('2023-09-01'),
      },
    })
    teachers[def.login] = { teacher, userId: user.id, def }

    for (const assignment of def.assignments) {
      const subject = subjects[assignment.subject]
      for (const classKey of assignment.classKeys) {
        const cls = classes[classKey]
        await prisma.teacherSubject.create({
          data: {
            teacherId: teacher.id,
            subjectId: subject.id,
            classId: cls.id,
            hoursPerWeek: assignment.hoursPerWeek,
          },
        })
        allTeacherSubjects.push({
          teacherId: teacher.id,
          subjectId: subject.id,
          classId: cls.id,
          classKey,
          subjectName: assignment.subject,
          hoursPerWeek: assignment.hoursPerWeek,
          teacherLogin: def.login,
        })
      }
    }
  }

  // Assign curators: primary teachers to their classes
  await prisma.class.update({ where: { id: classes['1а'].id }, data: { curatorId: teachers['toktobekova'].teacher.id } })
  await prisma.class.update({ where: { id: classes['1б'].id }, data: { curatorId: teachers['kovaleva'].teacher.id } })
  await prisma.class.update({ where: { id: classes['2а'].id }, data: { curatorId: teachers['fedorova'].teacher.id } })
  await prisma.class.update({ where: { id: classes['3а'].id }, data: { curatorId: teachers['sidorova'].teacher.id } })
  await prisma.class.update({ where: { id: classes['5а'].id }, data: { curatorId: teachers['pulatova'].teacher.id } })
  await prisma.class.update({ where: { id: classes['7а'].id }, data: { curatorId: teachers['sagyntai'].teacher.id } })
  await prisma.class.update({ where: { id: classes['9а'].id }, data: { curatorId: teachers['azhibaeva'].teacher.id } })

  // =============================================
  // STEP 5: SCHEDULE ENTRIES FROM WORKLOAD
  // =============================================

  // Track occupied slots: teacherId -> "day-slotNumber" set, classId -> "day-slotNumber" set
  const teacherOccupied: Record<string, Set<string>> = {}
  const classOccupied: Record<string, Set<string>> = {}

  const periodStart = activePeriod.startDate
  const periodEnd = activePeriod.endDate

  for (const ts of allTeacherSubjects) {
    if (!teacherOccupied[ts.teacherId]) teacherOccupied[ts.teacherId] = new Set()
    if (!classOccupied[ts.classId]) classOccupied[ts.classId] = new Set()

    let placed = 0
    // Try to distribute across days 1-5 (Mon-Fri), then across lesson slots
    for (let day = 1; day <= 5 && placed < ts.hoursPerWeek; day++) {
      for (let si = 0; si < lessonSlotNumbers.length && placed < ts.hoursPerWeek; si++) {
        const slotNum = lessonSlotNumbers[si]
        const key = `${day}-${slotNum}`
        if (teacherOccupied[ts.teacherId].has(key)) continue
        if (classOccupied[ts.classId].has(key)) continue

        teacherOccupied[ts.teacherId].add(key)
        classOccupied[ts.classId].add(key)

        await prisma.scheduleEntry.create({
          data: {
            classId: ts.classId,
            teacherId: ts.teacherId,
            subjectId: ts.subjectId,
            slotId: bellSchedule[slotNum].id,
            dayOfWeek: day,
            periodStart,
            periodEnd,
          },
        })
        placed++
      }
    }

    if (placed < ts.hoursPerWeek) {
      console.warn(`Could not fully place ${ts.subjectName} in ${ts.classKey}: placed ${placed}/${ts.hoursPerWeek}`)
    }
  }

  console.log('Schedule entries created.')

  // =============================================
  // STEP 6: STUDENTS + PARENTS
  // =============================================

  const firstNamesMale = ['Азамат','Бекзат','Данияр','Эрлан','Тимур','Арсен','Нурбек','Кайрат','Султан','Алмаз','Максим','Дмитрий','Артём','Иван','Кирилл']
  const firstNamesFemale = ['Айжан','Бегимай','Гулзат','Динара','Элиза','Зарина','Камила','Нургуль','Сезим','Алтынай','Анна','Мария','Дарья','София','Екатерина']
  const lastNames = ['Асанов','Бекмуратов','Токтосунов','Жумабеков','Карыпов','Иванов','Петров','Сидоров','Ким','Ли','Абдуллаев','Маматов','Усубалиев','Жапаров','Тургунов']

  // Classes that have teachers assigned (from allTeacherSubjects)
  const classesWithTeachers = [...new Set(allTeacherSubjects.map(ts => ts.classKey))]

  interface StudentRecord {
    student: Awaited<ReturnType<typeof prisma.student.create>>
    classKey: string
  }
  const allStudents: StudentRecord[] = []

  let studentCounter = 0
  for (const classKey of classesWithTeachers) {
    const cls = classes[classKey]
    const count = randInt(8, 10)
    for (let i = 0; i < count; i++) {
      const isMale = seededRandom() > 0.5
      const firstName = isMale
        ? firstNamesMale[studentCounter % firstNamesMale.length]
        : firstNamesFemale[studentCounter % firstNamesFemale.length]
      const lastName = lastNames[studentCounter % lastNames.length] + (isMale ? '' : 'а')
      const birthYear = 2025 - (cls.grade + 6)

      const studentUser = await prisma.user.create({
        data: {
          login: `student${studentCounter + 1}`,
          password: PASSWORD,
          role: 'student',
        },
      })

      const student = await prisma.student.create({
        data: {
          userId: studentUser.id,
          firstName,
          lastName,
          dateOfBirth: new Date(`${birthYear}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`),
          classId: cls.id,
        },
      })

      allStudents.push({ student, classKey })
      studentCounter++
    }
  }

  console.log(`Created ${allStudents.length} students.`)

  // =============================================
  // STEP 6b: MEDICAL DATA FOR 10 STUDENTS
  // =============================================

  const medicalDataSamples = [
    { allergies: 'Пенициллин', foodReactions: ['орехи', 'молочные'], chronicDiseases: 'Астма', vision: 'норма', hearing: 'норма' },
    { allergies: 'Пыльца', foodReactions: ['глютен'], chronicDiseases: null, vision: 'миопия -1.5', hearing: 'норма' },
    { allergies: null, foodReactions: ['цитрусовые', 'шоколад'], chronicDiseases: 'Диабет 1 типа', vision: 'норма', hearing: 'норма' },
    { allergies: 'Амоксициллин, Сульфаниламиды', foodReactions: ['морепродукты'], chronicDiseases: null, vision: 'норма', hearing: 'снижение слуха на левое ухо' },
    { allergies: 'Пыль, шерсть животных', foodReactions: [], chronicDiseases: 'Бронхиальная астма', vision: 'миопия -2.0', hearing: 'норма' },
    { allergies: null, foodReactions: ['лактоза'], chronicDiseases: 'Гастрит', vision: 'норма', hearing: 'норма' },
    { allergies: 'Новокаин', foodReactions: ['яйца', 'рыба'], chronicDiseases: null, vision: 'дальнозоркость +1.0', hearing: 'норма' },
    { allergies: 'Йод', foodReactions: [], chronicDiseases: 'Аллергический ринит', vision: 'норма', hearing: 'норма' },
    { allergies: null, foodReactions: ['мёд', 'орехи'], chronicDiseases: 'Сколиоз 2 степени', vision: 'миопия -3.0', hearing: 'норма' },
    { allergies: 'Пенициллин, Аспирин', foodReactions: ['молочные', 'соя'], chronicDiseases: 'Атопический дерматит', vision: 'норма', hearing: 'норма' },
  ]

  const studentsForMedical = allStudents.slice(0, 10)
  for (let i = 0; i < studentsForMedical.length; i++) {
    await prisma.student.update({
      where: { id: studentsForMedical[i].student.id },
      data: { medicalData: medicalDataSamples[i] },
    })
  }

  console.log('Added medical data to 10 students.')

  // Parents: create for about 60% of students
  let parentCounter = 0
  const parentFirstNamesMale = ['Бакыт','Ерлан','Мурат','Нуржан','Талант','Алексей','Сергей','Виктор','Андрей','Олег']
  const parentFirstNamesFemale = ['Айнура','Бурул','Гулмира','Жылдыз','Назгул','Ольга','Татьяна','Наталья','Елена','Ирина']

  for (const sr of allStudents) {
    if (seededRandom() > 0.6) continue // skip ~40%
    const isMother = seededRandom() > 0.4
    const pFirstName = isMother
      ? parentFirstNamesFemale[parentCounter % parentFirstNamesFemale.length]
      : parentFirstNamesMale[parentCounter % parentFirstNamesMale.length]
    const pLastName = sr.student.lastName

    const parentUser = await prisma.user.create({
      data: {
        login: `parent${parentCounter + 1}`,
        password: PASSWORD,
        role: 'parent',
      },
    })

    const parent = await prisma.parent.create({
      data: {
        userId: parentUser.id,
        firstName: pFirstName,
        lastName: pLastName,
        phone: `+996 ${randInt(500,799)} ${String(randInt(100000,999999))}`,
      },
    })

    await prisma.parentStudent.create({
      data: {
        parentId: parent.id,
        studentId: sr.student.id,
        relation: isMother ? 'мать' : 'отец',
      },
    })

    parentCounter++
  }

  console.log(`Created ${parentCounter} parents.`)

  // =============================================
  // STEP 7: GRADES LINKED TO ACTUAL SUBJECTS
  // =============================================

  // Build a lookup: classKey -> [{subjectId, teacherId, subjectName}]
  const classSubjects: Record<string, { subjectId: string; teacherId: string; subjectName: string }[]> = {}
  for (const ts of allTeacherSubjects) {
    if (!classSubjects[ts.classKey]) classSubjects[ts.classKey] = []
    classSubjects[ts.classKey].push({
      subjectId: ts.subjectId,
      teacherId: ts.teacherId,
      subjectName: ts.subjectName,
    })
  }

  // Common grade categories for grading
  const gradingCategories = gradeCategories.filter(c =>
    ['Домашняя работа', 'Классная работа', 'Самостоятельная работа', 'Контрольная работа', 'Тест', 'Устный ответ'].includes(c.name)
  )

  let gradeCount = 0
  for (const sr of allStudents) {
    const subjectsInClass = classSubjects[sr.classKey] || []
    for (const subj of subjectsInClass) {
      // 2-4 grades per subject per student
      const numGrades = randInt(2, 4)
      for (let g = 0; g < numGrades; g++) {
        // Generate a grade value with realistic distribution
        const r = seededRandom()
        let value: number
        if (r < 0.05) value = 2
        else if (r < 0.2) value = 3
        else if (r < 0.65) value = 4
        else value = 5

        const category = pick(gradingCategories)
        const dayOffset = randInt(1, 60) // within last 2 months
        const gradeDate = new Date(activePeriod.startDate)
        gradeDate.setDate(gradeDate.getDate() + dayOffset)

        await prisma.grade.create({
          data: {
            studentId: sr.student.id,
            subjectId: subj.subjectId,
            categoryId: category.id,
            teacherId: subj.teacherId,
            periodId: activePeriod.id,
            value,
            date: gradeDate,
            status: 'published',
          },
        })
        gradeCount++
      }
    }
  }

  console.log(`Created ${gradeCount} grades.`)

  // =============================================
  // STEP 8: ATTENDANCE (last 2 weeks)
  // =============================================

  let attendanceCount = 0
  const today = new Date('2026-02-15') // within active period
  for (let dayBack = 0; dayBack < 14; dayBack++) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayBack)
    // Skip weekends
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    for (const sr of allStudents) {
      const r = seededRandom()
      let status: 'present' | 'absent' | 'late' | 'excused'
      if (r < 0.88) status = 'present'
      else if (r < 0.93) status = 'absent'
      else if (r < 0.97) status = 'late'
      else status = 'excused'

      await prisma.attendance.create({
        data: {
          studentId: sr.student.id,
          date,
          status,
        },
      })
      attendanceCount++
    }
  }

  console.log(`Created ${attendanceCount} attendance records.`)

  // =============================================
  // STEP 9: SUBSTITUTIONS
  // =============================================

  // Find schedule entries and create substitutions where a different teacher is free
  const scheduleEntries = await prisma.scheduleEntry.findMany({ take: 20 })

  const substitutionDates = [
    new Date('2026-04-06'),
    new Date('2026-04-07'),
    new Date('2026-04-08'),
    new Date('2026-04-09'),
  ]

  const teacherIds = Object.values(teachers).map(t => t.teacher.id)
  let subCount = 0

  for (let i = 0; i < 4 && i < scheduleEntries.length; i++) {
    const entry = scheduleEntries[i]
    // Find a substitute teacher who is NOT the original and is free at that slot
    const slotKey = `${entry.dayOfWeek}-${bellSlots.find(() => true)?.slotNumber}`
    const candidateTeachers = teacherIds.filter(tid => {
      if (tid === entry.teacherId) return false
      const occupied = teacherOccupied[tid]
      if (!occupied) return true
      // Check the specific day-slot
      const entrySlot = bellSlots.find(b => bellSchedule[b.slotNumber]?.id === entry.slotId)
      if (!entrySlot) return true
      return !occupied.has(`${entry.dayOfWeek}-${entrySlot.slotNumber}`)
    })

    if (candidateTeachers.length === 0) continue

    const substituteId = candidateTeachers[i % candidateTeachers.length]

    await prisma.substitution.create({
      data: {
        date: substitutionDates[i],
        originalTeacherId: entry.teacherId,
        substituteTeacherId: substituteId,
        classId: entry.classId,
        subjectId: entry.subjectId,
        slotId: entry.slotId,
        reason: pick(['Больничный', 'Командировка', 'Личные обстоятельства', 'Повышение квалификации']),
      },
    })
    subCount++
  }

  console.log(`Created ${subCount} substitutions.`)

  // =============================================
  // STEP 10: NEWS
  // =============================================

  const adminUser = await prisma.user.findUnique({ where: { login: 'admin' } })

  await prisma.news.create({
    data: {
      title: 'Начало 2 триместра',
      content: 'Уважаемые ученики и родители! Поздравляем с началом второго триместра. Расписание обновлено, пожалуйста, ознакомьтесь с изменениями.',
      type: 'school',
      authorId: adminUser!.id,
      isPublished: true,
    },
  })

  await prisma.news.create({
    data: {
      title: 'Олимпиада по математике',
      content: 'Приглашаем учеников 7-11 классов принять участие в школьной олимпиаде по математике, которая состоится 20 февраля 2026 года.',
      type: 'school',
      authorId: adminUser!.id,
      isPublished: true,
    },
  })

  await prisma.news.create({
    data: {
      title: 'Родительское собрание 5а класса',
      content: 'Уважаемые родители учеников 5а класса! Приглашаем вас на родительское собрание 18 февраля в 18:00 в кабинете 201.',
      type: 'class_note',
      authorId: zavuchUser.id,
      classId: classes['5а'].id,
      isPublished: true,
    },
  })

  await prisma.news.create({
    data: {
      title: 'Педсовет: итоги 1 триместра',
      content: 'Коллеги, педагогический совет по итогам первого триместра состоится 10 декабря в 15:00 в актовом зале. Явка обязательна.',
      type: 'staff',
      authorId: zavuchUser.id,
      isPublished: true,
    },
  })

  console.log('Created news.')

  // =============================================
  // STEP 11: BEHAVIOR INCIDENTS
  // =============================================

  // Pick a few random students for incidents
  const incidentStudents = [allStudents[5], allStudents[20], allStudents[42]].filter(Boolean)

  for (const sr of incidentStudents) {
    await prisma.behaviorIncident.create({
      data: {
        studentId: sr.student.id,
        reporterId: Object.values(teachers)[0].userId,
        type: pick(['Нарушение дисциплины', 'Опоздание', 'Использование телефона']),
        description: pick([
          'Ученик разговаривал на уроке и мешал другим.',
          'Ученик опоздал на урок на 15 минут без уважительной причины.',
          'Ученик использовал мобильный телефон во время контрольной работы.',
        ]),
        status: pick(['pending', 'moderated', 'resolved']),
        parentNotified: seededRandom() > 0.5,
      },
    })
  }

  console.log('Created behavior incidents.')

  // =============================================
  // STEP 12: CHAT MESSAGES
  // =============================================

  const teacherLogins = Object.keys(teachers)
  const chatMessages = [
    { senderLogin: teacherLogins[0], content: 'Коллеги, кто может подменить меня на 3 уроке в среду?' },
    { senderLogin: teacherLogins[1], content: 'Я могу, если это 6а класс.' },
    { senderLogin: teacherLogins[2], content: 'Напоминаю про сдачу планов на следующую неделю до пятницы.' },
    { senderLogin: teacherLogins[3], content: 'Спасибо за информацию!' },
    { senderLogin: teacherLogins[4], content: 'Добрый день! Есть ли у кого-нибудь дополнительные учебники по английскому для 7 класса?' },
    { senderLogin: teacherLogins[5], content: 'У меня есть пара экземпляров, могу принести завтра.' },
  ]

  for (const msg of chatMessages) {
    const t = teachers[msg.senderLogin]
    if (!t) continue
    await prisma.chatMessage.create({
      data: {
        senderId: t.userId,
        roomId: 'teachers-general',
        content: msg.content,
      },
    })
  }

  console.log('Created chat messages.')

  // =============================================
  // STEP 13: URGENT ISSUES
  // =============================================

  await prisma.urgentIssue.create({
    data: {
      title: 'Протечка в кабинете 305',
      description: 'Обнаружена протечка воды на потолке кабинета 305. Требуется срочный ремонт, занятия перенесены.',
      priority: 'high',
      status: 'open',
      authorId: adminUser!.id,
      visibleTo: ['super_admin', 'zavuch'],
    },
  })

  await prisma.urgentIssue.create({
    data: {
      title: 'Жалоба от родителей 7А',
      description: 'Родители учеников 7А класса выражают недовольство объёмом домашних заданий по математике.',
      priority: 'medium',
      status: 'in_progress',
      authorId: zavuchUser.id,
      visibleTo: ['super_admin', 'zavuch', 'curator'],
    },
  })

  await prisma.urgentIssue.create({
    data: {
      title: 'Замена педагога на 15.04',
      description: 'Учитель английского языка заболел, необходимо найти замену на ближайшую неделю.',
      priority: 'high',
      status: 'resolved',
      authorId: zavuchUser.id,
      visibleTo: ['super_admin', 'zavuch', 'teacher'],
      resolvedAt: new Date(),
      resolvedBy: adminUser!.id,
    },
  })

  await prisma.urgentIssue.create({
    data: {
      title: 'Обновление учебных материалов',
      description: 'Необходимо обновить учебники по информатике для 8-9 классов к следующему учебному году.',
      priority: 'low',
      status: 'open',
      authorId: adminUser!.id,
      visibleTo: ['super_admin', 'zavuch', 'teacher'],
    },
  })

  await prisma.urgentIssue.create({
    data: {
      title: 'Ремонт спортзала',
      description: 'Пол в спортзале требует замены покрытия. Занятия временно проводятся на улице.',
      priority: 'medium',
      status: 'closed',
      authorId: adminUser!.id,
      visibleTo: ['super_admin'],
      resolvedAt: new Date(),
      resolvedBy: adminUser!.id,
    },
  })

  console.log('Created urgent issues.')

  // =============================================
  // STEP 14: INCIDENTS
  // =============================================

  await prisma.incident.create({
    data: {
      title: 'Конфликт между учениками 8С',
      description: 'На перемене произошёл конфликт между учениками. Требуется вмешательство психолога и беседа с родителями.',
      type: 'behavior',
      severity: 'high',
      status: 'in_progress',
      authorId: zavuchUser.id,
    },
  })

  await prisma.incident.create({
    data: {
      title: 'Неисправность компьютеров',
      description: 'В компьютерном классе вышли из строя 3 компьютера. Необходим ремонт или замена комплектующих.',
      type: 'equipment',
      severity: 'medium',
      status: 'open',
      authorId: adminUser!.id,
    },
  })

  await prisma.incident.create({
    data: {
      title: 'Ученику стало плохо на уроке',
      description: 'Ученик 5А класса потерял сознание на уроке физкультуры. Вызвана скорая, родители оповещены.',
      type: 'health',
      severity: 'high',
      status: 'resolved',
      authorId: zavuchUser.id,
      resolvedAt: new Date(),
      resolvedBy: zavuchUser.id,
    },
  })

  await prisma.incident.create({
    data: {
      title: 'Пожарная проверка пройдена',
      description: 'Плановая проверка пожарной безопасности успешно пройдена. Замечаний нет.',
      type: 'safety',
      severity: 'low',
      status: 'closed',
      authorId: adminUser!.id,
      resolvedAt: new Date(),
      resolvedBy: adminUser!.id,
    },
  })

  console.log('Created incidents.')

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
