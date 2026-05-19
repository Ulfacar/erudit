import type { Role } from '@prisma/client'
import { withAuth } from '@/shared/lib/api-auth'
import { errorResponse } from '@/shared/lib/api-response'
import { checkRateLimit, getClientIp } from '@/shared/lib/rate-limit'
import type { AppSession } from '@/shared/lib/auth'

interface MiddlewareOptions {
  /** Required roles for authorization */
  roles?: Role[]
  /** Minimum star level required */
  minStarLevel?: number
  /** Max requests per minute per IP (default: 100). Set to 0 to disable rate limiting. */
  rateLimit?: number
  /** Rate limit window in milliseconds (default: 60000 = 1 minute) */
  rateLimitWindowMs?: number
  /** Skip auth check (for public endpoints that still need rate limiting) */
  skipAuth?: boolean
}

interface MiddlewareResultOk {
  session: AppSession
  limited: false
  response?: never
}

interface MiddlewareResultLimited {
  session?: never
  limited: true
  response: Response
}

interface MiddlewareResultError {
  session?: never
  limited: false
  response: Response
}

type MiddlewareResult = MiddlewareResultOk | MiddlewareResultLimited | MiddlewareResultError

/**
 * Combines auth check + rate limiting in one helper.
 *
 * Usage:
 *   const result = await apiMiddleware(request, { roles: ['teacher'], rateLimit: 100 })
 *   if (result.response) return result.response
 *   const user = result.session.user
 */
export async function apiMiddleware(
  request: Request,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResult> {
  // Rate limiting check (runs before auth to protect against brute force)
  const limit = options.rateLimit ?? 100
  if (limit > 0) {
    const ip = getClientIp(request)
    const windowMs = options.rateLimitWindowMs ?? 60000
    const allowed = checkRateLimit(ip, limit, windowMs)

    if (!allowed) {
      return {
        limited: true,
        response: errorResponse(
          'RATE_LIMITED',
          'Слишком много запросов. Попробуйте позже.',
          429,
        ) as unknown as Response,
      }
    }
  }

  // Skip auth if requested (for public endpoints)
  if (options.skipAuth) {
    return { session: {} as AppSession, limited: false }
  }

  // Auth check
  const auth = await withAuth(request, {
    roles: options.roles,
    minStarLevel: options.minStarLevel,
  })

  if (auth.response) {
    return { limited: false, response: auth.response }
  }

  return { session: auth.session, limited: false }
}
