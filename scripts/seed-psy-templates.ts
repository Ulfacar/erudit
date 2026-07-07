import { PrismaClient } from '@prisma/client'

/**
 * Идемпотентная предзагрузка СТАНДАРТНЫХ методик психолога (ответ Эмира #9:
 * «пусть будут стандартные готовые шаблоны + возможность собрать в конструкторе»).
 * Грузим классические проективные тесты: «Нарисуй человека», «ДАП-П», «DAP-R».
 * Психолог берёт их из коробки; конструктор по-прежнему доступен для своих методик.
 *
 * Формат schema совпадает с тем, что пишет POST /api/v1/psy/templates:
 *   { metric, scaleMin, scaleMax, questions: [{ text, type }] }
 * Идемпотентность: пропускаем шаблон, если методика с таким именем уже есть.
 */

type Q = { text: string; type: 'scale' | 'text' | 'symptom' | 'file' }

const STANDARD: Array<{ name: string; metric: string; scaleMin: number; scaleMax: number; questions: Q[] }> = [
  {
    name: 'Нарисуй человека',
    metric: 'эмоциональное состояние',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Рисунок ребёнка (фото бланка)', type: 'file' },
      { text: 'Уровень тревожности', type: 'scale' },
      { text: 'Самооценка', type: 'scale' },
      { text: 'Агрессивность', type: 'scale' },
      { text: 'Эмоциональная зрелость', type: 'scale' },
      { text: 'Признаки замкнутости / трудностей контакта', type: 'symptom' },
      { text: 'Общее заключение психолога', type: 'text' },
    ],
  },
  {
    name: 'ДАП-П',
    metric: 'личностные особенности',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Рисунок «Дом-Дерево-Человек» (фото бланка)', type: 'file' },
      { text: 'Тревожность', type: 'scale' },
      { text: 'Чувство незащищённости', type: 'scale' },
      { text: 'Конфликтность в семье', type: 'scale' },
      { text: 'Трудности в общении', type: 'scale' },
      { text: 'Признаки эмоционального неблагополучия', type: 'symptom' },
      { text: 'Интерпретация психолога', type: 'text' },
    ],
  },
  {
    name: 'DAP-R',
    metric: 'эмоциональный риск',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Рисунок (фото бланка)', type: 'file' },
      { text: 'Эмоциональный дистресс', type: 'scale' },
      { text: 'Импульсивность', type: 'scale' },
      { text: 'Депрессивные проявления', type: 'scale' },
      { text: 'Тревожно-фобические проявления', type: 'symptom' },
      { text: 'Заключение и рекомендации', type: 'text' },
    ],
  },
]

const GRADE_BAND_CATALOG: Array<{
  name: string
  gradeBand: string
  direction: string
  metric: string
  scaleMin: number
  scaleMax: number
  questions: Q[]
}> = [
  {
    name: 'Адаптация первоклассника',
    gradeBand: '1-4',
    direction: 'адаптация',
    metric: 'адаптация к школе',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ребенок спокойно включается в школьный день и принимает правила класса', type: 'scale' },
      { text: 'Ребенок поддерживает контакт с учителем и обращается за помощью при затруднениях', type: 'scale' },
      { text: 'Ребенок взаимодействует с одноклассниками без выраженного напряжения', type: 'scale' },
      { text: 'Ребенок сохраняет работоспособность на уроках в течение дня', type: 'scale' },
    ],
  },
  {
    name: 'Шкала тревожности (мл. школа)',
    gradeBand: '1-4',
    direction: 'тревожность',
    metric: 'школьная тревожность',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ребенок заметно волнуется перед ответом у доски или проверочной работой', type: 'scale' },
      { text: 'Ребенок переживает из-за возможных ошибок даже при хорошей подготовке', type: 'scale' },
      { text: 'Ребенку трудно начать задание без дополнительного подтверждения взрослого', type: 'scale' },
      { text: 'Ребенок жалуется на самочувствие в ситуациях учебного напряжения', type: 'scale' },
    ],
  },
  {
    name: 'Учебная мотивация (мл. школа)',
    gradeBand: '1-4',
    direction: 'мотивация',
    metric: 'учебная мотивация',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ребенок проявляет интерес к новым заданиям и учебным темам', type: 'scale' },
      { text: 'Ребенок старается завершать работу даже при первых трудностях', type: 'scale' },
      { text: 'Ребенок положительно реагирует на содержательную обратную связь учителя', type: 'scale' },
      { text: 'Ребенок понимает, зачем ему выполнять учебные задания', type: 'scale' },
    ],
  },
  {
    name: 'Адаптация в 5 классе',
    gradeBand: '5-9',
    direction: 'адаптация',
    metric: 'адаптация к средней школе',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ученик ориентируется в требованиях разных учителей и предметов', type: 'scale' },
      { text: 'Ученик справляется с возросшей учебной нагрузкой без устойчивого истощения', type: 'scale' },
      { text: 'Ученик поддерживает рабочие отношения с одноклассниками', type: 'scale' },
      { text: 'Ученик умеет планировать домашние задания и подготовку к урокам', type: 'scale' },
    ],
  },
  {
    name: 'Агрессия и депрессия (подростки)',
    gradeBand: '5-9',
    direction: 'агрессия_депрессия',
    metric: 'агрессивные и депрессивные проявления',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Подросток часто реагирует раздражением на замечания или просьбы взрослых', type: 'scale' },
      { text: 'Подросток вступает в конфликты со сверстниками или провоцирует их', type: 'scale' },
      { text: 'Подросток демонстрирует снижение интереса к привычным занятиям', type: 'scale' },
      { text: 'Подросток часто выглядит подавленным, уставшим или отстраненным', type: 'scale' },
      { text: 'Подростку трудно говорить о переживаниях и просить поддержки', type: 'scale' },
    ],
  },
  {
    name: 'Социометрия класса',
    gradeBand: '5-9',
    direction: 'социометрия',
    metric: 'социальное положение в классе',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ученик имеет устойчивые позитивные контакты с одноклассниками', type: 'scale' },
      { text: 'Ученик включается в групповые задания и совместные обсуждения', type: 'scale' },
      { text: 'Одноклассники готовы выбирать ученика для совместной учебной работы', type: 'scale' },
      { text: 'Ученик не оказывается в устойчивой изоляции или роли отвергаемого', type: 'scale' },
    ],
  },
  {
    name: 'Профориентация (базовая)',
    gradeBand: '5-9',
    direction: 'профориентация',
    metric: 'базовая профессиональная ориентация',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ученик может назвать учебные предметы и занятия, которые вызывают интерес', type: 'scale' },
      { text: 'Ученик соотносит свои сильные стороны с возможными сферами деятельности', type: 'scale' },
      { text: 'Ученик проявляет готовность узнавать о разных профессиях', type: 'scale' },
      { text: 'Ученик понимает связь школьных предметов с будущим выбором профиля', type: 'scale' },
    ],
  },
  {
    name: 'Уровень стресса (старшая школа)',
    gradeBand: '10-11',
    direction: 'стресс',
    metric: 'уровень учебного стресса',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ученик испытывает выраженное напряжение из-за экзаменов и итоговой аттестации', type: 'scale' },
      { text: 'Ученик сохраняет режим сна и отдыха в периоды высокой нагрузки', type: 'scale' },
      { text: 'Ученик замечает трудности с концентрацией из-за переживаний', type: 'scale' },
      { text: 'Ученик использует конструктивные способы восстановления после учебного дня', type: 'scale' },
    ],
  },
  {
    name: 'Профориентация (углублённая)',
    gradeBand: '10-11',
    direction: 'профориентация',
    metric: 'углубленная профессиональная ориентация',
    scaleMin: 0,
    scaleMax: 10,
    questions: [
      { text: 'Ученик сформулировал несколько реалистичных образовательных или карьерных маршрутов', type: 'scale' },
      { text: 'Ученик учитывает свои способности, интересы и ограничения при выборе направления', type: 'scale' },
      { text: 'Ученик изучает требования колледжей, вузов или программ подготовки', type: 'scale' },
      { text: 'Ученик готов обсуждать профессиональный выбор с семьей и специалистами школы', type: 'scale' },
    ],
  },
]

async function main() {
  const prisma = new PrismaClient()
  try {
    const author =
      (await prisma.user.findFirst({ where: { role: 'senior_psychologist', isActive: true }, select: { id: true } })) ||
      (await prisma.user.findFirst({ where: { role: 'super_admin', isActive: true }, select: { id: true } }))
    if (!author) {
      console.log('  ! seed-psy-templates: нет senior_psychologist/super_admin — пропускаем')
      return
    }

    let created = 0
    for (const t of STANDARD) {
      const exists = await prisma.psyDiagnosticTemplate.findFirst({ where: { name: t.name } })
      if (exists) continue
      await prisma.psyDiagnosticTemplate.create({
        data: {
          name: t.name,
          version: 1,
          authorId: author.id,
          isBase: true,
          schema: { metric: t.metric, scaleMin: t.scaleMin, scaleMax: t.scaleMax, questions: t.questions },
          isActive: true,
        },
      })
      created++
    }
    console.log(`  + seed-psy-templates: добавлено стандартных методик: ${created} (всего эталонных: ${STANDARD.length})`)
    let catalogCreated = 0
    for (const t of GRADE_BAND_CATALOG) {
      const exists = await prisma.psyDiagnosticTemplate.findFirst({ where: { name: t.name } })
      if (exists) continue
      await prisma.psyDiagnosticTemplate.create({
        data: {
          name: t.name,
          version: 1,
          authorId: author.id,
          isBase: true,
          schema: { metric: t.metric, scaleMin: t.scaleMin, scaleMax: t.scaleMax, questions: t.questions },
          gradeBand: t.gradeBand,
          direction: t.direction,
          isActive: true,
        },
      })
      catalogCreated++
    }

    console.log(`  + seed-psy-templates: каталог по ступеням: ${catalogCreated} (всего: ${GRADE_BAND_CATALOG.length})`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('seed-psy-templates error:', e)
  process.exit(1)
})
