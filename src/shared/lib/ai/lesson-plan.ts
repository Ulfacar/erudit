import { z } from 'zod';
import { chatJson, isLlmConfigured, activeModel } from '@/shared/lib/ai/openrouter';

/**
 * ИИ-генератор поурочного плана (черновик).
 * С ключом OPENROUTER_API_KEY — реальный LLM, иначе детерминированный стаб.
 */

export const stageSchema = z.object({
  title: z.string().min(1).max(200),
  minutes: z.number().int().min(1).max(120),
  activity: z.string().min(1).max(800),
});
export const lessonPlanSchema = z.object({
  objectives: z.string().min(1).max(2000),
  stages: z.array(stageSchema).min(2).max(12),
  homework: z.string().max(2000).optional().default(''),
});
export type LessonStage = z.infer<typeof stageSchema>;
export type LessonPlanDraft = z.infer<typeof lessonPlanSchema> & { model: string };

export interface LessonPlanRequest {
  topic: string;
  subject?: string | null;
  gradeLevel?: string | null;
  duration?: number;
}

export { isLlmConfigured };

function stub(req: LessonPlanRequest): LessonPlanDraft {
  const dur = req.duration ?? 45;
  const warm = Math.max(5, Math.round(dur * 0.1));
  const main = Math.round(dur * 0.55);
  const practice = Math.round(dur * 0.25);
  const wrap = Math.max(3, dur - warm - main - practice);
  return {
    objectives: `Сформировать понимание темы «${req.topic}»: ключевые понятия, связь с предыдущим материалом и практическое применение.`,
    stages: [
      { title: 'Орг. момент и актуализация', minutes: warm, activity: 'Приветствие, проверка готовности, повторение пройденного через 2–3 вопроса.' },
      { title: 'Объяснение нового материала', minutes: main, activity: `Разбор темы «${req.topic}» с примерами на доске, вовлечение класса вопросами.` },
      { title: 'Практика / закрепление', minutes: practice, activity: 'Самостоятельная работа по образцу, разбор типичных ошибок.' },
      { title: 'Итоги и рефлексия', minutes: wrap, activity: 'Краткий итог, проверка понимания, выставление домашнего задания.' },
    ],
    homework: `Повторить «${req.topic}», выполнить 3–5 заданий по теме.`,
    model: 'stub',
  };
}

function buildPrompt(req: LessonPlanRequest) {
  const dur = req.duration ?? 45;
  const system = [
    'Ты — опытный методист. Составляешь план одного урока.',
    'Отвечай СТРОГО валидным JSON без markdown.',
    'Схема: {"objectives": string, "stages": [{"title": string, "minutes": number, "activity": string}], "homework": string}.',
    `Сумма minutes всех этапов ≈ ${dur}. Язык — русский. Кратко и по делу.`,
  ].join(' ');
  const user = [
    `Тема урока: ${req.topic}.`,
    req.subject ? `Предмет: ${req.subject}.` : '',
    req.gradeLevel ? `Класс: ${req.gradeLevel}.` : '',
    `Длительность урока: ${dur} минут.`,
  ].filter(Boolean).join(' ');
  return { system, user };
}

export async function generateLessonPlan(req: LessonPlanRequest): Promise<LessonPlanDraft> {
  if (!isLlmConfigured()) return stub(req);
  const { system, user } = buildPrompt(req);
  const parsed = lessonPlanSchema.parse(await chatJson(system, user));
  return { ...parsed, model: activeModel() };
}
