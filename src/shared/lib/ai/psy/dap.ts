import { chatJson, isLlmConfigured } from '@/shared/lib/ai/openrouter';

/**
 * Структурирование сырой заметки сессии в формат DAP (Data / Assessment / Plan).
 * Вход — УЖЕ обезличенный текст (с маркерами). Реальное AI-структурирование —
 * через облачный Claude (OpenRouter); если ключ не задан — детерминированный
 * fallback-сплиттер по ключевым словам (чтобы фича работала без ключа).
 */

export interface Dap {
  data: string;
  assessment: string;
  plan: string;
}

const SYSTEM = [
  'Ты — ассистент школьного психолога. Преобразуй сырую заметку о сессии в стандарт DAP.',
  'Верни СТРОГО JSON: {"data": "...", "assessment": "...", "plan": "..."}.',
  '- data: объективные факты, наблюдения, что говорил/делал ребёнок.',
  '- assessment: профессиональная оценка психолога, гипотезы, динамика.',
  '- plan: следующие шаги, техники, рекомендации.',
  'Убери "воду", не выдумывай фактов. Маркеры вида [УЧЕНИК_1], [ЛИЦО_2] оставляй КАК ЕСТЬ — не раскрывай и не придумывай имён.',
].join('\n');

// NB: без \b — он ASCII-only и не работает перед кириллицей; substring-матч стемов достаточно.
const PLAN_KW = /(план|следующ|рекоменд|домашн|задани|будем|нужно|предлага|назнач|техник|в дальнейшем|на след)/i;
const ASSESS_KW = /(оценк|гипотез|состояни|динамик|вероятн|похоже|тревож|депресс|адаптац|мотивац|самооцен|вывод|предполож)/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Детерминированный fallback: раскладка предложений по ключевым словам. */
export function stubDap(text: string): Dap {
  const data: string[] = [], assessment: string[] = [], plan: string[] = [];
  for (const s of splitSentences(text)) {
    if (PLAN_KW.test(s)) plan.push(s);
    else if (ASSESS_KW.test(s)) assessment.push(s);
    else data.push(s);
  }
  return { data: data.join(' '), assessment: assessment.join(' '), plan: plan.join(' ') };
}

export async function structureDap(
  maskedText: string,
  opts?: { allowCloud?: boolean },
): Promise<{ dap: Dap; source: 'llm' | 'stub' }> {
  // allowCloud=false — строгий режим приватности заблокировал облако: только локально.
  const allowCloud = opts?.allowCloud ?? true;
  if (allowCloud && isLlmConfigured()) {
    try {
      const j = (await chatJson(SYSTEM, maskedText, 0.3)) as Partial<Dap>;
      return {
        dap: { data: j.data ?? '', assessment: j.assessment ?? '', plan: j.plan ?? '' },
        source: 'llm',
      };
    } catch (e) {
      console.error('structureDap LLM error, fallback to stub:', e);
    }
  }
  return { dap: stubDap(maskedText), source: 'stub' };
}
