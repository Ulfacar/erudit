// Запускается на СТАРТЕ контейнера (npm start), не в build — чтобы билд был детерминированным
// и не зависел от состояния Neon. db push с exponential backoff: Neon просыпается за 1-5с.
// Сиды идемпотентные и НЕ фатальные — перебой/отсутствие tsx не валит старт.
import { execSync } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd) => { console.log(`[predeploy] $ ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

// Применить схему — критично, с экспоненциальным backoff (~30с суммарно).
const delays = [1000, 2000, 4000, 8000, 16000];
let applied = false;
for (let i = 0; i < delays.length; i++) {
  try { run('npx prisma db push --skip-generate'); applied = true; break; }
  catch {
    if (i === delays.length - 1) { console.error('[predeploy] Neon недоступен после всех попыток'); process.exit(1); }
    console.log(`[predeploy] Neon cold-start, повтор через ${delays[i]}ms (${i + 1}/${delays.length})…`);
    await sleep(delays[i]);
  }
}
if (applied) console.log('[predeploy] ✓ схема применена');

// Сиды — идемпотентные, НЕ фатальные.
for (const seed of ['scripts/backfill-branches.ts', 'scripts/seed-psy-templates.ts', 'scripts/seed-demo-intake.ts', 'scripts/backfill-debtor-contracts.ts', 'scripts/backfill-psy-codes.ts']) {
  try { run(`npx tsx ${seed}`); }
  catch (e) { console.warn(`[predeploy] сид ${seed} пропущен (не критично): ${e.message}`); }
}
