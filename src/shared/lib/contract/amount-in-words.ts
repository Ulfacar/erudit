// Сумма прописью (сомы) для печати договора. Достаточно до миллиардов.

const ONES = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

/** Склонение слова по числу: [1, 2-4, 5+]. */
function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

/** 0..999 прописью. feminine=true для тысяч (одна/две тысячи). */
function tripletToWords(n: number, feminine: boolean): string {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) out.push(HUNDREDS[h]);
  if (t === 1) {
    out.push(TEENS[o]);
  } else {
    if (t) out.push(TENS[t]);
    if (o) out.push((feminine ? ONES_F : ONES)[o]);
  }
  return out.join(' ');
}

/** Целое число прописью + слово «сом» в нужной форме. Напр. 450000 → «четыреста пятьдесят тысяч сом». */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'ноль сом';

  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (millions) {
    parts.push(tripletToWords(millions, false));
    parts.push(plural(millions, ['миллион', 'миллиона', 'миллионов']));
  }
  if (thousands) {
    parts.push(tripletToWords(thousands, true));
    parts.push(plural(thousands, ['тысяча', 'тысячи', 'тысяч']));
  }
  if (rest) {
    parts.push(tripletToWords(rest, false));
  }
  parts.push(plural(n, ['сом', 'сома', 'сомов']));
  return parts.filter(Boolean).join(' ');
}
