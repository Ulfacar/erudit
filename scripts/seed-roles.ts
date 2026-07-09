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
    { login: 'founder1', role: 'founder', email: 'founder@erudit.kg', star: 4 },
    { login: 'media1', role: 'media', email: 'media@erudit.kg', star: 4 },
    { login: 'chief_accountant1', role: 'chief_accountant', email: 'chief.accountant@erudit.kg', star: 4 },
    { login: 'finance_manager1', role: 'finance_manager', email: 'finance.manager@erudit.kg', star: 4 },
    { login: 'psychologist1', role: 'psychologist', email: 'psychologist@erudit.kg', star: 4 },
    { login: 'senior_psy', role: 'senior_psychologist', email: 'senior.psy@erudit.kg', star: 4 },
    { login: 'psy_coord', role: 'psy_coordinator', email: 'psy.coord@erudit.kg', star: 4 },
    { login: 'olympcoach1', role: 'olympiad_coach', email: 'olympcoach@erudit.kg', star: 4 },
  ]
  for (const u of defs) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { role: u.role, isActive: true },
      create: { login: u.login, email: u.email, password: pw, role: u.role, starLevel: u.star ?? 1, isActive: true },
    })
  }

  const awardSchemes = [
    {
      id: 'award-places',
      name: 'Места',
      type: 'places',
      isPreset: true,
      values: [
        { value: 'place_1', label: '1 место', weight: 100 },
        { value: 'place_2', label: '2 место', weight: 80 },
        { value: 'place_3', label: '3 место', weight: 60 },
        { value: 'diploma', label: 'Диплом/грамота', weight: 40 },
        { value: 'participant', label: 'Участие', weight: 10 },
      ],
    },
    {
      id: 'award-medals',
      name: 'Медали',
      type: 'medals',
      isPreset: true,
      values: [
        { value: 'gold', label: 'Золото', weight: 100 },
        { value: 'silver', label: 'Серебро', weight: 80 },
        { value: 'bronze', label: 'Бронза', weight: 60 },
        { value: 'honorable', label: 'Похвальная грамота', weight: 40 },
        { value: 'participant', label: 'Участие', weight: 10 },
      ],
    },
  ]
  for (const scheme of awardSchemes) {
    await prisma.awardScheme.upsert({
      where: { id: scheme.id },
      update: {},
      create: scheme,
    })
  }

  console.log(`[seed-roles] ok (${defs.length} ролей, ${awardSchemes.length} схем наград)`)
}

main().catch((e) => { console.error('[seed-roles]', e) }).finally(() => prisma.$disconnect())
