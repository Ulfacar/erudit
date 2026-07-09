import { isLlmConfigured } from '@/shared/lib/ai/openrouter';

/**
 * AI-интерпретация проективного теста (рисунка). Вход — УЖЕ обезличенное
 * изображение (подписи заблюрены на клиенте до отправки). При наличии ключа —
 * облачная vision-модель; иначе — детерминированный stub-черновик.
 */
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

function stubInterpret(methodology: string): string {
  return [
    `Черновик заключения по методике «${methodology}» (предварительный анализ).`,
    'Нажим: средний, линии уверенные. Расположение: рисунок смещён, что может отражать эмоциональный фон.',
    'Размер и детализация: проработанность деталей в норме. Эмоциональные маркеры: требуют уточнения в беседе.',
    'ВНИМАНИЕ: это черновик. Окончательная интерпретация — за психологом. Проверьте и при необходимости скорректируйте.',
  ].join(' ');
}

/**
 * OMR: распознать бумажный бланк теста с галочками → массив «сырых баллов» по
 * вопросам. Через vision-модель (JSON-ответ); без ключа — детерминированный stub
 * (середина шкалы), который психолог проверяет и правит.
 */
export async function omrExtract(imageDataUrl: string, questionCount: number, scaleMax: number, allowCloud = true): Promise<{ scores: number[]; source: 'llm' | 'stub' }> {
  const n = Math.max(1, questionCount);
  if (allowCloud && isLlmConfigured()) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Bilim OS' },
        body: JSON.stringify({
          model: VISION_MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Это бланк теста с ${n} вопросами, шкала 1..${scaleMax}. Считай отмеченное значение по каждому вопросу. Верни СТРОГО JSON: {"scores":[<число по каждому из ${n} вопросов>]}. Если не видно — ставь 0.` },
            { role: 'user', content: [{ type: 'text', text: 'Распознай отметки.' }, { type: 'image_url', image_url: { url: imageDataUrl } }] },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as { scores?: number[] };
          if (Array.isArray(parsed.scores)) {
            const scores = Array.from({ length: n }, (_, i) => Math.max(0, Math.min(scaleMax, Math.round(Number(parsed.scores![i]) || 0))));
            return { scores, source: 'llm' };
          }
        }
      }
    } catch (e) {
      console.error('omrExtract LLM error, fallback to stub:', e);
    }
  }
  const mid = Math.round((scaleMax + 1) / 2);
  return { scores: Array.from({ length: n }, () => mid), source: 'stub' };
}

export async function visionInterpret(imageDataUrl: string, methodology: string, allowCloud = true): Promise<{ text: string; source: 'llm' | 'stub' }> {
  if (allowCloud && isLlmConfigured()) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://bilimos.kg',
          'X-Title': 'Bilim OS',
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Ты — ассистент детского психолога. Проанализируй проективный рисунок по научным критериям методики и выдай ЧЕРНОВИК заключения (нажим, расположение, размер, детали, эмоциональные маркеры). Не давай диагнозов. Финальное слово — за психологом. На изображении персональные данные заблюрены — не пытайся их прочитать.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Методика: «${methodology}». Дай черновик интерпретации.` },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
          temperature: 0.4,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = json.choices?.[0]?.message?.content;
        if (text) return { text, source: 'llm' };
      }
    } catch (e) {
      console.error('visionInterpret LLM error, fallback to stub:', e);
    }
  }
  return { text: stubInterpret(methodology), source: 'stub' };
}
