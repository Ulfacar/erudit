// Единый источник правды: какие сиды запускать на старте контейнера.
// Демо-сиды (создают демо-аккаунты/данные) запускаются ТОЛЬКО при точном SEED_DEMO=1.
// Отсутствие переменной, SEED_DEMO=0 и любое другое значение → демо НЕ запускается.
// Логика вынесена сюда, чтобы её можно было покрыть unit-тестом (predeploy.mjs её импортирует).

// Базовые/бэкфилл/ролевые сиды — идемпотентны, безопасны для реальной школы, всегда запускаются.
export const BASE_SEEDS = [
  'scripts/backfill-branches.ts',
  'scripts/seed-psy-templates.ts',
  'scripts/backfill-debtor-contracts.ts',
  'scripts/backfill-psy-codes.ts',
  'scripts/seed-roles.ts',
]

// Демо-сиды — наполняют стенд демо-данными и демо-аккаунтами. Не для прод-школы.
export const DEMO_SEEDS = [
  'scripts/seed-demo-intake.ts',
  'scripts/seed-demo-media.ts',
  'scripts/seed-demo-cc.ts',
]

// Демо включено строго при SEED_DEMO === '1'. Fail-safe by default: любое иное значение = выключено.
export function isDemoSeedEnabled(env = process.env) {
  return env.SEED_DEMO === '1'
}

// Итоговый список сидов для данного окружения.
export function resolveSeeds(env = process.env) {
  return isDemoSeedEnabled(env) ? [...BASE_SEEDS, ...DEMO_SEEDS] : [...BASE_SEEDS]
}
