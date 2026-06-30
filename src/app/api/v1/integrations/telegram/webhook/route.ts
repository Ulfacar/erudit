import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { sendTelegram } from '@/shared/lib/agent/telegram';
import { isStorageConfigured, putObject } from '@/shared/lib/storage/minio';

/**
 * POST - Telegram webhook.
 * Handles legacy /start <linkCode> binding and QR payloads:
 * /start fix_<location> or /start film_<location>.
 * Always returns 200 so Telegram does not retry business errors.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return NextResponse.json({ ok: true });
    }

    const update = await request.json().catch(() => null);
    const message = update?.message;
    const chatId = message?.chat?.id ? String(message.chat.id) : null;
    const text: string = message?.text ?? message?.caption ?? '';
    const photos: TelegramPhoto[] = Array.isArray(message?.photo) ? message.photo : [];

    if (chatId && text.startsWith('/start')) {
      await handleStart(chatId, text);
    } else if (chatId && (text.trim() || photos.length > 0)) {
      await handlePendingRequest(chatId, text, photos);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

async function handleStart(chatId: string, text: string): Promise<void> {
  const code = text.split(/\s+/)[1]?.trim();
  if (!code) {
    await sendTelegram(chatId, 'Привет! Чтобы подключить уведомления, откройте ссылку привязки в Bilim OS.');
    return;
  }

  const qrPayload = /^(fix|film)_(.+)$/.exec(code);
  if (qrPayload) {
    const mode = qrPayload[1] as PendingRequest['mode'];
    const location = decodeLocation(qrPayload[2]);
    const user = await prisma.user.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });

    if (!user) {
      await sendTelegram(chatId, 'Сначала подключите Telegram к профилю Bilim OS, затем отсканируйте QR еще раз.');
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramPendingRequest: JSON.stringify({ mode, location }) },
    });
    await sendTelegram(chatId, `Опишите заявку и при необходимости приложите фото.\nТип: ${modeLabel(mode)}\nМесто: ${location}`);
    return;
  }

  const user = await prisma.user.findUnique({ where: { telegramLinkCode: code }, select: { id: true } });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId, telegramLinkCode: null },
    });
    await sendTelegram(chatId, '✅ Готово! Уведомления Bilim OS подключены. Здесь будут приходить важные оповещения.');
  } else {
    await sendTelegram(chatId, 'Ссылка устарела. Откройте «Подключить Telegram» в Bilim OS еще раз.');
  }
}

async function handlePendingRequest(chatId: string, text: string, photos: TelegramPhoto[]): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
    select: { id: true, telegramPendingRequest: true },
  });
  const pending = parsePending(user?.telegramPendingRequest);
  if (!user || !pending) return;

  const bodyText = text.trim();
  const description = (photoKey?: string) => {
    const chunks = [bodyText];
    if (photoKey) chunks.push(`Фото: ${photoKey}`);
    return chunks.filter(Boolean).join('\n\n') || null;
  };

  if (pending.mode === 'fix') {
    const created = await prisma.maintenanceRequest.create({
      data: {
        title: bodyText || 'Заявка с QR',
        description: description(),
        location: pending.location,
        authorId: user.id,
        priority: 'medium',
        status: 'open',
      },
      select: { id: true },
    });
    const photoKey = await saveBestPhoto(photos, pending.mode, created.id);
    if (photoKey) {
      await prisma.maintenanceRequest.update({ where: { id: created.id }, data: { description: description(photoKey) } });
    }
  } else {
    const created = await prisma.mediaRequest.create({
      data: {
        title: `Съемка: ${bodyText || 'заявка'}`,
        description: description(),
        location: pending.location,
        source: 'lesson',
        requesterId: user.id,
        priority: 'medium',
        status: 'open',
      },
      select: { id: true },
    });
    const photoKey = await saveBestPhoto(photos, pending.mode, created.id);
    if (photoKey) {
      await prisma.mediaRequest.update({ where: { id: created.id }, data: { description: description(photoKey) } });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { telegramPendingRequest: null } });
  await sendTelegram(chatId, `Заявка принята.\nТип: ${modeLabel(pending.mode)}\nМесто: ${pending.location}`);
}

interface PendingRequest {
  mode: 'fix' | 'film';
  location: string;
}

interface TelegramPhoto {
  file_id: string;
  file_size?: number;
}

function parsePending(raw: string | null | undefined): PendingRequest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingRequest>;
    if ((parsed.mode === 'fix' || parsed.mode === 'film') && typeof parsed.location === 'string') {
      return { mode: parsed.mode, location: parsed.location };
    }
  } catch {
    return null;
  }
  return null;
}

function decodeLocation(value: string): string {
  return value.replace(/-/g, ' ').trim() || value;
}

function modeLabel(mode: PendingRequest['mode']): string {
  return mode === 'fix' ? 'ремонт' : 'съемка';
}

async function saveBestPhoto(photos: TelegramPhoto[], mode: PendingRequest['mode'], id: string): Promise<string | null> {
  if (!isStorageConfigured() || photos.length === 0 || !process.env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const best = [...photos].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
    if (!best?.file_id) return null;

    const fileRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(best.file_id)}`);
    if (!fileRes.ok) return null;
    const fileJson = await fileRes.json().catch(() => null);
    const filePath = fileJson?.result?.file_path;
    if (typeof filePath !== 'string') return null;

    const photoRes = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`);
    if (!photoRes.ok) return null;
    const buffer = Buffer.from(await photoRes.arrayBuffer());
    return await putObject(`telegram/${mode}/${id}-photo.jpg`, buffer, photoRes.headers.get('content-type') || 'image/jpeg');
  } catch (error) {
    console.error('[telegram] photo save failed:', error);
    return null;
  }
}
