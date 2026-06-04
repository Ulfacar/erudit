import { type AssistantScope } from '@/shared/lib/ai/scope';
import { executeTool, knowledgeQueryWords } from '@/shared/lib/ai/tools';

/**
 * Демо-режим ассистента без LLM-ключа: разбираем вопрос по ключевым словам
 * и отвечаем РЕАЛЬНЫМИ данными через те же инструменты с теми же зонами доступа.
 * Когда появится OPENROUTER_API_KEY — этот код перестаёт использоваться,
 * включается полноценный tool-calling через модель (см. assistant.ts).
 */

interface StubResult {
  reply: string;
  usedTools: string[];
  model: string;
}

type Json = Record<string, unknown>;

const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('ru-RU') : String(v ?? '—'));

const ATT_LABEL: Record<string, string> = {
  present: 'присутствовали',
  absent: 'отсутствовали',
  late: 'опоздали',
  excused: 'освобождены',
  trip: 'на выезде',
  quarantine: 'карантин',
};

const STAGE_LABEL: Record<string, string> = {
  lead: 'заявка',
  testing: 'тестирование',
  psych: 'психолог',
  director: 'директор',
  contract: 'договор',
  enrolled: 'зачислены',
  rejected: 'отказ',
};

function attLine(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '—';
  const entries = Object.entries(obj as Record<string, number | string>);
  if (!entries.length) return 'данных пока нет';
  return entries.map(([k, v]) => `${ATT_LABEL[k] ?? k}: ${v}`).join(', ');
}

export async function stubAssistant(scope: AssistantScope, userMessage: string): Promise<StubResult> {
  const q = userMessage.toLowerCase();
  const usedTools: string[] = [];

  const run = async (name: string, args: Record<string, unknown> = {}): Promise<Json> => {
    usedTools.push(name);
    return JSON.parse(await executeTool(name, args, scope)) as Json;
  };
  const reply = (text: string): StubResult => ({ reply: text, usedTools, model: 'demo' });
  const denied = (r: Json) => 'error' in r;

  const myStudentId = Array.isArray(scope.allowedStudentIds) ? scope.allowedStudentIds[0] : null;
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  // выдержка из базы знаний (или null) — общий фолбэк для «как устроено в школе»
  const tryKnowledge = async (): Promise<string | null> => {
    if (!knowledgeQueryWords(userMessage).length) return null;
    const r = (await run('school_knowledge', { query: userMessage })) as unknown;
    if (Array.isArray(r) && r.length) {
      return `Из базы знаний школы:\n\n${r.map((d) => `📄 ${d['документ']}\n${d['выдержка']}`).join('\n\n')}`;
    }
    return null;
  };

  try {
    // ── Воронка приёмной ──
    if (has('ворон', 'приём', 'прием', 'заявк', 'зачислен')) {
      const r = await run('admission_funnel');
      if (denied(r)) {
        // у родителя/ученика нет воронки — но «как проходит приём» есть в базе знаний
        const kb = await tryKnowledge();
        return reply(kb ?? 'У вашей роли нет доступа к данным приёмной.');
      }
      if ('info' in r) return reply(String(r.info));
      const stages = Object.entries((r['по_этапам'] as Record<string, number>) ?? {})
        .map(([k, v]) => `• ${STAGE_LABEL[k] ?? k}: ${v}`)
        .join('\n');
      return reply(
        `Воронка приёмной — всего заявок: ${num(r['всего_заявок'])}\n${stages}\n\nКонверсия в зачисление: ${r['конверсия_в_зачисление']}`,
      );
    }

    // ── Финансы ──
    if (has('финанс', 'оплат', 'задолж', 'долг', 'счет', 'счёт', 'деньг')) {
      // родитель/ученик — по своему ребёнку/себе
      if (scope.allowedStudentIds !== 'all') {
        if (!myStudentId) return reply('Не нашёл привязанного ученика для вашего аккаунта.');
        const r = await run('student_finance', { studentId: myStudentId });
        if (denied(r)) return reply('У вашей роли нет доступа к финансовым данным.');
        const invoices = (r['счета'] as Array<Json>) ?? [];
        const lines = invoices
          .slice(0, 6)
          .map((i) => `• ${i['название']}: ${num(i['сумма'])} сом — ${i['статус'] === 'paid' ? 'оплачен ✅' : i['статус'] === 'pending' ? 'ожидает оплаты' : String(i['статус'])}`)
          .join('\n');
        const debt = Number(r['задолженность'] ?? 0);
        return reply(
          `Оплата обучения:\n${lines}\n\nИтого начислено: ${num(r['итого_начислено'])} сом · оплачено: ${num(r['итого_оплачено'])} сом\n${debt > 0 ? `⚠️ Задолженность: ${num(debt)} сом` : '✅ Задолженности нет'}`,
        );
      }
      const r = await run('finance_summary');
      if (denied(r)) return reply('У вашей роли нет доступа к финансовой сводке школы.');
      return reply(
        `Финансовая сводка школы:\n• Начислено всего: ${num(r['начислено_всего'])} сом\n• Оплачено: ${num(r['оплачено_всего'])} сом\n• Задолженность: ${num(r['задолженность'])} сом\n• Оплат в этом месяце: ${num(r['оплат_в_этом_месяце'])} сом\n• Расходы в этом месяце: ${num(r['расходы_в_этом_месяце'])} сом\n• Учеников с долгом: ${num(r['учеников_с_долгом'])}`,
      );
    }

    // ── Наполняемость / классы ──
    if (has('наполняем', 'классы', 'классов', 'мои класс', 'моим класс', 'по класс')) {
      const gradeMatch = q.match(/(\d{1,2})/);
      const args = gradeMatch ? { grade: parseInt(gradeMatch[1], 10) } : {};
      const r = (await run('class_occupancy', args)) as unknown;
      if (Array.isArray(r)) {
        const lines = r
          .slice(0, 14)
          .map((c) => `• ${c['класс']}: ${c['учеников']} учеников${c['куратор'] ? ` (куратор: ${c['куратор']})` : ''}`)
          .join('\n');
        const total = r.reduce((s, c) => s + Number(c['учеников'] ?? 0), 0);
        return reply(`${gradeMatch ? `Наполняемость ${gradeMatch[1]}-х классов` : 'Наполняемость классов'}:\n${lines}\n\nИтого учеников: ${total}`);
      }
      return reply('Классы не найдены в вашей зоне доступа.');
    }

    // ── Сводка по школе / сколько учеников ──
    if (has('сколько учеников', 'сводка по школе', 'обзор школы', 'общая сводка', 'сколько детей', 'статистик')) {
      const r = await run('school_overview');
      if (denied(r)) {
        // у учителя нет всей школы — показываем его классы
        const occ = (await run('class_occupancy')) as unknown;
        if (Array.isArray(occ)) {
          const total = occ.reduce((s, c) => s + Number(c['учеников'] ?? 0), 0);
          return reply(`В ваших классах ${total} учеников:\n${occ.map((c) => `• ${c['класс']}: ${c['учеников']}`).join('\n')}`);
        }
        return reply('У вашей роли нет доступа к общешкольной статистике.');
      }
      return reply(
        `Сводка по школе:\n• Учеников: ${num(r['учеников'])}\n• Педагогов: ${num(r['педагогов'])}\n• Классов: ${num(r['классов'])}\n• Родителей в системе: ${num(r['родителей'])}\n• Посещаемость сегодня: ${attLine(r['посещаемость_сегодня'])}\n• Открытых инцидентов: ${num(r['открытых_инцидентов'])}`,
      );
    }

    // ── Посещаемость ──
    if (has('посеща', 'пропуск', 'опоздан')) {
      const daysMatch = q.match(/(\d{1,2})\s*(дн|день|нед|мес)/);
      const days = daysMatch ? (daysMatch[2].startsWith('нед') ? Number(daysMatch[1]) * 7 : daysMatch[2].startsWith('мес') ? 30 : Number(daysMatch[1])) : 30;
      const r = await run('attendance_trends', { days });
      if ('info' in r) return reply(String(r.info));
      const lines = Object.entries((r['по_статусам'] as Record<string, string>) ?? {})
        .map(([k, v]) => `• ${ATT_LABEL[k] ?? k}: ${v}`)
        .join('\n');
      return reply(`Посещаемость за ${r['период_дней']} дней (всего отметок: ${num(r['всего_отметок'])}):\n${lines}`);
    }

    // ── Профиль ребёнка / свои оценки ──
    if (has('ребён', 'ребен', 'сын', 'доч', 'мои оценки', 'моя успеваемость', 'мой профиль', 'расскажи про')) {
      if (!myStudentId) {
        return reply(scope.allowedStudentIds === 'all' ? 'Уточните, про какого ученика рассказать — напишите «найди <имя>».' : 'Не нашёл привязанного ученика для вашего аккаунта.');
      }
      const r = await run('student_profile', { studentId: myStudentId });
      if (denied(r)) return reply('Нет доступа к профилю.');
      const grades = ((r['оценки_по_предметам'] as Array<Json>) ?? [])
        .slice(0, 8)
        .map((g) => `• ${g['предмет']}: средний ${g['средний']} (последние: ${(g['последние'] as number[]).join(', ')})`)
        .join('\n');
      const ach = (r['достижения'] as string[]) ?? [];
      const inc = (r['замечания'] as Array<Json>) ?? [];
      return reply(
        [
          `${r['имя']}, ${r['класс']}${r['куратор'] ? ` (куратор: ${r['куратор']})` : ''}`,
          '',
          grades ? `Оценки по предметам:\n${grades}` : 'Оценок пока нет.',
          `\nПосещаемость за 30 дней: ${attLine(r['посещаемость_30_дней'])}`,
          ach.length ? `\n🏆 Достижения: ${ach.slice(0, 3).join('; ')}` : '',
          inc.length ? `\n⚠️ Замечания: ${inc.map((i) => String(i['описание'])).slice(0, 2).join('; ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    // ── Поиск ученика ──
    if (has('найди', 'найти', 'поиск')) {
      const query = userMessage.replace(/найди( ученика)?|найти( ученика)?|поиск/gi, '').trim();
      if (query.length < 2) return reply('Напишите имя или фамилию: например, «найди Асанов».');
      const r = (await run('find_student', { query })) as unknown;
      if (Array.isArray(r)) {
        return reply(`Нашёл:\n${r.map((s) => `• ${s['имя']} — ${s['класс']}`).join('\n')}\n\nСпросите: «расскажи про <имя>» (полные профили — в разделе «Ученики»).`);
      }
      return reply('Не нашёл такого ученика в вашей зоне доступа.');
    }

    // ── AI-инсайты: аномалии ──
    if (has('инсайт', 'аномал', 'что не так', 'проблем', 'риски', 'требует внимания')) {
      const r = (await run('school_insights', {})) as unknown;
      if (Array.isArray(r) && r.length) {
        const lines = r
          .map((i) => `${i['важность'] === 'urgent' ? '🔴' : i['важность'] === 'warn' ? '⚠️' : 'ℹ️'} ${i['заголовок']}\n   ${i['детали']}`)
          .join('\n');
        return reply(`Аномалии, которые нашло ядро:\n${lines}`);
      }
      if (r && typeof r === 'object' && 'info' in (r as Json)) return reply(String((r as Json).info));
      return reply('У вашей роли нет доступа к инсайтам школы.');
    }

    // ── Сигналы агентов ──
    if (has('агент', 'входящ', 'сигнал', 'тревож', 'алерт', 'уведомлен', 'рекоменд')) {
      const r = (await run('agent_inbox')) as unknown;
      if (Array.isArray(r)) {
        const lines = r.slice(0, 6).map((i) => `• ${i['важность'] === 'warn' || i['важность'] === 'urgent' ? '⚠️ ' : ''}${i['заголовок']}: ${i['текст']}`).join('\n');
        return reply(`Активные сигналы агентов:\n${lines}`);
      }
      return reply('Входящих сигналов от агентов нет — всё спокойно.');
    }

    // ── Приветствие ──
    if (has('привет', 'салам', 'здравств', 'кто ты', 'что ты умеешь', 'помощь', 'help')) {
      return reply(
        `Здравствуйте, ${scope.displayName}! Я ассистент ядра Bilim OS — отвечаю по реальным данным школы в рамках вашей роли (${scope.roleLabel.toLowerCase()}).\n\nПопробуйте спросить:\n${suggestions(scope)}`,
      );
    }

    // ── База знаний школы: «как устроено» (режим, приём, оплата, контакты) ──
    const kb = await tryKnowledge();
    if (kb) return reply(kb);

    // ── Не разобрали вопрос ──
    return reply(`Пока я отвечаю на типовые вопросы по данным школы. Попробуйте:\n${suggestions(scope)}`);
  } catch (err) {
    console.error('[assistant-stub] failed:', err);
    return reply('Не получилось обработать вопрос — попробуйте переформулировать.');
  }
}

function suggestions(scope: AssistantScope): string {
  if (scope.role === 'parent') return '• «Расскажи про моего ребёнка»\n• «Есть ли задолженность по оплате?»\n• «Как посещаемость?»';
  if (scope.role === 'student') return '• «Мои оценки»\n• «Моя посещаемость»\n• «Что мне рекомендуют агенты?»';
  if (scope.role === 'teacher' || scope.role === 'curator') return '• «Сводка по моим классам»\n• «Посещаемость за месяц»\n• «Мои входящие от агентов»';
  if (scope.role === 'specialist') return '• «У кого тревожные сигналы?»\n• «Найди <имя ученика>»';
  return '• «Сколько учеников в школе?»\n• «Наполняемость 5-х классов»\n• «Сводка по финансам»\n• «Что в воронке приёмной?»\n• «Посещаемость за месяц»';
}
