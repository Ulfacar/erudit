// Применяет миграцию 20260601000000_ai_presentations к Neon через HTTP-драйвер
// (этот ПК блокирует исходящий 5432, но 443 открыт). Идемпотентно.
// Запуск: DATABASE_URL="<pooled neon url>" node scripts/apply-neon-presentation.mjs
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MIGRATION = '20260601000000_ai_presentations';
const sqlFile = `prisma/migrations/${MIGRATION}/migration.sql`;
const checksum = createHash('sha256').update(readFileSync(sqlFile)).digest('hex');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не задан');
  process.exit(1);
}
const sql = neon(url);

const run = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS "Presentation" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "topic" VARCHAR(500) NOT NULL,
      "subject" VARCHAR(200),
      "gradeLevel" VARCHAR(100),
      "emphasis" VARCHAR(500),
      "slides" JSONB NOT NULL,
      "model" TEXT,
      "authorId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
    )`;
  await sql`CREATE INDEX IF NOT EXISTS "Presentation_authorId_idx" ON "Presentation"("authorId")`;
  console.log('✔ table + index ensured');

  const existing = await sql`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION} LIMIT 1`;
  if (existing.length === 0) {
    await sql.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
      [checksum, MIGRATION],
    );
    console.log('✔ recorded in _prisma_migrations');
  } else {
    console.log('• already recorded in _prisma_migrations');
  }

  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'Presentation' ORDER BY ordinal_position`;
  console.log('Presentation columns:', cols.map((c) => c.column_name).join(', '));
};

run().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
