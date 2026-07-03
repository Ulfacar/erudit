import { type AssistantScope } from '@/shared/lib/ai/scope';
import { toolDefinitionsForScope, executeTool } from '@/shared/lib/ai/tools';
import { stubAssistant } from '@/shared/lib/ai/assistant-stub';
import {
  aiStrictPrivacy,
  createMaskSession,
  guardInput,
  logGuard,
  signalTypes,
} from '@/shared/lib/ai/privacy-guard';
import { residualPiiRisk } from '@/shared/lib/ai/psy/deidentify';

/**
 * Мозг ассистента ядра: цикл tool-calling поверх OpenRouter (OpenAI-совместимый).
 *
 * Модель сама решает, какие инструменты дёрнуть (school_overview, student_profile...),
 * сервер выполняет их строго в зоне доступа роли и возвращает результат модели,
 * пока та не сформулирует финальный ответ. Максимум MAX_ITERATIONS итераций.
 *
 * Ошибки сети/провайдера НИКОГДА не бросаются наружу — возвращается дружелюбный
 * текст, чат не падает. Без OPENROUTER_API_KEY — вежливое сообщение-заглушка.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
const MAX_ITERATIONS = 6;

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AssistantResult {
  reply: string;
  usedTools: string[];
  model: string;
  privacy?: {
    guarded: boolean;
    maskedEntities: number;
  };
}

function buildSystemPrompt(scope: AssistantScope): string {
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    'Ты — ассистент ядра Bilim OS, единой цифровой экосистемы школы.',
    `Сегодня ${today}.`,
    `Пользователь: ${scope.displayName}, роль — ${scope.roleLabel}.`,
    'Все данные школы получай ТОЛЬКО через инструменты — никогда не выдумывай цифры, имена и факты.',
    'Инструменты уже ограничены зоной доступа пользователя: родитель видит только своих детей, учитель — свои классы, директор — всю школу.',
    'Если инструмент вернул {"error": "вне зоны доступа"} — вежливо скажи, что у пользователя нет доступа к этим данным.',
    'Отвечай на русском, кратко и по делу. Числа и списки оформляй markdown-списками. Не упоминай названия инструментов и техническую кухню.',
    'Если вопрос не про школу — отвечай коротко и мягко возвращай разговор к делам школы.',
    scope.role === 'parent' ? 'Говори о ребёнке тепло и поддерживающе, давай практичные советы родителю.' : '',
    scope.role === 'student' ? 'Говори дружелюбно и мотивирующе, как наставник.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function assistantConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function callOpenRouter(messages: ApiMessage[], scope: AssistantScope): Promise<{
  content: string | null;
  toolCalls: ToolCall[] | null;
}> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://bilimos.kg',
      'X-Title': 'Bilim OS — Core Assistant',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      tools: toolDefinitionsForScope(scope),
      tool_choice: 'auto',
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  };
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error('OpenRouter вернул пустой ответ');
  return { content: msg.content ?? null, toolCalls: msg.tool_calls?.length ? msg.tool_calls : null };
}

export async function runAssistant(args: {
  scope: AssistantScope;
  history: ChatTurn[];
  userMessage: string;
}): Promise<AssistantResult> {
  const { scope, history, userMessage } = args;
  const guard = guardInput(scope, userMessage);
  if (!guard.ok) {
    logGuard({ role: scope.role, action: 'input_denied', domain: guard.domain });
    return {
      reply: guard.reply,
      usedTools: [],
      model: 'privacy-guard',
      privacy: { guarded: true, maskedEntities: 0 },
    };
  }

  // Без ключа — детерминированная заглушка: те же инструменты и реальные данные,
  // но разбор вопроса по ключевым словам вместо LLM. С ключом включается ИИ.
  if (!assistantConfigured()) {
    const result = await stubAssistant(scope, userMessage);
    return { ...result, privacy: { guarded: false, maskedEntities: 0 } };
  }

  const maskSession = createMaskSession();
  const messages: ApiMessage[] = [
    { role: 'system', content: buildSystemPrompt(scope) },
    ...history.map((t) => ({ role: t.role, content: maskSession.maskOut(t.content) }) as ApiMessage),
    { role: 'user', content: maskSession.maskOut(userMessage) },
  ];
  if (maskSession.maskedCount() > 0) {
    logGuard({ role: scope.role, action: 'masked', maskedCount: maskSession.maskedCount() });
  }
  const usedTools: string[] = [];

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { content, toolCalls } = await callOpenRouter(messages, scope);

      if (!toolCalls) {
        return {
          reply: maskSession.reidentifyReply(content?.trim() || 'Не получилось сформулировать ответ, попробуйте переформулировать вопрос.'),
          usedTools,
          model: DEFAULT_MODEL,
          privacy: { guarded: false, maskedEntities: maskSession.maskedCount() },
        };
      }

      messages.push({ role: 'assistant', content: content ?? null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        usedTools.push(call.function.name);
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(maskSession.unmaskArgs(call.function.arguments || '{}'));
        } catch {
          /* пустые аргументы */
        }
        const result = await executeTool(call.function.name, parsedArgs, scope);
        let maskedResult = maskSession.maskOut(result);
        if (aiStrictPrivacy() && isFailClosedTool(call.function.name)) {
          const risk = residualPiiRisk(maskedResult);
          if (risk.risky) {
            maskedResult = JSON.stringify({ error: 'данные придержаны политикой приватности' });
            logGuard({
              role: scope.role,
              action: 'fail_closed',
              domain: failClosedDomain(scope),
              maskedCount: maskSession.maskedCount(),
              signalTypes: signalTypes(risk.signals),
            });
          }
        }
        messages.push({ role: 'tool', content: maskedResult, tool_call_id: call.id });
      }
    }
    // лимит итераций — просим модель ответить без новых тулов
    messages.push({
      role: 'user',
      content: 'Сформулируй финальный ответ по уже собранным данным, без дополнительных запросов.',
    });
    const final = await callOpenRouter(messages, scope);
    return {
      reply: maskSession.reidentifyReply(final.content?.trim() || 'Собрал данные, но не успел сформулировать ответ — спросите ещё раз.'),
      usedTools,
      model: DEFAULT_MODEL,
      privacy: { guarded: false, maskedEntities: maskSession.maskedCount() },
    };
  } catch (err) {
    console.error('[assistant] runAssistant failed:', err);
    return {
      reply: 'Не удалось связаться с ИИ-моделью. Проверьте подключение и попробуйте ещё раз через минуту.',
      usedTools,
      model: DEFAULT_MODEL,
      privacy: { guarded: false, maskedEntities: maskSession.maskedCount() },
    };
  }
}

function isFailClosedTool(name: string): boolean {
  return name === 'student_psych';
}

function failClosedDomain(scope: AssistantScope): 'psych' | 'medical' {
  if (scope.allowedSpecialistKinds !== 'all' && scope.allowedSpecialistKinds.includes('medical') && !scope.allowedSpecialistKinds.includes('psych')) {
    return 'medical';
  }
  return 'psych';
}
