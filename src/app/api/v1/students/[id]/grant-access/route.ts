import { randomInt } from 'crypto'
import { type NextRequest } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'
import { canAccessStudent } from '@/shared/lib/student-access'

const PASSWORD_CHARS = 'abcdefghkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePassword() {
  let password = ''
  for (let i = 0; i < 8; i += 1) {
    password += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]
  }
  return password
}

async function generateLogin(studentId: string) {
  const base = `student_${studentId.slice(-6).toLowerCase()}`
  let login = base
  let suffix = 1

  while (await prisma.user.findUnique({ where: { login }, select: { id: true } })) {
    login = `${base}${suffix}`
    suffix += 1
  }

  return login
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
    })
    if (auth.response) return auth.response

    const { id } = await params
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, login: true } },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, login: true } },
              },
            },
          },
        },
      },
    })

    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404)
    }

    const allowed = await canAccessStudent(auth.session.user.role, auth.session.user.id, id, auth.session.user.branchId)
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403)

    const parentLogin = student.parentLinks[0]?.parent.user.login

    if (student.user) {
      return successResponse({
        studentLogin: student.user.login,
        studentPassword: null,
        parentLogin,
        alreadyExists: true,
      })
    }

    const login = await generateLogin(student.id)
    const password = generatePassword()
    const hashed = await hash(password, 10)

    const user = await prisma.user.create({
      data: {
        login,
        password: hashed,
        role: 'student',
        starLevel: 1,
        isActive: true,
        student: { connect: { id: student.id } },
      },
      select: { login: true },
    })

    return successResponse({
      studentLogin: user.login,
      studentPassword: password,
      parentLogin,
      parentPassword: parentLogin ? null : undefined,
      alreadyExists: false,
    })
  } catch (error) {
    console.error('POST /api/v1/students/[id]/grant-access error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при выдаче доступа ученику', 500)
  }
}
