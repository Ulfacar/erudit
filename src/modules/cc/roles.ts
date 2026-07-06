import type { Role } from '@prisma/client';

export const CC_ROLES = ['college_counselor', 'super_admin'] as const satisfies readonly Role[];

