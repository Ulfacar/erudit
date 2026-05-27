import { request as pwRequest, type APIRequestContext } from '@playwright/test';
import { SIDEBAR_NAV, filterNavByRole } from '../src/shared/lib/nav-config';
import type { Role } from '@prisma/client';

export const BASE_URL = 'http://localhost:3000';
export const PASSWORD = 'erudit2025';

/** One real, seeded login per role (verified to exist in the local DB). */
export const ROLES: Record<string, { login: string; role: Role }> = {
  super_admin: { login: 'admin', role: 'super_admin' },
  analyst: { login: 'analyst1', role: 'analyst' },
  zavuch: { login: 'kozlova', role: 'zavuch' },
  secretary: { login: 'secretary1', role: 'secretary' },
  teacher: { login: 'azhibaeva', role: 'teacher' },
  curator: { login: 'curator1', role: 'curator' },
  specialist: { login: 'specialist1', role: 'specialist' },
  student: { login: 'student1', role: 'student' },
  parent: { login: 'parent1', role: 'parent' },
};

/** Scenario-specific accounts beyond the one-per-role set. */
export const EXTRA_ACCOUNTS: Record<string, { login: string }> = {
  // teacher who has L2 descriptors and therefore must NOT see them about herself
  khaydarova: { login: 'khaydarova' },
};

export function storageStateFor(key: string): string {
  return `e2e/.auth/${key}.json`;
}

export function expectedSidebarHrefs(role: Role): string[] {
  return filterNavByRole(SIDEBAR_NAV, role).map((i) => i.href);
}

export function allSidebarHrefs(): string[] {
  return SIDEBAR_NAV.map((i) => i.href);
}

/** API context that carries a given account's session cookies. */
export async function apiAs(key: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE_URL, storageState: storageStateFor(key) });
}

export type Envelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};
