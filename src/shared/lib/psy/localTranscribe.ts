'use client';

/**
 * Локальная транскрипция аудио прямо в браузере (UC-2: «локальная модель Whisper»).
 * Аудио НИКОГДА не уходит в сеть — модель грузится один раз и работает на устройстве,
 * поэтому реальные ФИО в речи не попадают на чужие серверы (в отличие от Web Speech → Google).
 * Используется @xenova/transformers (WASM/ONNX, Whisper). Обезличивание (NER) и облачный
 * DAP происходят уже ПОСЛЕ — над текстом, не над голосом.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let asrPromise: Promise<any> | null = null;

// Ленивый синглтон ASR-пайплайна. Модель кэшируется браузером после первой загрузки.
function getAsr(onProgress?: (p: number) => void): Promise<any> {
  if (!asrPromise) {
    asrPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      // только удалённые модели (HF hub) + кэш в браузере; локальных файлов нет
      env.allowLocalModels = false;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
        progress_callback: (e: any) => {
          if (e?.status === 'progress' && typeof e.progress === 'number') onProgress?.(e.progress);
        },
      });
    })();
  }
  return asrPromise;
}

// Декодируем blob → mono Float32 @16kHz (формат, который ждёт Whisper).
async function blobToPcm16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  // sampleRate:16000 — браузер ресемплит при decode
  const ctx = new AC({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(buf);
    if (audio.numberOfChannels === 1) return audio.getChannelData(0);
    // микшируем в моно
    const a = audio.getChannelData(0), b = audio.getChannelData(1);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
    return out;
  } finally {
    ctx.close().catch(() => {});
  }
}

export function isTranscribeSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as any).AudioContext !== 'undefined'
    && typeof WebAssembly !== 'undefined';
}

export async function transcribeLocally(
  blob: Blob,
  onProgress?: (p: number) => void,
): Promise<string> {
  const asr = await getAsr(onProgress);
  const pcm = await blobToPcm16k(blob);
  const out = await asr(pcm, { language: 'russian', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  const text = Array.isArray(out) ? out.map((o: any) => o.text).join(' ') : out?.text;
  return (text ?? '').trim();
}
