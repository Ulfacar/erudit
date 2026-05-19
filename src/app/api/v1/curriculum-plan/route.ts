import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

/**
 * GET /api/v1/curriculum-plan
 *
 * Returns a "БУП" matrix derived from the schedule:
 *   classes   — rows
 *   subjects  — columns
 *   matrix[classId][subjectId] = { declared, actual, status }
 *
 * declared — hours/week from TeacherSubject (planned)
 * actual   — count of weekly schedule slots for that class+subject (real)
 * status   — 'matched' | 'overload' | 'partial' | 'missing'
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response

    const [classes, subjectsAll, teacherSubjects, scheduleEntries] = await Promise.all([
      prisma.class.findMany({
        select: { id: true, grade: true, letter: true, levelId: true },
        orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
      }),
      prisma.subject.findMany({
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      }),
      prisma.teacherSubject.findMany({
        select: {
          subjectId: true,
          classId: true,
          hoursPerWeek: true,
        },
      }),
      prisma.scheduleEntry.findMany({
        where: { dayOfWeek: { in: [1, 2, 3, 4, 5, 6] } },
        select: { classId: true, subjectId: true },
      }),
    ])

    // Aggregate declared hours: class -> subject -> sum of hoursPerWeek across teachers
    const declared = new Map<string, Map<string, number>>()
    for (const ts of teacherSubjects) {
      let cls = declared.get(ts.classId)
      if (!cls) {
        cls = new Map()
        declared.set(ts.classId, cls)
      }
      cls.set(ts.subjectId, (cls.get(ts.subjectId) ?? 0) + ts.hoursPerWeek)
    }

    // Aggregate actual: class -> subject -> count of slots/week
    const actual = new Map<string, Map<string, number>>()
    for (const e of scheduleEntries) {
      let cls = actual.get(e.classId)
      if (!cls) {
        cls = new Map()
        actual.set(e.classId, cls)
      }
      cls.set(e.subjectId, (cls.get(e.subjectId) ?? 0) + 1)
    }

    // Reduce columns to subjects that actually appear in any class (declared OR scheduled)
    const usedSubjectIds = new Set<string>()
    for (const [, m] of declared) for (const [sid] of m) usedSubjectIds.add(sid)
    for (const [, m] of actual) for (const [sid] of m) usedSubjectIds.add(sid)
    const subjects = subjectsAll.filter((s) => usedSubjectIds.has(s.id))

    // Build matrix
    const matrix: Record<
      string,
      Record<string, { declared: number; actual: number; status: 'matched' | 'overload' | 'partial' | 'missing' | 'idle' }>
    > = {}

    for (const cls of classes) {
      const row: Record<string, { declared: number; actual: number; status: 'matched' | 'overload' | 'partial' | 'missing' | 'idle' }> = {}
      const declaredCls = declared.get(cls.id) ?? new Map<string, number>()
      const actualCls = actual.get(cls.id) ?? new Map<string, number>()
      for (const subj of subjects) {
        const d = declaredCls.get(subj.id) ?? 0
        const a = actualCls.get(subj.id) ?? 0
        let status: 'matched' | 'overload' | 'partial' | 'missing' | 'idle'
        if (d === 0 && a === 0) status = 'idle'
        else if (d === 0 && a > 0) status = 'missing' // в расписании есть, но не в БУП
        else if (a === 0) status = 'partial'          // объявлено, но в расписание не поставлено
        else if (a > d) status = 'overload'           // часов больше, чем заявлено
        else if (a < d) status = 'partial'
        else status = 'matched'
        row[subj.id] = { declared: d, actual: a, status }
      }
      matrix[cls.id] = row
    }

    // Per-class totals
    const totals: Record<string, { declared: number; actual: number }> = {}
    for (const cls of classes) {
      let d = 0
      let a = 0
      for (const subj of subjects) {
        d += matrix[cls.id][subj.id].declared
        a += matrix[cls.id][subj.id].actual
      }
      totals[cls.id] = { declared: d, actual: a }
    }

    return successResponse({ classes, subjects, matrix, totals })
  } catch (error) {
    console.error('GET /api/v1/curriculum-plan error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось построить БУП', 500)
  }
}
