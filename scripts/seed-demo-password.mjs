// Пароль ЛЮБОГО демо-аккаунта берётся ТОЛЬКО из одной ENV-переменной SEED_DEMO_PASSWORD.
// Нет статического значения в репозитории, нет fallback. Fail-closed: если переменной нет,
// бросаем ошибку ДО любых операций с БД — вызывающий сид обязан прекратить работу,
// не создавая/не обновляя пользователя и не меняя isActive/role/branchId (нет частичного seed).
//
// Секрет не логируется и не включается в текст ошибки.
export const DEMO_PASSWORD_ENV = 'SEED_DEMO_PASSWORD'

export function resolveDemoPassword(env = process.env) {
  const value = env[DEMO_PASSWORD_ENV]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${DEMO_PASSWORD_ENV} is required when SEED_DEMO=1 — refusing to seed demo users. ` +
        'Set it in the environment (no default is provided).',
    )
  }
  return value
}
