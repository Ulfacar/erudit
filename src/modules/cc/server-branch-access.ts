import type { Role } from '@prisma/client';
import { getBranchScope } from '@/shared/lib/branch-scope';

export async function canAccessCcProfileBranch(
  user: { id: string; role: string; branchId?: string | null },
  profileBranchId: string | null,
) {
  if (user.role === 'super_admin') return true;
  const scope = await getBranchScope(user.id, user.role as Role, user.branchId);
  return !scope.closed && !!scope.branchId && scope.branchId === profileBranchId;
}
