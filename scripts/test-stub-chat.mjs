// Тест demo-режима ассистента через API с корректным UTF-8.
// node scripts/test-stub-chat.mjs [baseUrl]
const BASE = process.argv[2] || 'http://localhost:3000';
const PASS = 'erudit2025';

async function loginCookies(login) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie().map((c) => c.split(';')[0]);
  const body = new URLSearchParams({ csrfToken, login, password: PASS, redirect: 'false' });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies.join('; ') },
    body,
    redirect: 'manual',
  });
  res.headers.getSetCookie().forEach((c) => cookies.push(c.split(';')[0]));
  return cookies.join('; ');
}

async function ask(cookie, message) {
  const res = await fetch(`${BASE}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ message }),
  });
  const j = await res.json();
  return j.success ? j.data.reply : JSON.stringify(j);
}

const SCENARIOS = [
  ['admin', ['Сколько учеников в школе?', 'Наполняемость 5-х классов', 'Сводка по финансам', 'Что в воронке приёмной?', 'Посещаемость за месяц']],
  ['parent1', ['Расскажи про моего ребёнка', 'Есть ли задолженность по оплате?']],
  ['matematik', ['Сводка по моим классам', 'Сводка по финансам']],
  ['student1', ['Мои оценки']],
];

for (const [login, questions] of SCENARIOS) {
  const cookie = await loginCookies(login);
  console.log(`\n########## ${login} ##########`);
  for (const msg of questions) {
    console.log(`\n>>> ${msg}`);
    console.log(await ask(cookie, msg));
  }
}
