// Unit-тесты гейтинга демо-сидов и fail-closed пароля демо-каунселора.
// Запуск: node --test scripts/__tests__/ (см. npm run test:unit).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { resolveSeeds, isDemoSeedEnabled, BASE_SEEDS, DEMO_SEEDS } from '../seed-mode.mjs'
import { resolveDemoCounselorPassword, DEMO_COUNSELOR_PASSWORD_ENV } from '../seed-demo-password.mjs'

const DEMO_CC = 'scripts/seed-demo-cc.ts'

test('SEED_DEMO отсутствует → demo scripts не запускаются', () => {
  const seeds = resolveSeeds({})
  assert.equal(isDemoSeedEnabled({}), false)
  assert.deepEqual(seeds, BASE_SEEDS)
  for (const demo of DEMO_SEEDS) assert.ok(!seeds.includes(demo), `${demo} не должен быть в default-пути`)
})

test('SEED_DEMO=0 → demo scripts не запускаются', () => {
  assert.equal(isDemoSeedEnabled({ SEED_DEMO: '0' }), false)
  assert.deepEqual(resolveSeeds({ SEED_DEMO: '0' }), BASE_SEEDS)
})

test('любое иное значение SEED_DEMO → demo scripts не запускаются', () => {
  for (const v of ['true', 'yes', '2', '01', ' 1', '1 ', '', 'on']) {
    assert.equal(isDemoSeedEnabled({ SEED_DEMO: v }), false, `SEED_DEMO=${JSON.stringify(v)} должно быть выключено`)
    assert.deepEqual(resolveSeeds({ SEED_DEMO: v }), BASE_SEEDS)
  }
})

test('SEED_DEMO=1 → demo scripts запускаются', () => {
  const seeds = resolveSeeds({ SEED_DEMO: '1' })
  assert.equal(isDemoSeedEnabled({ SEED_DEMO: '1' }), true)
  assert.deepEqual(seeds, [...BASE_SEEDS, ...DEMO_SEEDS])
  assert.ok(seeds.includes(DEMO_CC), 'seed-demo-cc должен запускаться при SEED_DEMO=1')
})

test('base scripts продолжают запускаться во всех режимах', () => {
  for (const env of [{}, { SEED_DEMO: '0' }, { SEED_DEMO: '1' }, { SEED_DEMO: 'x' }]) {
    const seeds = resolveSeeds(env)
    for (const base of BASE_SEEDS) assert.ok(seeds.includes(base), `${base} должен быть при env=${JSON.stringify(env)}`)
  }
})

test('restart/default путь не реактивирует demo-counselor (seed-demo-cc не в списке)', () => {
  assert.ok(DEMO_SEEDS.includes(DEMO_CC), 'seed-demo-cc — демо-сид')
  assert.ok(!resolveSeeds({}).includes(DEMO_CC))
  assert.ok(!resolveSeeds({ SEED_DEMO: '0' }).includes(DEMO_CC))
})

test('SEED_DEMO=1 без password ENV → бросает до мутаций, секрет не в ошибке', () => {
  assert.throws(() => resolveDemoCounselorPassword({}), (err) => {
    assert.ok(err instanceof Error)
    assert.match(err.message, new RegExp(DEMO_COUNSELOR_PASSWORD_ENV))
    return true
  })
  assert.throws(() => resolveDemoCounselorPassword({ [DEMO_COUNSELOR_PASSWORD_ENV]: '' }))
})

test('password берётся только из ENV, без fallback', () => {
  const secret = 'unit-test-secret-value'
  assert.equal(resolveDemoCounselorPassword({ [DEMO_COUNSELOR_PASSWORD_ENV]: secret }), secret)
})

test('в seed-demo-cc.ts отсутствует прежняя статическая credential string', () => {
  const src = readFileSync(fileURLToPath(new URL('../seed-demo-cc.ts', import.meta.url)), 'utf8')
  assert.ok(!src.includes('erudit2025'), 'seed-demo-cc.ts не должен содержать статический пароль')
  assert.ok(!/DEMO_PASSWORD\s*=\s*['"]/.test(src), 'seed-demo-cc.ts не должен хардкодить DEMO_PASSWORD')
})
