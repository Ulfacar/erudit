// Узкий regression-тест: логин-страница не содержит статического демо-пароля и показывает
// демо pre-fill/чипы только за публичным флагом NEXT_PUBLIC_DEMO_LOGIN_ENABLED.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = readFileSync(
  fileURLToPath(new URL('../../src/app/(auth)/login/page.tsx', import.meta.url)),
  'utf8',
)

test('login page: нет статического демо-пароля в исходнике/бандле', () => {
  assert.ok(!src.includes('erudit2025'), 'статический пароль должен быть удалён из login/page.tsx')
})

test('login page: демо-пароль берётся из публичного env, без литерала', () => {
  assert.ok(src.includes('NEXT_PUBLIC_DEMO_LOGIN_PASSWORD'), 'пароль должен приходить из NEXT_PUBLIC_DEMO_LOGIN_PASSWORD')
})

test('login page: демо-вход гейтится строго NEXT_PUBLIC_DEMO_LOGIN_ENABLED === "1"', () => {
  assert.match(src, /NEXT_PUBLIC_DEMO_LOGIN_ENABLED\s*===\s*'1'/, 'нужен точный флаг ===1')
  assert.match(src, /DEMO_LOGIN_ENABLED\s*&&/, 'демо-чипы/секции должны рендериться только при флаге')
  assert.match(src, /DEMO_LOGIN_ENABLED\s*\?/, 'pre-fill формы должен зависеть от флага')
})
