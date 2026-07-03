// Запускается на СТАРТЕ контейнера (npm start), не в build — чтобы билд был детерминированным
// и не зависел от состояния Neon. db push с exponential backoff: Neon просыпается за 1-5с.
// Сиды идемпотентные и НЕ фатальные — перебой/отсутствие tsx не валит старт.
//
// ВАЖНО (урок 2026-06-18): раньше любая ошибка db push считалась «cold-start» → 5 ретраев →
// exit 1 → Docker рестартит контейнер → бесконечный crashloop, прод 502. Теперь различаем:
//  - transient (Neon спит: P1001/таймаут/нет сети) → ретраим с backoff, при стойком провале
//    exit 1 (Docker перезапустит — Neon рано или поздно проснётся, это не вечный краш);
//  - детерминированная (ошибка схемы/констрейнт/data-loss) → НЕ ретраим, логируем громко и
//    СТАРТУЕМ апп на текущей схеме (прод остаётся жив, чиним схему форвардом — не crashloop).
import { execSync } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd) => { console.log(`[predeploy] $ ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

const TRANSIENT = /P1001|reach (the )?database|can't reach|ENETUNREACH|ETIMEDOUT|ECONNREFUSED|timed out|connection.*(closed|reset)/i;

function tryDbPush() {
  try {
    execSync('npx prisma db push --skip-generate', { stdio: ['inherit', 'inherit', 'pipe'], encoding: 'utf8' });
    return { ok: true };
  } catch (e) {
    const msg = `${e.stderr ?? ''}${e.stdout ?? ''}${e.message ?? ''}`;
    if (e.stderr) process.stderr.write(e.stderr); // не глотаем лог Prisma
    return { ok: false, transient: TRANSIENT.test(msg), msg };
  }
}

// Применить схему. Transient → backoff (~30с суммарно); детерминированная → стартуем без неё.
const delays = [1000, 2000, 4000, 8000, 16000];
for (let i = 0; i < delays.length; i++) {
  const r = tryDbPush();
  if (r.ok) { console.log('[predeploy] ✓ схема применена'); break; }

  if (!r.transient) {
    console.error('[predeploy] ⚠️ db push: ДЕТЕРМИНИРОВАННАЯ ошибка (схема/констрейнт/data-loss) — НЕ ретраим.');
    console.error('[predeploy] Стартуем апп на ТЕКУЩЕЙ схеме, чтобы прод не ушёл в crashloop. Чините схему форвардом и передеплойте.');
    break; // не exit(1) — продолжаем к старту приложения
  }
  if (i === delays.length - 1) {
    console.error('[predeploy] Neon недоступен после всех попыток (transient) — exit(1), Docker перезапустит.');
    process.exit(1);
  }
  console.log(`[predeploy] Neon cold-start, повтор через ${delays[i]}ms (${i + 1}/${delays.length})…`);
  await sleep(delays[i]);
}

// Сиды — идемпотентные, НЕ фатальные.
const baseSeeds = [
  'scripts/backfill-branches.ts',
  'scripts/seed-psy-templates.ts',
  'scripts/backfill-debtor-contracts.ts',
  'scripts/backfill-psy-codes.ts',
  'scripts/seed-roles.ts',
];
const demoSeeds = ['scripts/seed-demo-intake.ts', 'scripts/seed-demo-media.ts'];
// Сиды с демо-данными не льем в реальную школу при SEED_DEMO=0.
const seeds = process.env.SEED_DEMO !== '0' ? [...baseSeeds, ...demoSeeds] : baseSeeds;

for (const seed of seeds) {
  try { run(`npx tsx ${seed}`); }
  catch (e) { console.warn(`[predeploy] сид ${seed} пропущен (не критично): ${e.message}`); }
}
