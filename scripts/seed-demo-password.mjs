// Пароль демо-аккаунта college counselor берётся ТОЛЬКО из отдельной ENV-переменной.
// Нет статического значения в репозитории, нет fallback. Fail-closed: если переменной нет,
// бросаем ошибку ДО любых операций с БД — вызывающий сид обязан прекратить работу,
// не создавая/не обновляя пользователя и не меняя isActive (никакого частичного demo seed).
//
// Секрет не логируется и не включается в текст ошибки.
export const DEMO_COUNSELOR_PASSWORD_ENV = 'SEED_DEMO_COUNSELOR_PASSWORD'

export function resolveDemoCounselorPassword(env = process.env) {
  const value = env[DEMO_COUNSELOR_PASSWORD_ENV]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${DEMO_COUNSELOR_PASSWORD_ENV} is required when SEED_DEMO=1 — refusing to seed the demo counselor. ` +
        'Set it in the environment (no default is provided).',
    )
  }
  return value
}
