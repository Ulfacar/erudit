// Unit/regression-тесты: гейтинг демо-сидов, fail-closed демо-пароль, и главное —
// НИ ОДИН always-run (base) seed не мутирует пользователей (create/upsert/пароль/isActive).
// Запуск: npm run test:unit  (node --test).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { resolveSeeds, isDemoSeedEnabled, BASE_SEEDS, DEMO_SEEDS } from '../seed-mode.mjs'
import { resolveDemoPassword, DEMO_PASSWORD_ENV } from '../seed-demo-password.mjs'

// Демо-сиды, которые СОЗДАЮТ/ОБНОВЛЯЮТ пользователей — они не должны попадать в default path.
const USER_MUTATING_DEMO = ['scripts/seed-demo-users.ts', 'scripts/seed-demo-cc.ts']

const readSeed = (repoRelPath) =>
  readFileSync(fileURLToPath(new URL(`../${repoRelPath.replace(/^scripts\//, '')}`, import.meta.url)), 'utf8')

// ── Гейтинг: какие сиды идут в каком режиме ──────────────────────────────────

test('SEED_DEMO отсутствует → default predeploy не запускает user-мутирующие демо-сиды', () => {
  assert.equal(isDemoSeedEnabled({}), false)
  assert.deepEqual(resolveSeeds({}), BASE_SEEDS)
  for (const s of USER_MUTATING_DEMO) assert.ok(!resolveSeeds({}).includes(s), `${s} не должен быть в default-пути`)
})

test('SEED_DEMO=0 → user-мутирующие демо-сиды не запускаются', () => {
  assert.equal(isDemoSeedEnabled({ SEED_DEMO: '0' }), false)
  for (const s of USER_MUTATING_DEMO) assert.ok(!resolveSeeds({ SEED_DEMO: '0' }).includes(s))
})

test('неизвестное значение SEED_DEMO → user-мутирующие демо-сиды не запускаются', () => {
  for (const v of ['true', 'yes', '2', '01', ' 1', '1 ', '', 'on']) {
    assert.equal(isDemoSeedEnabled({ SEED_DEMO: v }), false, `SEED_DEMO=${JSON.stringify(v)} должно быть выключено`)
    for (const s of USER_MUTATING_DEMO) assert.ok(!resolveSeeds({ SEED_DEMO: v }).includes(s))
  }
})

test('SEED_DEMO=1 → демо-сиды (включая seed-demo-users) запускаются', () => {
  const seeds = resolveSeeds({ SEED_DEMO: '1' })
  assert.deepEqual(seeds, [...BASE_SEEDS, ...DEMO_SEEDS])
  for (const s of USER_MUTATING_DEMO) assert.ok(seeds.includes(s), `${s} должен запускаться при SEED_DEMO=1`)
})

test('seed-demo-users идёт перед остальными демо-сидами (они зависят от демо-аккаунтов)', () => {
  assert.equal(DEMO_SEEDS[0], 'scripts/seed-demo-users.ts')
})

test('role/template base seeds продолжают выполняться во всех режимах', () => {
  for (const env of [{}, { SEED_DEMO: '0' }, { SEED_DEMO: '1' }, { SEED_DEMO: 'x' }]) {
    const seeds = resolveSeeds(env)
    assert.ok(seeds.includes('scripts/seed-roles.ts'), 'seed-roles (награды) всегда')
    assert.ok(seeds.includes('scripts/seed-psy-templates.ts'), 'seed-psy-templates всегда')
    for (const base of BASE_SEEDS) assert.ok(seeds.includes(base))
  }
})

// ── Fail-closed демо-пароль ──────────────────────────────────────────────────

test('SEED_DEMO=1 без SEED_DEMO_PASSWORD → бросает до мутаций, секрет не в ошибке', () => {
  assert.throws(() => resolveDemoPassword({}), (err) => {
    assert.ok(err instanceof Error)
    assert.match(err.message, new RegExp(DEMO_PASSWORD_ENV))
    return true
  })
  assert.throws(() => resolveDemoPassword({ [DEMO_PASSWORD_ENV]: '' }))
})

test('демо-пароль берётся только из ENV, без fallback', () => {
  const secret = 'unit-test-secret-value'
  assert.equal(resolveDemoPassword({ [DEMO_PASSWORD_ENV]: secret }), secret)
})

// ── Главное: base seeds НЕ мутируют пользователей ───────────────────────────

test('ни один base seed не создаёт/не апсёртит пользователей и не хеширует пароли', () => {
  for (const seed of BASE_SEEDS) {
    const src = readSeed(seed)
    assert.ok(!src.includes('erudit2025'), `${seed}: статический пароль недопустим`)
    assert.ok(!/from ['"]bcryptjs['"]/.test(src), `${seed}: base seed не должен хешировать пароли`)
    assert.ok(!/prisma\.user\.(create|upsert)\(/.test(src), `${seed}: base seed не должен создавать/апсёртить пользователей`)
  }
})

test('seed-roles после фикса вообще не обращается к prisma.user', () => {
  const src = readSeed('scripts/seed-roles.ts')
  assert.ok(!/prisma\.user\./.test(src), 'seed-roles должен трогать только справочники (награды)')
  assert.ok(/prisma\.awardScheme\.upsert/.test(src), 'seed-roles должен продолжать сидировать схемы наград')
})

test('единственная user-мутация в base path — branchId-backfill в backfill-branches (без пароля/роли)', () => {
  const src = readSeed('scripts/backfill-branches.ts')
  const userOps = src.match(/prisma\.user\.\w+\(/g) || []
  assert.deepEqual(userOps, ['prisma.user.updateMany('], 'только updateMany branchId допустим')
  assert.ok(!src.includes('password'), 'backfill-branches не трогает пароль')
  assert.ok(!/data:\s*\{[^}]*\brole\b/.test(src), 'backfill-branches не меняет role')
})

test('повторный restart по default path не реактивирует отключённого пользователя', () => {
  // Реактивация (isActive:true на update) жила в seed-demo-users, который вне default path.
  const su = readSeed('scripts/seed-demo-users.ts')
  assert.ok(/isActive: true/.test(su), 'демо-активация локализована в seed-demo-users')
  assert.ok(!resolveSeeds({}).includes('scripts/seed-demo-users.ts'))
  assert.ok(!resolveSeeds({ SEED_DEMO: '0' }).includes('scripts/seed-demo-users.ts'))
})

test('seed-demo-users fail-closed: guard и пароль стоят ДО user.upsert', () => {
  const su = readSeed('scripts/seed-demo-users.ts')
  const upsertAt = su.indexOf('prisma.user.upsert')
  assert.ok(upsertAt > 0, 'seed-demo-users апсёртит пользователей')
  assert.ok(su.indexOf('isDemoSeedEnabled') > -1 && su.indexOf('isDemoSeedEnabled') < upsertAt, 'guard до мутации')
  assert.ok(su.indexOf('resolveDemoPassword') > -1 && su.indexOf('resolveDemoPassword') < upsertAt, 'пароль до мутации')
})

// ── Статические credentials отсутствуют в production+demo seed paths ─────────

test('поиск не находит прежний статический пароль в затронутых seed scripts', () => {
  const affected = [...BASE_SEEDS, 'scripts/seed-demo-users.ts', 'scripts/seed-demo-cc.ts']
  for (const f of affected) {
    assert.ok(!readSeed(f).includes('erudit2025'), `${f}: статический пароль должен быть удалён`)
  }
})
