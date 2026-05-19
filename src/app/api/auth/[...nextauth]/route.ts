import { type NextRequest } from 'next/server'
import NextAuth, { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/shared/lib/prisma'
import { checkRateLimit, getClientIp } from '@/shared/lib/rate-limit'
import { errorResponse } from '@/shared/lib/api-response'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        login: { label: 'Логин', type: 'text' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { login: credentials.login },
        })

        if (!user || !user.isActive) {
          return null
        }

        const isValid = await compare(credentials.password, user.password)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          login: user.login,
          role: user.role,
          starLevel: user.starLevel,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.role = user.role
        token.starLevel = user.starLevel
        token.login = user.login
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        session.user.starLevel = token.starLevel as number
        session.user.login = token.login as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

// Wrap POST with rate limiting (10 requests/min for login attempts)
async function rateLimitedPost(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 10, 60000)) {
    return errorResponse('RATE_LIMITED', 'Слишком много попыток входа. Попробуйте позже.', 429)
  }
  return handler(request, context)
}

export { handler as GET, rateLimitedPost as POST }
