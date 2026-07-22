import { type NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { checkRateLimit, getClientIp } from '@/shared/lib/rate-limit'
import { errorResponse } from '@/shared/lib/api-response'
import { authOptions } from '@/shared/lib/auth-options'

const handler = NextAuth(authOptions)

// Wrap POST with rate limiting for login attempts
// Лимит логинов в минуту на IP. Дефолт 10 (production). Поднимается только для e2e-прогонов,
// где один сценарий логинит несколько ролей подряд.
const LOGIN_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT_PER_MIN) || 10

async function rateLimitedPost(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, LOGIN_RATE_LIMIT, 60000)) {
    return errorResponse('RATE_LIMITED', 'Слишком много попыток входа. Попробуйте позже.', 429)
  }
  return handler(request, context)
}

export { handler as GET, rateLimitedPost as POST }
