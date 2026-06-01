// Применяет миграцию 20260601010000_lesson_plans к Neon через HTTP-драйвер (443).
// Запуск: DATABASE_URL="<pooled neon url>" node scripts/apply-neon-lessonplan.mjs
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MIGRATION = '20260601010000_lesson_plans';
const checksum = createHash('sha256').update(readFileSync(`prisma/migrations/${MIGRATION}/migration.sql`)).digest('hex');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL не задан'); process.exit(1); }
const sql = neon(url);

const run = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS "LessonPlan" (
      "id" TEXT NOT NULL,
      "teacherId" TEXT NOT NULL,
      "subjectId" TEXT,
      "classId" TEXT,
      "topicId" TEXT,
      "title" TEXT NOT NULL,
      "date" TIMESTAMP(3),
      "duration" INTEGER NOT NULL DEFAULT 45,
      "objectives" VARCHAR(2000),
      "stages" JSONB NOT NULL,
      "homework" VARCHAR(2000),
      "model" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
    )`;
  await sql`CREATE INDEX IF NOT EXISTS "LessonPlan_teacherId_idx" ON "LessonPlan"("teacherId")`;
  console.log('✔ table + index ensured');

  const existing = await sql`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION} LIMIT 1`;
  if (existing.length === 0) {
    await sql.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
      [checksum, MIGRATION],
    );
    console.log('✔ recorded in _prisma_migrations');
  } else {
    console.log('• already recorded');
  }
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'LessonPlan' ORDER BY ordinal_position`;
  console.log('LessonPlan columns:', cols.map((c) => c.column_name).join(', '));
};

run().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
