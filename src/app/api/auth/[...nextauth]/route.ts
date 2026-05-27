import { type NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { checkRateLimit, getClientIp } from '@/shared/lib/rate-limit'
import { errorResponse } from '@/shared/lib/api-response'
import { authOptions } from '@/shared/lib/auth-options'

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
