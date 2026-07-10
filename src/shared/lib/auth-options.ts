import { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/shared/lib/prisma'

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
          branchId: user.branchId,
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
        token.branchId = user.branchId
        try {
          const grants = await prisma.moduleGrant.findMany({
            where: { userId: user.id, canRead: true },
            select: { module: true },
          })
          token.grantedModules = grants.map((g) => g.module)
        } catch {
          token.grantedModules = []
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        session.user.starLevel = token.starLevel as number
        session.user.login = token.login as string
        // JWT maxAge is 8h: staff branch changes are applied after re-login.
        session.user.branchId = token.branchId as string | null | undefined
        session.user.grantedModules = (token.grantedModules as string[]) ?? []
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
