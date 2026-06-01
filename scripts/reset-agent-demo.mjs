// Сброс Панели агента перед демо: закрывает все открытые элементы, чтобы новый
// черновик было видно сразу. Не удаляет данные (status → dismissed).
// Запуск: DATABASE_URL="<pooled neon>" node scripts/reset-agent-demo.mjs
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL не задан'); process.exit(1); }
const sql = neon(url);

const res = await sql`
  UPDATE "AgentItem"
  SET status = 'dismissed', "resolvedAt" = now(), "resolvedBy" = 'demo-reset'
  WHERE status IN ('new', 'in_progress', 'approved')
  RETURNING id`;
console.log(`Закрыто элементов: ${res.length}. Панель агента чиста для демо.`);
