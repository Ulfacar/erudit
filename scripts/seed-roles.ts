import { PrismaClient, type Role } from '@prisma/client'
import { hash } from 'bcryptjs'

// Идемпотентный сид демо-аккаунтов для новых ролей (ивент-менеджер + завучи).
// Пароль erudit2025. Логины совпадают с чипами на странице логина.
const prisma = new PrismaClient()

async function main() {
  const pw = await hash('erudit2025', 10)
  const defs: Array<{ login: string; role: Role; email: string; star?: number }> = [
    { login: 'event1', role: 'event_manager', email: 'event@erudit.kg', star: 4 },
    { login: 'zavuch_primary1', role: 'zavuch_primary', email: 'zavuch.primary@erudit.kg', star: 4 },
    { login: 'zavuch_senior1', role: 'zavuch_senior', email: 'zavuch.senior@erudit.kg', star: 4 },
    { login: 'zavuch_academic1', role: 'zavuch_academic', email: 'zavuch.academic@erudit.kg', star: 4 },
    { login: 'cambridge1', role: 'cambridge_coord', email: 'cambridge@erudit.kg', star: 4 },
  ]
  for (const u of defs) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { role: u.role, isActive: true },
      create: { login: u.login, email: u.email, password: pw, role: u.role, starLevel: u.star ?? 1, isActive: true },
    })
  }
  console.log(`[seed-roles] ok (${defs.length} ролей)`)
}

main().catch((e) => { console.error('[seed-roles]', e) }).finally(() => prisma.$disconnect())
