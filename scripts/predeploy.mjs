// Предсборочный шаг: применяет схему (db push) с ретраями (Neon просыпается с холодного
// старта и иногда рвёт коннект) и прогоняет идемпотентные сиды НЕ фатально — перебой БД
// на сиде не должен валить прод-сборку. Заменяет хрупкую цепочку `&&` в build-скрипте.
import { execSync } from 'node:child_process';

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function run(cmd) {
  console.log(`[predeploy] $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function retry(cmd, attempts = 6, delayMs = 8000) {
  for (let i = 1; i <= attempts; i++) {
    try { run(cmd); return; }
    catch (e) {
      if (i === attempts) throw e;
      console.warn(`[predeploy] попытка ${i}/${attempts} не удалась (${e.message}); жду ${delayMs / 1000}с и повторяю…`);
      sleep(delayMs);
    }
  }
}

// Схема — критично: ретраим, чтобы пережить холодный старт/таймаут Neon.
retry('npx prisma db push --skip-generate', 6, 8000);

// Сиды — идемпотентные, НЕ фатальные: перебой БД здесь не валит сборку.
for (const seed of ['scripts/backfill-branches.ts', 'scripts/seed-psy-templates.ts', 'scripts/seed-demo-intake.ts']) {
  try { run(`npx tsx ${seed}`); }
  catch (e) { console.warn(`[predeploy] сид ${seed} пропущен (не критично): ${e.message}`); }
}

console.log('[predeploy] готово.');
