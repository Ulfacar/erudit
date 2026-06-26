import { getServerSession, type AppSession } from '@/shared/lib/auth'
import { errorResponse } from '@/shared/lib/api-response'
import { roleMatches } from '@/shared/lib/role-access'
import type { Role } from '@prisma/client'

interface AuthOptions {
  roles?: Role[]
  minStarLevel?: number
}

interface AuthResult {
  session: AppSession
  response?: never
}

interface AuthError {
  session?: never
  response: Response
}

/**
 * Protect API routes with authentication and optional RBAC.
 *
 * Returns the authenticated session or a ready-to-return error Response.
 *
 * Usage:
 *   const auth = await withAuth(request, { roles: ['super_admin', 'zavuch'] })
 *   if (auth.response) return auth.response
 *   const user = auth.session.user
 */
export async function withAuth(
  _request: Request,
  options?: AuthOptions,
): Promise<AuthResult | AuthError> {
  const session = await getServerSession()

  if (!session) {
    return { response: errorResponse('UNAUTHORIZED', 'Необходима авторизация', 401) as unknown as Response }
  }

  if (options?.roles && options.roles.length > 0) {
    if (!roleMatches(options.roles, session.user.role as Role)) {
      return {
        response: errorResponse(
          'FORBIDDEN',
          `Недостаточно прав. Требуется роль: ${options.roles.join(', ')}`,
          403,
        ) as unknown as Response,
      }
    }
  }

  if (options?.minStarLevel !== undefined) {
    if (session.user.starLevel < options.minStarLevel) {
      return {
        response: errorResponse(
          'FORBIDDEN',
          `Недостаточный уровень доступа. Требуется уровень: ${options.minStarLevel}`,
          403,
        ) as unknown as Response,
      }
    }
  }

  return { session }
}
