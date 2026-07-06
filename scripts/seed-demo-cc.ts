import { PrismaClient, type CcAdmissionStatus, type CcApplicationType, type CcConflictStatus, type CcDocStatus, type CcDocType, type CcExamType, type Prisma } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const DAY = 864e5
const DEMO_MARKER = '[demo-cc]'
const COUNSELOR_LOGIN = 'counselor'
const COUNSELOR_EMAIL = 'counselor@erudit.kg'
const DEMO_PASSWORD = 'erudit2025'
const DEMO_UNIVERSITIES = ['University of Toronto', 'New York University', 'University of Manchester']

type DemoStudent = Prisma.StudentGetPayload<{
  select: {
    id: true
    branchId: true
    firstName: true
    lastName: true
    class: { select: { grade: true; letter: true } }
  }
}>

type ProfileDef = {
  student: DemoStudent
  studentCountries: string[]
  parentCountries: string[]
  studentMajor: string
  studentMotivation: string
  parentMajor: string
  parentBudgetUsd: number
  parentSafety: boolean
  parentExpectations: string
  conflictStatus: CcConflictStatus
  strategyAssigned: boolean
  universityName: string
  country: string
  applicationType: CcApplicationType
  admissionStatus: CcAdmissionStatus
  deadlineDays: number
  scholarshipAmount: string | null
  examType: CcExamType
  scoreCurrent: number
  scoreTarget: number
}

async function getTargetBranchId(): Promise<string | null> {
  const student = await prisma.student.findFirst({
    where: { ccProfile: { is: null }, branchId: { not: null } },
    orderBy: [{ enrolledAt: 'asc' }],
    select: { branchId: true },
  })
  if (student?.branchId) return student.branchId

  const branch = await prisma.branch.findFirst({ select: { id: true } })
  return branch?.id ?? null
}

async function ensureCounselor(targetBranchId: string | null) {
  const password = await hash(DEMO_PASSWORD, 10)
  const existing = await prisma.user.findUnique({ where: { login: COUNSELOR_LOGIN } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        password,
        role: 'college_counselor',
        starLevel: Math.max(existing.starLevel, 1),
        isActive: true,
        branchId: targetBranchId,
      },
    })
  }

  const emailOwner = await prisma.user.findUnique({ where: { email: COUNSELOR_EMAIL } })
  return prisma.user.create({
    data: {
      login: COUNSELOR_LOGIN,
      email: emailOwner ? null : COUNSELOR_EMAIL,
      password,
      role: 'college_counselor',
      starLevel: 1,
      isActive: true,
      branchId: targetBranchId,
    },
  })
}

async function pickStudents(counselorId: string, targetBranchId: string | null): Promise<DemoStudent[]> {
  const selected = new Map<string, DemoStudent>()
  const select = {
    id: true,
    branchId: true,
    firstName: true,
    lastName: true,
    class: { select: { grade: true, letter: true } },
  } satisfies Prisma.StudentSelect

  const existingProfiles = await prisma.ccProfile.findMany({
    where: {
      counselorId,
      OR: [
        { counselorComment: { startsWith: DEMO_MARKER } },
        { applications: { some: { universityName: { in: DEMO_UNIVERSITIES } } } },
      ],
      ...(targetBranchId ? { student: { branchId: targetBranchId } } : {}),
    },
    take: 3,
    orderBy: { createdAt: 'asc' },
    include: { student: { select } },
  })
  for (const profile of existingProfiles) selected.set(profile.student.id, profile.student)

  if (selected.size < 3) {
    const available = await prisma.student.findMany({
      where: {
        ccProfile: { is: null },
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
      },
      take: 3 - selected.size,
      orderBy: [{ enrolledAt: 'asc' }, { lastName: 'asc' }],
      select,
    })
    for (const student of available) selected.set(student.id, student)
  }

  return [...selected.values()].slice(0, 3)
}

async function upsertApplication(profileId: string, def: ProfileDef, index: number) {
  const data = {
    country: def.country,
    program: def.studentMajor,
    applicationType: def.applicationType,
    admissionStatus: def.admissionStatus,
    deadlineDate: new Date(Date.now() + def.deadlineDays * DAY),
    scholarshipAmount: def.scholarshipAmount,
    comment: `${DEMO_MARKER} deadline ${def.deadlineDays} days`,
  }
  const existing = await prisma.ccApplication.findFirst({
    where: { profileId, universityName: def.universityName },
  })
  if (existing) {
    await prisma.ccApplication.update({ where: { id: existing.id }, data })
    return
  }
  await prisma.ccApplication.create({
    data: {
      profileId,
      universityName: def.universityName,
      ...data,
      applicationId: index === 0 ? 'DEMO-CC-READY' : null,
    },
  })
}

async function upsertExam(profileId: string, def: ProfileDef, index: number) {
  const data = {
    testDate: new Date(Date.now() + (18 + index * 7) * DAY),
    scoreCurrent: def.scoreCurrent,
    scoreTarget: def.scoreTarget,
    isMock: index !== 0,
    verified: index === 0,
    comment: `${DEMO_MARKER} exam plan`,
  }
  const existing = await prisma.ccExam.findFirst({ where: { profileId, examType: def.examType } })
  if (existing) {
    await prisma.ccExam.update({ where: { id: existing.id }, data })
    return
  }
  await prisma.ccExam.create({ data: { profileId, examType: def.examType, ...data } })
}

async function upsertDocument(
  profileId: string,
  docType: CcDocType,
  data: {
    status: CcDocStatus
    requestedDeadline: Date
    teacherId?: string | null
    requiredCount?: number | null
    comment: string
  },
) {
  const existing = await prisma.ccDocument.findFirst({
    where: { profileId, docType, teacherId: data.teacherId ?? null },
  })
  if (existing) {
    await prisma.ccDocument.update({ where: { id: existing.id }, data })
    return
  }
  await prisma.ccDocument.create({ data: { profileId, docType, ...data } })
}

async function upsertMeeting(profileId: string, counselorId: string, isRed: boolean) {
  const data = {
    counselorId,
    meetingDate: new Date(Date.now() - 2 * DAY),
    notes: isRed
      ? `${DEMO_MARKER} Family wants a different country and major; mediation is required.`
      : `${DEMO_MARKER} Shortlist and next documents agreed.`,
    actionItems: isRed ? 'Schedule parent alignment meeting' : 'Collect documents and update shortlist',
    format: 'online',
  }
  const existing = await prisma.ccMeeting.findFirst({
    where: { profileId, topic: 'Demo CC strategy' },
  })
  if (existing) {
    await prisma.ccMeeting.update({ where: { id: existing.id }, data })
    return
  }
  await prisma.ccMeeting.create({ data: { profileId, topic: 'Demo CC strategy', ...data } })
}

function buildDefs(students: DemoStudent[]): ProfileDef[] {
  const defs = [
    {
      studentCountries: ['USA', 'Canada'],
      parentCountries: ['USA'],
      studentMajor: 'Computer Science',
      studentMotivation: 'Wants a strong co-op program and research options.',
      parentMajor: 'Computer Science',
      parentBudgetUsd: 35000,
      parentSafety: true,
      parentExpectations: 'Family accepts Canada if scholarships cover part of tuition.',
      conflictStatus: 'green',
      strategyAssigned: true,
      universityName: 'University of Toronto',
      country: 'Canada',
      applicationType: 'regular_decision',
      admissionStatus: 'document_prep',
      deadlineDays: 21,
      scholarshipAmount: '12000',
      examType: 'sat',
      scoreCurrent: 1360,
      scoreTarget: 1450,
    },
    {
      studentCountries: ['USA'],
      parentCountries: ['Germany'],
      studentMajor: 'Design',
      studentMotivation: 'Aiming for a portfolio-led program in New York.',
      parentMajor: 'Business',
      parentBudgetUsd: 0,
      parentSafety: true,
      parentExpectations: 'Parents want lower-cost Europe and a business track.',
      conflictStatus: 'red',
      strategyAssigned: false,
      universityName: 'New York University',
      country: 'USA',
      applicationType: 'early_decision',
      admissionStatus: 'scouting',
      deadlineDays: 4,
      scholarshipAmount: null,
      examType: 'sat',
      scoreCurrent: 1320,
      scoreTarget: 1450,
    },
    {
      studentCountries: ['UK'],
      parentCountries: ['UK', 'Netherlands'],
      studentMajor: 'Economics',
      studentMotivation: 'Interested in quantitative economics and internships.',
      parentMajor: 'Economics',
      parentBudgetUsd: 28000,
      parentSafety: false,
      parentExpectations: 'Family wants a balanced shortlist with scholarship options.',
      conflictStatus: 'yellow',
      strategyAssigned: true,
      universityName: 'University of Manchester',
      country: 'UK',
      applicationType: 'regular_decision',
      admissionStatus: 'document_prep',
      deadlineDays: 12,
      scholarshipAmount: null,
      examType: 'ielts',
      scoreCurrent: 7,
      scoreTarget: 7.5,
    },
  ] satisfies Omit<ProfileDef, 'student'>[]

  return students.map((student, index) => ({ student, ...defs[index] }))
}

async function main() {
  const targetBranchId = await getTargetBranchId()
  const counselor = await ensureCounselor(targetBranchId)
  const students = await pickStudents(counselor.id, targetBranchId)
  if (students.length < 2) {
    console.warn(`[seed-demo-cc] skipped: need at least 2 students without CC profiles, got ${students.length}`)
    return
  }

  const recTeacher = await prisma.teacher.findFirst({ select: { id: true } })
  const defs = buildDefs(students)

  let count = 0
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]
    const isRed = def.conflictStatus === 'red'
    const profile = await prisma.ccProfile.upsert({
      where: { studentId: def.student.id },
      update: {
        counselorId: counselor.id,
        branchId: def.student.branchId,
        studentCountries: def.studentCountries,
        studentMajor: def.studentMajor,
        studentMotivation: def.studentMotivation,
        parentCountries: def.parentCountries,
        parentBudgetUsd: def.parentBudgetUsd,
        parentMajor: def.parentMajor,
        parentSafety: def.parentSafety,
        parentExpectations: def.parentExpectations,
        conflictStatus: def.conflictStatus,
        conflictComputedAt: new Date(),
        riskFlagCleared: false,
        counselorComment: isRed
          ? `${DEMO_MARKER} Red conflict: student and parent goals diverge.`
          : `${DEMO_MARKER} Strategy aligned for ${def.universityName}.`,
        strategyAssigned: def.strategyAssigned,
      },
      create: {
        studentId: def.student.id,
        counselorId: counselor.id,
        branchId: def.student.branchId,
        studentCountries: def.studentCountries,
        studentMajor: def.studentMajor,
        studentMotivation: def.studentMotivation,
        parentCountries: def.parentCountries,
        parentBudgetUsd: def.parentBudgetUsd,
        parentMajor: def.parentMajor,
        parentSafety: def.parentSafety,
        parentExpectations: def.parentExpectations,
        conflictStatus: def.conflictStatus,
        conflictComputedAt: new Date(),
        riskFlagCleared: false,
        counselorComment: isRed
          ? `${DEMO_MARKER} Red conflict: student and parent goals diverge.`
          : `${DEMO_MARKER} Strategy aligned for ${def.universityName}.`,
        strategyAssigned: def.strategyAssigned,
      },
    })

    await upsertApplication(profile.id, def, i)
    await upsertExam(profile.id, def, i)
    await upsertDocument(profile.id, 'personal_statement', {
      status: i === 1 ? 'not_started' : 'draft',
      requestedDeadline: new Date(Date.now() + Math.max(2, def.deadlineDays - 2) * DAY),
      comment: `${DEMO_MARKER} personal statement`,
    })
    if (recTeacher) {
      await upsertDocument(profile.id, 'recommendation', {
        status: 'not_started',
        teacherId: recTeacher.id,
        requestedDeadline: new Date(Date.now() + 7 * DAY),
        requiredCount: 1,
        comment: `${DEMO_MARKER} recommendation request`,
      })
    }
    await upsertMeeting(profile.id, counselor.id, isRed)
    count++
  }

  console.log(`[seed-demo-cc] ok (${count} profiles, counselor: ${COUNSELOR_LOGIN}/${DEMO_PASSWORD})`)
}

main()
  .catch((e) => {
    console.error('[seed-demo-cc]', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
