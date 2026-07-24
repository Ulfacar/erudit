// Запускается на СТАРТЕ контейнера (npm start), не в build — чтобы билд был детерминированным
// и не зависел от состояния Neon. `prisma migrate deploy` с exponential backoff: Neon просыпается за 1-5с.
// Сиды идемпотентные и НЕ фатальные — перебой/отсутствие tsx не валит старт.
//
// ВАЖНО: схему применяем ВЕРСИОНИРОВАННЫМИ миграциями (`migrate deploy`), а НЕ `db push`.
// db push подгонял схему «как получится» без истории и мог тихо потерять/переписать данные —
// на реальных данных школы это недопустимо. migrate deploy применяет только накопленные,
// отревьюенные миграции по порядку.
//
// Классификация ошибок (урок 2026-06-18: любая ошибка → crashloop, прод 502):
//  - transient (Neon спит: P1001/таймаут/нет сети) → ретраим с backoff, при стойком провале
//    exit 1 (Docker перезапустит — Neon рано или поздно проснётся, это не вечный краш);
//  - детерминированная (конфликт миграции / БД не забейзлайнена / data-loss guard) → НЕ ретраим,
//    логируем громко и СТАРТУЕМ апп на ТЕКУЩЕЙ схеме (прод жив, чиним форвардом — не crashloop).
//    Это же делает переход безопасным: существующая прод-БД, синхронизированная db push и ещё не
//    забейзлайненная (`migrate resolve --applied`), даст детерминированную ошибку — апп стартует
//    на текущей (корректной) схеме, а не падает в цикл. Порядок бейзлайна — в deploy-runbook.
import { execSync } from 'node:child_process';
import pg from 'pg';
import { resolveSeeds } from './seed-mode.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd) => { console.log(`[predeploy] $ ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

const TRANSIENT = /P1001|reach (the )?database|can't reach|ENETUNREACH|ETIMEDOUT|ECONNREFUSED|timed out|connection.*(closed|reset)/i;

// SAFE-BY-DEFAULT (review MAJOR-1): не запускать migrate deploy на БД, где СХЕМА уже есть
// (db push), но истории миграций НЕТ (не забейзлайнена). Иначе migrate deploy попытается
// применить 0000_init → «relation exists» → запишет failed-миграцию → P3009 залипнет и БУДУЩИЕ
// миграции молча перестанут накатываться. Определяем состояние прямым запросом:
//   'fresh'       — нет таблицы "User" → пустая БД → migrate deploy применит всё;
//   'tracked'     — есть _prisma_migrations с записями → штатный migrate deploy;
//   'unbaselined' — есть "User", но истории миграций нет → SKIP + громкий warn (нужен baseline);
//   'unknown'     — не смогли определить (обычно Neon cold-start) → пробуем migrate deploy,
//                   его собственный transient/backoff отработает.
async function dbState() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const app = await client.query(`SELECT to_regclass('public."User"') IS NOT NULL AS ex`);
    const migTbl = await client.query(`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS ex`);
    let migRows = 0;
    if (migTbl.rows[0].ex) {
      const c = await client.query('SELECT count(*)::int AS n FROM "_prisma_migrations"');
      migRows = c.rows[0].n;
    }
    await client.end();
    if (!app.rows[0].ex) return 'fresh';
    if (migRows > 0) return 'tracked';
    return 'unbaselined';
  } catch {
    try { await client.end(); } catch { /* ignore */ }
    return 'unknown';
  }
}

function tryMigrateDeploy() {
  try {
    execSync('npx prisma migrate deploy', { stdio: ['inherit', 'inherit', 'pipe'], encoding: 'utf8' });
    return { ok: true };
  } catch (e) {
    const msg = `${e.stderr ?? ''}${e.stdout ?? ''}${e.message ?? ''}`;
    if (e.stderr) process.stderr.write(e.stderr); // не глотаем лог Prisma
    return { ok: false, transient: TRANSIENT.test(msg), msg };
  }
}

const state = await dbState();
if (state === 'unbaselined') {
  console.error('[predeploy] ⚠️ БД имеет схему, но НЕ забейзлайнена (нет истории миграций).');
  console.error('[predeploy] Пропускаю migrate deploy, чтобы НЕ создать failed-миграцию (P3009) и не заблокировать будущие миграции.');
  console.error('[predeploy] Забейзлайньте БД по docs/ops/migrate-deploy-rollout.md (migrate resolve --applied, rehearsal на копии), затем передеплойте.');
} else {
  console.log(`[predeploy] db state: ${state} → migrate deploy`);
  // Применить миграции. Transient → backoff (~30с суммарно); детерминированная → стартуем без них.
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < delays.length; i++) {
    const r = tryMigrateDeploy();
    if (r.ok) { console.log('[predeploy] ✓ миграции применены'); break; }

    if (!r.transient) {
      console.error('[predeploy] ⚠️ migrate deploy: ДЕТЕРМИНИРОВАННАЯ ошибка (конфликт миграции / data-loss guard) — НЕ ретраим.');
      console.error('[predeploy] Стартуем апп на ТЕКУЩЕЙ схеме, чтобы прод не ушёл в crashloop. Чините форвардом (новой миграцией / migrate resolve) и передеплойте.');
      break; // не exit(1) — продолжаем к старту приложения
    }
    if (i === delays.length - 1) {
      console.error('[predeploy] Neon недоступен после всех попыток (transient) — exit(1), Docker перезапустит.');
      process.exit(1);
    }
    console.log(`[predeploy] Neon cold-start, повтор через ${delays[i]}ms (${i + 1}/${delays.length})…`);
    await sleep(delays[i]);
  }
}

// Сиды — идемпотентные, НЕ фатальные.
// Демо-сиды запускаются ТОЛЬКО при точном SEED_DEMO=1 (см. scripts/seed-mode.mjs).
// Отсутствие переменной / SEED_DEMO=0 / любое иное значение → только base seeds.
const seeds = resolveSeeds(process.env);

for (const seed of seeds) {
  try { run(`npx tsx ${seed}`); }
  catch (e) { console.warn(`[predeploy] сид ${seed} пропущен (не критично): ${e.message}`); }
}
