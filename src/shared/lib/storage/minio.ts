import { Client } from 'minio';

/**
 * Приватное файловое хранилище (MinIO, S3-совместимое) для психологической службы:
 * аудио сессий, проективные рисунки, итоговые документы. Доступ — только по
 * временным signed URL. Бакет приватный.
 */
const BUCKET = process.env.MINIO_BUCKET || 'psy';

let _client: Client | null = null;
function client(): Client {
  if (_client) return _client;
  _client = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });
  return _client;
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY);
}

async function ensureBucket(): Promise<void> {
  const c = client();
  if (!(await c.bucketExists(BUCKET))) {
    await c.makeBucket(BUCKET, process.env.MINIO_REGION || 'us-east-1');
  }
}

/** Сохранить объект (buffer). Возвращает ключ (path) в бакете. */
export async function putObject(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<string> {
  await ensureBucket();
  await client().putObject(BUCKET, key, body, body.length, { 'Content-Type': contentType });
  return key;
}

/** Временный (signed) URL на скачивание объекта. */
export async function presignedGet(key: string, expirySeconds = 600): Promise<string> {
  return client().presignedGetObject(BUCKET, key, expirySeconds);
}

/** Удалить объект по ключу (для ретеншн-политики). */
export async function removeObject(key: string): Promise<void> {
  await client().removeObject(BUCKET, key);
}

/** Декодировать data URL (data:image/png;base64,...) в buffer + mime. */
export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error('Некорректный data URL');
  return { buffer: Buffer.from(m[2], 'base64'), contentType: m[1] };
}
