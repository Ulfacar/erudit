import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      login: string
      role: string
      starLevel: number
      branchId?: string | null
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface User {
    login: string
    role: string
    starLevel: number
    branchId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    login: string
    role: string
    starLevel: number
    branchId?: string | null
  }
}
