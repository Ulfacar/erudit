import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Необходима авторизация' },
      },
      { status: 401 },
    )
  }

  const headers = new Headers(req.headers)
  if (token.userId) headers.set('x-user-id', String(token.userId))
  if (token.role) headers.set('x-user-role', String(token.role))
  if (token.starLevel !== undefined) {
    headers.set('x-user-star-level', String(token.starLevel))
  }
  if (token.login) headers.set('x-user-login', String(token.login))

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    '/api/v1/((?!auth|public).*)',
  ],
}
