import { prisma } from '@/shared/lib/prisma';

/**
 * Серверное обезличивание (Local Edge AI, прагматичный вариант).
 *
 * ФИО ученика кейса (+ эвристически — любые рус. ФИО в тексте) заменяются на
 * маркеры [УЧЕНИК_1]/[ЛИЦО_N] ДО отправки в облачный LLM. Обратная карта
 * (marker → реальное имя) НЕ покидает сервер — используется только для
 * ре-идентификации ответа перед показом психологу.
 */

export interface DeidResult {
  masked: string;
  map: Record<string, string>; // marker → реальное имя
  count: number;
}

function variants(...parts: Array<string | null | undefined>): string[] {
  const p = parts.map((s) => (s ?? '').trim()).filter((s) => s.length > 1);
  const combos = new Set<string>(p);
  if (p.length >= 2) {
    combos.add(`${p[0]} ${p[1]}`);
    combos.add(`${p[1]} ${p[0]}`);
  }
  // длинные варианты — первыми, чтобы не разрезать частичным совпадением
  return [...combos].sort((a, b) => b.length - a.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Базовое маскирование по списку известных сущностей + эвристика рус. ФИО. */
export function maskText(text: string, entities: Array<{ marker: string; variants: string[] }>): DeidResult {
  let masked = text;
  const map: Record<string, string> = {};

  // 1) известные имена (точная подстановка, регистронезависимо)
  for (const ent of entities) {
    let hit = false;
    for (const v of ent.variants) {
      // Cyrillic-aware границы: JS \b не работает с кириллицей, используем \p{L}.
      const re = new RegExp(`(?<!\\p{L})${escapeRe(v)}(?!\\p{L})`, 'giu');
      if (re.test(masked)) {
        masked = masked.replace(re, ent.marker);
        hit = true;
      }
    }
    if (hit) map[ent.marker] = ent.variants[0]; // канон — самый длинный вариант
  }

  // 2) эвристика: 2–3 подряд идущих слова с заглавной кириллицей = вероятное ФИО
  let n = 1;
  const personRe = /(?:[А-ЯЁ][а-яё]+\s+){1,2}[А-ЯЁ][а-яё]+/g;
  masked = masked.replace(personRe, (m) => {
    // пропускаем уже вставленные маркеры
    if (m.includes('[')) return m;
    const marker = `[ЛИЦО_${n++}]`;
    map[marker] = m;
    return marker;
  });

  return { masked, map, count: Object.keys(map).length };
}

/** Маскирование текста с привязкой к ученику кейса. */
export async function deidentifyForCase(caseId: string, text: string): Promise<DeidResult> {
  const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { studentId: true } });
  const entities: Array<{ marker: string; variants: string[] }> = [];
  if (c?.studentId) {
    const st = await prisma.student.findUnique({
      where: { id: c.studentId },
      select: { firstName: true, lastName: true, middleName: true },
    });
    if (st) entities.push({ marker: '[УЧЕНИК_1]', variants: variants(st.lastName, st.firstName, st.middleName) });
  }
  return maskText(text, entities);
}

/** Возврат реальных имён в текст по карте маркеров (для показа психологу). */
export function reidentify(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [marker, name] of Object.entries(map)) {
    out = out.split(marker).join(name);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAIL-CLOSED: оценка остаточного PII в УЖЕ обезличенном тексте.
// Если детектор хоть что-то нашёл — строгий режим НЕ отправляет текст в облако,
// а структурирует локально. «Если не уверены, что обезличили — не отправляем.»
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LONGID_RE = /\d{9,}/; // ПИН/паспорт/удостоверение (длинные цифровые ID)

// Одиночное имя эвристика «2–3 слова с заглавной» не ловит (мама Айгуль, брат Тимур).
// Компактный словарь распространённых имён КР/РФ — срабатывание = повод не рисковать.
const GIVEN_NAMES = new Set(
  [
    'Айгуль','Айбек','Айнура','Айдай','Айсулуу','Азамат','Аскар','Асель','Адель','Алина','Алия','Аман','Анара','Арман','Асан','Атай',
    'Бакыт','Бектур','Бегимай','Бермет','Болот','Бакай','Бурул',
    'Гульнара','Гуля','Гулзат','Гулмира','Данияр','Дастан','Дина','Дильназ',
    'Жамиля','Жаныл','Жылдыз','Жибек','Заир','Зарина','Залкар',
    'Иса','Искендер','Канат','Каныкей','Касым','Кубат','Кымбат','Канышай',
    'Майрам','Мээрим','Медер','Мирлан','Нургуль','Нурлан','Нурзат','Нурбек','Назгуль','Нуржан',
    'Омурбек','Орозбек','Перизат','Расул','Руслан','Самат','Салтанат','Сейтек','Сымбат',
    'Тимур','Талант','Темир','Тахмина','Улан','Урмат','Чолпон','Чынара','Эльнура','Эрлан','Эмир','Эрмек','Жакшылык',
    'Александр','Андрей','Анна','Дмитрий','Елена','Иван','Мария','Наталья','Ольга','Сергей','Татьяна','Максим','Виктория',
  ].map((s) => s.toLowerCase()),
);

export interface ResidualRisk {
  risky: boolean;
  signals: string[]; // человекочитаемые причины (для показа психологу)
}

/** Сканирует обезличенный текст на «недодавленный» PII. Любой сигнал → риск. */
export function residualPiiRisk(masked: string): ResidualRisk {
  const signals: string[] = [];

  if (EMAIL_RE.test(masked)) signals.push('эл. почта');
  if (LONGID_RE.test(masked)) signals.push('номер документа');

  // Телефон: токен из цифр/разделителей, в котором ≥9 цифр (отсекает даты).
  const phoneTok = masked.match(/\+?\d[\d\s\-()]{7,}\d/);
  if (phoneTok && phoneTok[0].replace(/\D/g, '').length >= 9) signals.push('телефон');

  // Одиночные имена из словаря (то, что не поймала эвристика ФИО).
  const names = new Set<string>();
  for (const m of masked.matchAll(/[А-ЯЁ][а-яё]+/g)) {
    if (GIVEN_NAMES.has(m[0].toLowerCase())) names.add(m[0]);
  }
  if (names.size) signals.push(`возможное имя (${[...names].join(', ')})`);

  return { risky: signals.length > 0, signals };
}

/**
 * Строгий режим приватности. ВКЛЮЧЁН ПО УМОЛЧАНИЮ (ответ Эмиру, вопрос №1).
 * Отключается только явно: PSY_STRICT_PRIVACY = off | 0 | false.
 */
export function strictPrivacyEnabled(): boolean {
  const v = (process.env.PSY_STRICT_PRIVACY ?? '').trim().toLowerCase();
  return !(v === 'off' || v === '0' || v === 'false');
}
