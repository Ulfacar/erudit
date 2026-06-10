import { PrismaClient } from '@prisma/client'

/**
 * Идемпотентный демо-сид: ОДИН зачисленный ученик с готовым входным заключением
 * психолога. Нужен, чтобы вживую показать сценарий приёмной (#2): у зачисленного
 * появляется кнопка «Заключение психолога» (риск + текст), а в кабинете психолога
 * кейс помечен бейджем «входная диагностика».
 *
 * Без этого демо J3 у тестировщика BLOCKED — единственный enrolled-лид в seed-demo
 * не имеет реального Student/intake-кейса, поэтому psychCaseId пуст и кнопка скрыта.
 *
 * Идемпотентность: маркер — childName лида. Если связка уже есть — выходим.
 */

const MARKER_NAME = 'Самира Демонстрова'

async function main() {
  const prisma = new PrismaClient()
  try {
    const exists = await prisma.admissionLead.findFirst({ where: { childName: MARKER_NAME } })
    if (exists) {
      console.log('  = seed-demo-intake: демо-связка уже есть, пропускаем')
      return
    }

    const psy =
      (await prisma.user.findFirst({ where: { role: 'psychologist', isActive: true }, select: { id: true } })) ||
      (await prisma.user.findFirst({ where: { role: 'senior_psychologist', isActive: true }, select: { id: true } }))
    const cls = await prisma.class.findFirst({ select: { id: true, branchId: true } })
    const author =
      (await prisma.user.findFirst({ where: { role: 'secretary', isActive: true }, select: { id: true } })) ||
      (await prisma.user.findFirst({ where: { role: 'super_admin', isActive: true }, select: { id: true } }))

    if (!psy || !cls || !author) {
      console.log('  ! seed-demo-intake: нет психолога/класса/секретаря — пропускаем')
      return
    }

    const student = await prisma.student.create({
      data: {
        firstName: 'Самира',
        lastName: 'Демонстрова',
        classId: cls.id,
        status: 'permanent',
        branchId: cls.branchId,
      },
      select: { id: true },
    })

    const intake = await prisma.psyCase.create({
      data: {
        studentId: student.id,
        ownerId: psy.id,
        title: 'Первичная диагностика (поступление)',
        reason: 'PRE-тест при поступлении',
        isIntake: true,
        status: 'closed',
        riskLevel: 'green',
        summary:
          'Готовность к школе высокая. Рекомендуем к зачислению. Эмоциональный фон стабильный, ' +
          'тревожность в пределах нормы, речь развита, саморегуляция соответствует возрасту.',
      },
      select: { id: true },
    })

    await prisma.psySession.create({
      data: {
        caseId: intake.id,
        authorId: psy.id,
        type: 'primary_diagnosis',
        dapData: 'Беседа и рисуночная методика. Контакт устанавливает легко, инструкции понимает с первого раза.',
        dapAssessment: 'Школьная зрелость соответствует возрасту, тревожность низкая, мотивация к обучению выражена.',
        qualNote: 'Спокойна, открыта, отвечает развёрнуто; признаков эмоционального неблагополучия не выявлено.',
        isHumanVerified: true,
        verifiedAt: new Date(),
      },
    })

    await prisma.admissionLead.create({
      data: {
        stage: 'enrolled',
        childName: MARKER_NAME,
        targetGrade: 1,
        parentName: 'Динара Демонстрова',
        phone: '+996 700 000 000',
        source: 'Звонок',
        psychNote: 'Готовность к школе высокая, рекомендована к зачислению.',
        enrolledStudentId: student.id,
        psychCaseId: intake.id,
        branchId: cls.branchId,
        createdById: author.id,
      },
    })

    console.log('  + seed-demo-intake: создан демо-ученик с входным заключением (для приёмной)')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('seed-demo-intake error:', e)
  process.exit(1)
})
