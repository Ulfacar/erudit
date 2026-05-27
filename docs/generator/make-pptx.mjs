import pptxgen from 'pptxgenjs';

const ACCENT = 'E91E8C';
const DARK = '1A1B1E';
const GREY = '5A5A5A';
const LIGHT = 'F7E9F1';
const URL = 'https://erudit-school.vercel.app';
const FONT = 'Calibri';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5"
pptx.author = 'ERUDIT';
pptx.title = 'ERUDIT — обзор для эксперта-педагога';

const W = 13.33;

function contentSlide(title) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.0, fill: { color: ACCENT } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.0, w: W, h: 0.06, fill: { color: DARK } });
  s.addText(title, { x: 0.6, y: 0.1, w: W - 1.2, h: 0.8, fontSize: 26, bold: true, color: 'FFFFFF', fontFace: FONT, valign: 'middle' });
  s.addText('ERUDIT', { x: W - 2.0, y: 6.95, w: 1.6, h: 0.4, fontSize: 11, color: GREY, align: 'right', fontFace: FONT });
  return s;
}

const bullets = (items) => items.map((t) => ({
  text: t, options: { bullet: { code: '2022', indent: 18 }, fontSize: 18, color: DARK, paraSpaceAfter: 10, fontFace: FONT },
}));

/* 1. Title */
{
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: ACCENT } });
  s.addText(
    [
      { text: 'ER', options: { color: DARK } },
      { text: 'U', options: { color: ACCENT } },
      { text: 'DITE', options: { color: DARK } },
    ],
    { x: 0.8, y: 2.2, w: 11.5, h: 1.4, fontSize: 72, bold: true, fontFace: FONT },
  );
  s.addText('Академическая ERP-система для школ', { x: 0.85, y: 3.5, w: 11.5, h: 0.6, fontSize: 26, color: GREY, fontFace: FONT });
  s.addText('Обзор системы для эксперта-педагога', { x: 0.85, y: 4.25, w: 11.5, h: 0.5, fontSize: 20, bold: true, color: ACCENT, fontFace: FONT });
  s.addText([
    { text: 'Демо-доступ: ', options: { color: DARK } },
    { text: URL, options: { color: ACCENT, hyperlink: { url: URL } } },
    { text: '    ·    пароль: erudit2025', options: { color: GREY } },
  ], { x: 0.85, y: 5.4, w: 11.5, h: 0.5, fontSize: 16, fontFace: FONT });
  s.addText('Версия 0.1.0 · май 2026', { x: 0.85, y: 6.6, w: 11.5, h: 0.4, fontSize: 13, color: GREY, fontFace: FONT });
}

/* 2. О системе */
{
  const s = contentSlide('Что такое ERUDIT');
  s.addText('Единая цифровая среда управления школой', { x: 0.6, y: 1.35, w: 12, h: 0.5, fontSize: 20, bold: true, color: ACCENT, fontFace: FONT });
  s.addText(bullets([
    'Электронный журнал, расписание, оценивание, отчётность, коммуникация и аналитика — в одном месте и связаны между собой.',
    'Все участники процесса в одном пространстве: администрация, педагоги, специалисты, ученики и родители.',
    'Каждый видит только то, что нужно для его работы — лишнее скрыто, чувствительные данные разграничены.',
    'Работает в браузере на компьютере и телефоне — устанавливать ничего не нужно.',
  ]), { x: 0.6, y: 2.0, w: 12.1, h: 4.5 });
}

/* 3. Задача */
{
  const s = contentSlide('Какую задачу решает');
  s.addText(bullets([
    'Заменить бумажные журналы и разрозненные таблицы единой системой.',
    'Сделать оценивание прозрачным и защищённым от ошибок — через модерацию.',
    'Дать руководству аналитику по школе в реальном времени.',
    'Дать родителям понятную и честную картину успеваемости ребёнка.',
    'Сохранять историю: кто, когда и что изменил.',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 4.8 });
}

/* 4. Роли */
{
  const s = contentSlide('9 ролей — каждому своё');
  const rows = [
    ['Директор', 'полный доступ ко всему'],
    ['Аналитик', 'аналитика, финальное утверждение оценок'],
    ['Завуч', 'модерация оценок, нагрузка, дескрипторы'],
    ['Секретарь', 'ученики, персонал, документы'],
    ['Учитель', 'журнал, оценки, домашние задания, расписание'],
    ['Куратор', 'всё, что учитель + происшествия класса'],
    ['Специалист', 'логопед / психолог / медкабинет'],
    ['Ученик', 'свой дневник, оценки, ДЗ, расписание'],
    ['Родитель', 'успеваемость и посещаемость ребёнка'],
  ];
  s.addTable(
    rows.map((r, i) => [
      { text: r[0], options: { bold: true, color: DARK, fontSize: 14, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
      { text: r[1], options: { color: GREY, fontSize: 14, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    ]),
    { x: 0.6, y: 1.4, w: 12.1, colW: [3.0, 9.1], rowH: 0.52, border: { type: 'solid', color: 'E6E6E6', pt: 1 }, fontFace: FONT },
  );
}

/* 5. Модули */
{
  const s = contentSlide('Что внутри');
  const mods = [
    'Электронный журнал', 'Оценивание + модерация', 'Домашние задания',
    'Расписание и звонки', 'Нагрузка педагогов', 'Передача нагрузки',
    'Посещаемость', 'Отчёты и экспорт', 'Аналитика по школе',
    'Портфолио и достижения', 'Олимпиады и проекты', 'Мероприятия, студии, выезды',
    'Происшествия', 'Срочные вопросы', 'Чаты',
    'Кабинеты специалистов', 'Дескрипторы педагогов', 'Документы и персонал',
  ];
  const cols = 3, cw = 3.95, ch = 0.72, gx = 0.18, gy = 0.16, x0 = 0.6, y0 = 1.45;
  mods.forEach((m, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    s.addShape(pptx.ShapeType.roundRect, {
      x: x0 + c * (cw + gx), y: y0 + r * (ch + gy), w: cw, h: ch,
      fill: { color: LIGHT }, line: { color: ACCENT, width: 0.75 }, rectRadius: 0.06,
    });
    s.addText(m, { x: x0 + c * (cw + gx), y: y0 + r * (ch + gy), w: cw, h: ch, fontSize: 13, bold: true, color: DARK, align: 'center', valign: 'middle', fontFace: FONT });
  });
}

/* 6. Журнал */
{
  const s = contentSlide('Электронный журнал и оценивание');
  s.addText(bullets([
    'Журнал по классам и предметам.',
    'Категории оценок: контрольная, зачёт, триместровая, итоговая, экзамен.',
    'Комментарии к оценкам и средневзвешенный балл.',
    'Разные шкалы оценивания.',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 4.5 });
}

/* 7. Модерация — диаграмма */
{
  const s = contentSlide('Двухуровневая модерация оценок');
  s.addText('Важные оценки попадают в дневник только после двойной проверки:', { x: 0.6, y: 1.3, w: 12, h: 0.5, fontSize: 18, color: DARK, fontFace: FONT });
  const steps = [
    ['Учитель', 'выставляет'],
    ['Завуч', 'утверждает'],
    ['Аналитик', 'публикует'],
    ['Опубликовано', 'видят семья'],
  ];
  const bw = 2.7, bh = 1.3, gap = 0.55, x0 = 0.7, y0 = 2.4;
  steps.forEach((st, i) => {
    const x = x0 + i * (bw + gap);
    const last = i === steps.length - 1;
    s.addShape(pptx.ShapeType.roundRect, { x, y: y0, w: bw, h: bh, fill: { color: last ? ACCENT : LIGHT }, line: { color: ACCENT, width: 1.25 }, rectRadius: 0.08 });
    s.addText([
      { text: st[0] + '\n', options: { bold: true, fontSize: 16, color: last ? 'FFFFFF' : DARK } },
      { text: st[1], options: { fontSize: 12, color: last ? 'FFFFFF' : GREY } },
    ], { x, y: y0, w: bw, h: bh, align: 'center', valign: 'middle', fontFace: FONT });
    if (!last) s.addText('→', { x: x + bw, y: y0, w: gap, h: bh, align: 'center', valign: 'middle', fontSize: 26, bold: true, color: ACCENT, fontFace: FONT });
  });
  s.addText('Каждое изменение фиксируется в журнале аудита (кто / когда / что). Это защищает и учителя, и ученика.', { x: 0.6, y: 4.4, w: 12.1, h: 0.8, fontSize: 16, italic: true, color: GREY, fontFace: FONT });
}

/* 8. Передача нагрузки */
{
  const s = contentSlide('Передача нагрузки (декрет, болезнь, замена)');
  s.addText(bullets([
    'Нагрузку уходящего педагога можно передать другому одной операцией.',
    'Указывается причина: декрет, болезнь, увольнение, замена.',
    'Прошлые оценки и расписание остаются за прежним учителем.',
    'Новый педагог видит их в режиме «только чтение» — история не теряется.',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 4.5 });
}

/* 9. Дескрипторы */
{
  const s = contentSlide('Дескрипторы педагога: уровни доступа');
  s.addText(bullets([
    'Уровень 1 (общий) — администрация и сам педагог.',
    'Уровень 2 — только администрация (директор, аналитик, завуч).',
    'Уровень 3 — только директор и аналитик.',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 2.6 });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 4.4, w: 12.1, h: 1.3, fill: { color: LIGHT }, line: { color: ACCENT, width: 1 }, rectRadius: 0.06 });
  s.addText('Сам педагог не видит закрытые характеристики о себе — это сделано осознанно и проверяется автоматическими тестами.', { x: 0.9, y: 4.4, w: 11.5, h: 1.3, fontSize: 17, bold: true, color: DARK, valign: 'middle', fontFace: FONT });
}

/* 10. Конфиденциальность */
{
  const s = contentSlide('Конфиденциальность данных');
  s.addText(bullets([
    'Ученик и родитель видят только свой класс и только опубликованные оценки.',
    'Доступ к разделам разграничен по роли — лишнее не показывается.',
    'Внутренние сведения о педагогах закрыты по уровню доступа.',
    'Корректность разграничения подтверждена автоматическими тестами.',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 4.5 });
}

/* 11. Аналитика */
{
  const s = contentSlide('Аналитика и отчёты');
  s.addText(bullets([
    'Сводные показатели по школе для руководства.',
    'Динамика успеваемости и посещаемости.',
    'Отчёты по классам и предметам, экспорт данных.',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 4.5 });
}

/* 11b. Сравнение с Zero */
{
  const s = contentSlide('Чем ERUDIT отличается от Zero Education (KZ)');
  s.addText('Zero — про бизнес частного центра (CRM, финансы, договоры). ERUDIT — про качество учебного процесса.', { x: 0.6, y: 1.2, w: 12.1, h: 0.5, fontSize: 15, italic: true, color: GREY, fontFace: FONT });
  const head = [
    { text: 'Что важно для школы', options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, fontSize: 14, valign: 'middle' } },
    { text: 'ERUDIT', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 14, align: 'center', valign: 'middle' } },
    { text: 'Zero Education', options: { bold: true, color: 'FFFFFF', fill: { color: '888888' }, fontSize: 14, align: 'center', valign: 'middle' } },
  ];
  const data = [
    ['Модерация оценок + журнал аудита', '✓', '— сразу'],
    ['Разграничение доступа (9 ролей)', '✓', 'базово'],
    ['Приватность: свой класс / опубликованное', '✓', 'журнал'],
    ['Дескрипторы педагога (уровни доступа)', '✓', '—'],
    ['Передача нагрузки (декрет/болезнь)', '✓', '—'],
    ['Кабинеты специалистов', '✓', 'кружки'],
    ['CRM / финансы / договоры / биллинг', 'на будущее', '✓'],
  ];
  const rows = [head, ...data.map((r, i) => [
    { text: r[0], options: { color: DARK, fontSize: 13, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    { text: r[1], options: { bold: true, color: r[1].includes('✓') ? '1E9E5A' : GREY, fontSize: 13, align: 'center', fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    { text: r[2], options: { color: GREY, fontSize: 13, align: 'center', fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
  ])];
  s.addTable(rows, { x: 0.6, y: 1.85, w: 12.1, colW: [6.5, 2.8, 2.8], rowH: 0.52, border: { type: 'solid', color: 'E0E0E0', pt: 1 }, fontFace: FONT });
}

/* 12. Демо-доступ */
{
  const s = contentSlide('Как посмотреть');
  s.addText([
    { text: 'Откройте  ', options: { color: DARK } },
    { text: URL, options: { color: ACCENT, bold: true, hyperlink: { url: URL } } },
  ], { x: 0.6, y: 1.35, w: 12, h: 0.5, fontSize: 20, fontFace: FONT });
  s.addText('Единый пароль ко всем демо-аккаунтам: erudit2025', { x: 0.6, y: 1.95, w: 12, h: 0.45, fontSize: 16, bold: true, color: ACCENT, fontFace: FONT });
  const rows = [
    ['azhibaeva', 'Учитель — журнал, оценки, ДЗ'],
    ['kozlova', 'Завуч — модерация, нагрузка'],
    ['student1', 'Ученик — свой дневник'],
    ['parent1', 'Родитель — успеваемость ребёнка'],
    ['admin', 'Директор — полный доступ'],
  ];
  s.addTable(
    rows.map((r, i) => [
      { text: r[0], options: { bold: true, color: DARK, fontSize: 15, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
      { text: r[1], options: { color: GREY, fontSize: 15, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    ]),
    { x: 0.6, y: 2.6, w: 12.1, colW: [3.2, 8.9], rowH: 0.6, border: { type: 'solid', color: 'E6E6E6', pt: 1 }, fontFace: FONT },
  );
  s.addText('Рекомендуем начать с «Учитель», затем «Завуч».', { x: 0.6, y: 6.1, w: 12, h: 0.4, fontSize: 14, italic: true, color: GREY, fontFace: FONT });
}

/* 12b. Учителя */
{
  const s = contentSlide('Аккаунты учителей');
  s.addText('Логин — из таблицы. Пароль у всех: erudit2025', { x: 0.6, y: 1.2, w: 12.1, h: 0.45, fontSize: 16, bold: true, color: ACCENT, fontFace: FONT });
  const left = [
    ['azhibaeva', 'Кыргызский язык'], ['asanova', 'История'], ['bakashova', 'Химия'],
    ['egorova', 'Английский язык'], ['imashev', 'Информатика'], ['kalykov', 'География'],
    ['kovaleva', 'Начальные классы'], ['pulatova', 'Математика'],
  ];
  const right = [
    ['sagyntai', 'Математика'], ['satarkulov', 'Физика'], ['sidorova', 'Начальные классы'],
    ['toktobekova', 'Начальные классы'], ['fedorova', 'Начальные классы'],
    ['fominykh', 'Биология'], ['khaydarova', 'Русский язык'],
  ];
  const head = () => [
    { text: 'Логин', options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, fontSize: 13, valign: 'middle' } },
    { text: 'Предмет', options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, fontSize: 13, valign: 'middle' } },
  ];
  const mk = (arr) => [head(), ...arr.map((r, i) => [
    { text: r[0], options: { bold: true, color: ACCENT, fontSize: 13, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    { text: r[1], options: { color: DARK, fontSize: 13, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
  ])];
  s.addTable(mk(left), { x: 0.6, y: 1.8, w: 6.0, colW: [2.3, 3.7], rowH: 0.5, border: { type: 'solid', color: 'E0E0E0', pt: 1 }, fontFace: FONT });
  s.addTable(mk(right), { x: 6.95, y: 1.8, w: 6.0, colW: [2.3, 3.7], rowH: 0.5, border: { type: 'solid', color: 'E0E0E0', pt: 1 }, fontFace: FONT });
}

/* 13. Сценарии */
{
  const s = contentSlide('3 сценария для теста');
  s.addText([
    { text: '1. Жизненный цикл оценки\n', options: { bold: true, fontSize: 17, color: ACCENT } },
    { text: 'Учитель выставляет → Завуч утверждает → Аналитик публикует → Родитель видит.\n\n', options: { fontSize: 15, color: DARK } },
    { text: '2. Передача нагрузки\n', options: { bold: true, fontSize: 17, color: ACCENT } },
    { text: 'Завуч → Педагоги → Нагрузка: передать нагрузку другому учителю с причиной.\n\n', options: { fontSize: 15, color: DARK } },
    { text: '3. Уровни доступа к дескрипторам\n', options: { bold: true, fontSize: 17, color: ACCENT } },
    { text: 'Завуч видит характеристики уровня 1 и 2; сам педагог закрытые о себе — нет.', options: { fontSize: 15, color: DARK } },
  ], { x: 0.6, y: 1.5, w: 12.1, h: 5, fontFace: FONT, lineSpacingMultiple: 1.1 });
}

/* 14. Вопросы */
{
  const s = contentSlide('Вопросы к Вам как к эксперту');
  s.addText(bullets([
    'Насколько сценарии соответствуют реальной работе школы?',
    'Понятны ли термины? Что назвать привычнее для учителей?',
    'Удобно ли вести журнал и выставлять оценки? Чего не хватает?',
    'Какие разделы лишние, а каких функций недостаёт?',
    'Что важно для родителей и учеников, чего сейчас нет?',
    'Что повысит реальную пользу системы для школы в Бишкеке?',
  ]), { x: 0.6, y: 1.5, w: 12.1, h: 4.8 });
}

/* 15. Спасибо */
{
  const s = pptx.addSlide();
  s.background = { color: ACCENT };
  s.addText('Спасибо!', { x: 0.8, y: 2.6, w: 11.7, h: 1.2, fontSize: 54, bold: true, color: 'FFFFFF', fontFace: FONT });
  s.addText('Ваш экспертный взгляд напрямую повлияет на развитие ERUDIT.', { x: 0.85, y: 3.9, w: 11.5, h: 0.6, fontSize: 20, color: 'FFFFFF', fontFace: FONT });
  s.addText([
    { text: URL, options: { color: 'FFFFFF', bold: true, hyperlink: { url: URL } } },
    { text: '   ·   пароль: erudit2025', options: { color: 'FFFFFF' } },
  ], { x: 0.85, y: 5.0, w: 11.5, h: 0.5, fontSize: 16, fontFace: FONT });
}

await pptx.writeFile({ fileName: '../ERUDIT_презентация.pptx' });
console.log('PPTX written: ../ERUDIT_презентация.pptx');
