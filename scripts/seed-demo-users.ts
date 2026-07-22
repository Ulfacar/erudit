import { PrismaClient, type Role } from '@prisma/client'
import { hash } from 'bcryptjs'
import { isDemoSeedEnabled } from './seed-mode.mjs'
import { resolveDemoPassword } from './seed-demo-password.mjs'

// Демо-аккаунты ролей (ивент-менеджер, завучи, психослужба и т.д.). НЕ base seed:
// создаёт/обновляет пользователей, поэтому запускается ТОЛЬКО при точном SEED_DEMO=1.
// Пароль берётся из SEED_DEMO_PASSWORD (без fallback). При обычном рестарте (SEED_DEMO
// отсутствует / =0 / иное) сид не запускается вовсе (predeploy его не зовёт) и, даже если
// вызван напрямую, немедленно выходит до любых операций с БД.
// Ранее эти пользователи создавались в scripts/seed-roles.ts — там оставлены только
// справочные данные (схемы наград), которые безопасны для реальной школы.

const prisma = new PrismaClient()

const DEMO_USERS: Array<{ login: string; role: Role; email: string; star?: number }> = [
  { login: 'event1', role: 'event_manager', email: 'event@erudit.kg', star: 4 },
  { login: 'sport1', role: 'sport_coordinator', email: 'sport@erudit.kg', star: 4 },
  { login: 'zavuch_primary1', role: 'zavuch_primary', email: 'zavuch.primary@erudit.kg', star: 4 },
  { login: 'zavuch_senior1', role: 'zavuch_senior', email: 'zavuch.senior@erudit.kg', star: 4 },
  { login: 'zavuch_academic1', role: 'zavuch_academic', email: 'zavuch.academic@erudit.kg', star: 4 },
  { login: 'cambridge1', role: 'cambridge_coord', email: 'cambridge@erudit.kg', star: 4 },
  { login: 'founder1', role: 'founder', email: 'founder@erudit.kg', star: 4 },
  { login: 'media1', role: 'media', email: 'media@erudit.kg', star: 4 },
  { login: 'chief_accountant1', role: 'chief_accountant', email: 'chief.accountant@erudit.kg', star: 4 },
  { login: 'finance_manager1', role: 'finance_manager', email: 'finance.manager@erudit.kg', star: 4 },
  { login: 'psychologist1', role: 'psychologist', email: 'psychologist@erudit.kg', star: 4 },
  { login: 'senior_psy', role: 'senior_psychologist', email: 'senior.psy@erudit.kg', star: 4 },
  { login: 'psy_coord', role: 'psy_coordinator', email: 'psy.coord@erudit.kg', star: 4 },
  { login: 'olympcoach1', role: 'olympiad_coach', email: 'olympcoach@erudit.kg', star: 4 },
  { login: 'club1', role: 'club_coach', email: 'club@erudit.kg', star: 4 },
  { login: 'uniform1', role: 'uniform_manager', email: 'uniform@erudit.kg', star: 4 },
]

async function main() {
  // Гейт №1: только при точном SEED_DEMO=1. Иначе — ни одной мутации пользователей.
  if (!isDemoSeedEnabled(process.env)) {
    console.log('  = seed-demo-users: SEED_DEMO!=1 — демо-пользователи не создаются/не трогаются, пропускаем')
    return
  }
  // Гейт №2 (fail-closed): пароль только из ENV, без fallback. Резолвим ДО любых операций с БД.
  const plainPassword = resolveDemoPassword(process.env)
  const pw = await hash(plainPassword, 10)

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } })
  for (const u of DEMO_USERS) {
    const extraBranch = branch ? { branchId: branch.id } : {}
    await prisma.user.upsert({
      where: { login: u.login },
      update: { role: u.role, isActive: true, ...extraBranch },
      create: { login: u.login, email: u.email, password: pw, role: u.role, starLevel: u.star ?? 1, isActive: true, ...extraBranch },
    })
  }
  console.log(`  + seed-demo-users: демо-аккаунты ролей upsert (${DEMO_USERS.length})`)
}

main().catch((e) => { console.error('[seed-demo-users]', e); process.exit(1) }).finally(() => prisma.$disconnect())
