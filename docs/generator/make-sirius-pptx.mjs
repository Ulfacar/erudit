import pptxgen from 'pptxgenjs';

const ACCENT = 'E91E8C';
const DARK = '1A1B1E';
const GREY = '5A5A5A';
const LIGHT = 'F7E9F1';
const GREEN = '1E9E5A';
const URL = 'https://erudit-school.vercel.app';
const PWD = 'erudit2025';
const FONT = 'Calibri';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5"
pptx.author = 'Bilim OS';
pptx.title = 'Bilim OS — концепция продукта';

const W = 13.33;

function contentSlide(title) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.0, fill: { color: ACCENT } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.0, w: W, h: 0.06, fill: { color: DARK } });
  s.addText(title, { x: 0.6, y: 0.1, w: W - 1.2, h: 0.8, fontSize: 26, bold: true, color: 'FFFFFF', fontFace: FONT, valign: 'middle' });
  s.addText('Bilim OS', { x: W - 2.0, y: 6.95, w: 1.6, h: 0.4, fontSize: 11, color: GREY, align: 'right', fontFace: FONT });
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
      { text: 'BILIM ', options: { color: DARK } },
      { text: 'OS', options: { color: ACCENT } },
    ],
    { x: 0.8, y: 2.2, w: 11.5, h: 1.4, fontSize: 72, bold: true, fontFace: FONT },
  );
  s.addText('Академическая ERP-система для школ', { x: 0.85, y: 3.5, w: 11.5, h: 0.6, fontSize: 26, color: GREY, fontFace: FONT });
  s.addText('Концепция продукта', { x: 0.85, y: 4.25, w: 11.5, h: 0.5, fontSize: 20, bold: true, color: ACCENT, fontFace: FONT });
  s.addText([
    { text: 'Демо-доступ: ', options: { color: DARK } },
    { text: URL, options: { color: ACCENT, hyperlink: { url: URL } } },
    { text: `    ·    пароль: ${PWD}`, options: { color: GREY } },
  ], { x: 0.85, y: 5.4, w: 11.5, h: 0.5, fontSize: 16, fontFace: FONT });
  s.addText('Ранний доступ · 2026', { x: 0.85, y: 6.6, w: 11.5, h: 0.4, fontSize: 13, color: GREY, fontFace: FONT });
}

/* 2. Что такое Bilim OS */
{
  const s = contentSlide('Что такое Bilim OS');
  s.addText('Единая цифровая среда управления школой', { x: 0.6, y: 1.35, w: 12, h: 0.5, fontSize: 20, bold: true, color: ACCENT, fontFace: FONT });
  s.addText(bullets([
    'Журнал, расписание, оценивание, посещаемость, отчётность, коммуникация и аналитика — в одном месте и связаны между собой.',
    'Все участники процесса в одном пространстве: администрация, педагоги, специалисты, ученики и родители.',
    'Каждый видит только то, что нужно для его работы — лишнее скрыто, чувствительные данные разграничены.',
    'Работает в браузере на компьютере и телефоне — устанавливать ничего не нужно.',
  ]), { x: 0.6, y: 2.0, w: 12.1, h: 4.5 });
}

/* 3. Задача */
{
  const s = contentSlide('Какую задачу решаем');
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
    ['Аналитик', 'аналитика, финальная публикация оценок'],
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

/* 5. Что уже работает */
{
  const s = contentSlide('Что уже работает сегодня');
  const mods = [
    'Электронный журнал', 'Оценивание + модерация', 'Журнал аудита',
    'Домашние задания', 'Расписание и звонки', 'Замены уроков',
    'Нагрузка педагогов', 'Передача нагрузки', 'Посещаемость',
    'Дневник', 'Отчёты и экспорт', 'Аналитика по школе',
    'Кабинеты специалистов', 'Дескрипторы педагогов', 'Происшествия',
    'Срочные вопросы', 'Новости', 'Чаты',
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

/* 6. Модерация — диаграмма */
{
  const s = contentSlide('Двухуровневая модерация оценок');
  s.addText('Важные оценки попадают в дневник только после двойной проверки:', { x: 0.6, y: 1.3, w: 12, h: 0.5, fontSize: 18, color: DARK, fontFace: FONT });
  const steps = [
    ['Учитель', 'выставляет'],
    ['Завуч', 'утверждает'],
    ['Аналитик', 'публикует'],
    ['Опубликовано', 'видит семья'],
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

/* 7. Особенности */
{
  const s = contentSlide('Чем Bilim OS выделяется');
  s.addText([
    { text: 'Передача нагрузки\n', options: { bold: true, fontSize: 17, color: ACCENT } },
    { text: 'Нагрузку уходящего педагога (декрет, болезнь) передают другому одной операцией. Прошлые оценки остаются за прежним учителем в режиме «только чтение».\n\n', options: { fontSize: 15, color: DARK } },
    { text: 'Дескрипторы педагога с уровнями доступа\n', options: { bold: true, fontSize: 17, color: ACCENT } },
    { text: 'Три уровня конфиденциальности. Сам педагог не видит закрытые характеристики о себе — это сделано осознанно.\n\n', options: { fontSize: 15, color: DARK } },
    { text: 'Конфиденциальность данных\n', options: { bold: true, fontSize: 17, color: ACCENT } },
    { text: 'Ученик и родитель видят только свой класс и только опубликованные оценки. Проверено автоматическими тестами — это уже работает, не обещание.', options: { fontSize: 15, color: DARK } },
  ], { x: 0.6, y: 1.5, w: 12.1, h: 5, fontFace: FONT, lineSpacingMultiple: 1.1 });
}

/* 8. Дорожная карта */
{
  const s = contentSlide('На дорожной карте');
  s.addText('В разработке. Ранний партнёр получает по мере выхода — без доплат:', { x: 0.6, y: 1.3, w: 12, h: 0.5, fontSize: 18, color: DARK, fontFace: FONT });
  s.addText(bullets([
    'Портфолио, достижения, олимпиады и проекты.',
    'КТП и календарь учебного года.',
    'Библиотека, мероприятия, студии, выезды.',
    'Бухгалтерия, питание, АХЧ.',
    'Интеграция с Кундолюком (не обещаем как готовую).',
    'Мобильное приложение и ИИ-помощники по ролям.',
  ]), { x: 0.6, y: 2.0, w: 12.1, h: 4.5 });
}

/* 9. Позиционирование vs Zero */
{
  const s = contentSlide('Чем Bilim OS отличается от Zero (KZ)');
  s.addText('Zero — про бизнес частного центра (CRM, финансы, договоры). Bilim OS — про качество учебного процесса.', { x: 0.6, y: 1.2, w: 12.1, h: 0.5, fontSize: 15, italic: true, color: GREY, fontFace: FONT });
  const head = [
    { text: 'Что важно для школы', options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, fontSize: 14, valign: 'middle' } },
    { text: 'Bilim OS', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 14, align: 'center', valign: 'middle' } },
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
    { text: r[1], options: { bold: true, color: r[1].includes('✓') ? GREEN : GREY, fontSize: 13, align: 'center', fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    { text: r[2], options: { color: GREY, fontSize: 13, align: 'center', fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
  ])];
  s.addTable(rows, { x: 0.6, y: 1.85, w: 12.1, colW: [6.5, 2.8, 2.8], rowH: 0.52, border: { type: 'solid', color: 'E0E0E0', pt: 1 }, fontFace: FONT });
}

/* 10. Стоимость */
{
  const s = contentSlide('Стоимость');
  s.addText([
    { text: 'Установка (разово): ', options: { color: DARK } },
    { text: '$1000', options: { bold: true, color: ACCENT } },
    { text: '      Подписка: ', options: { color: DARK } },
    { text: '30 000 сом / месяц', options: { bold: true, color: ACCENT } },
  ], { x: 0.6, y: 1.3, w: 12.1, h: 0.5, fontSize: 20, fontFace: FONT });
  s.addText('Разбивка подписки по модулям (платится единым пакетом):', { x: 0.6, y: 1.95, w: 12, h: 0.4, fontSize: 14, italic: true, color: GREY, fontFace: FONT });
  const rows = [
    ['Электронный журнал и оценивание', '6 000'],
    ['Модерация оценок + журнал аудита', '3 000'],
    ['Расписание, звонки, замены', '4 000'],
    ['Нагрузка и передача нагрузки', '3 000'],
    ['Дневник ученика и родителя', '3 000'],
    ['Посещаемость', '2 000'],
    ['Отчёты и экспорт', '2 500'],
    ['Аналитика для руководства', '3 500'],
    ['Кабинеты специалистов + дескрипторы', '2 000'],
    ['Коммуникации (новости, чаты, вопросы, происшествия)', '1 000'],
  ];
  const head = [
    { text: 'Модуль', options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, fontSize: 12, valign: 'middle' } },
    { text: 'сом/мес', options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, fontSize: 12, align: 'center', valign: 'middle' } },
  ];
  const body = rows.map((r, i) => [
    { text: r[0], options: { color: DARK, fontSize: 12, fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
    { text: r[1], options: { color: DARK, fontSize: 12, align: 'center', fill: { color: i % 2 ? LIGHT : 'FFFFFF' }, valign: 'middle' } },
  ]);
  const total = [
    { text: 'ИТОГО', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 13, valign: 'middle' } },
    { text: '30 000', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 13, align: 'center', valign: 'middle' } },
  ];
  s.addTable([head, ...body, total], { x: 0.6, y: 2.45, w: 9.0, colW: [7.4, 1.6], rowH: 0.36, border: { type: 'solid', color: 'E0E0E0', pt: 1 }, fontFace: FONT });
  s.addText('Ранний партнёр: новые модули с дорожной карты — без доплат по мере выхода.', { x: 9.9, y: 2.6, w: 2.8, h: 2.0, fontSize: 14, italic: true, color: GREY, fontFace: FONT, valign: 'top' });
}

/* 11. Демо-доступ */
{
  const s = contentSlide('Как посмотреть');
  s.addText([
    { text: 'Откройте  ', options: { color: DARK } },
    { text: URL, options: { color: ACCENT, bold: true, hyperlink: { url: URL } } },
  ], { x: 0.6, y: 1.35, w: 12, h: 0.5, fontSize: 20, fontFace: FONT });
  s.addText(`Единый пароль ко всем демо-аккаунтам: ${PWD}`, { x: 0.6, y: 1.95, w: 12, h: 0.45, fontSize: 16, bold: true, color: ACCENT, fontFace: FONT });
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
    { x: 0.6, y: 2.6, w: 12.1, colW: [3.2, 8.9], rowH: 0.52, border: { type: 'solid', color: 'E6E6E6', pt: 1 }, fontFace: FONT },
  );
  s.addText('Порядок показа: Учитель → Завуч → Родитель. Не открывайте разделы с меткой «Скоро» и карточку конкретного педагога.', { x: 0.6, y: 5.5, w: 12, h: 0.6, fontSize: 13, italic: true, color: GREY, fontFace: FONT });
}

/* 12. Спасибо */
{
  const s = pptx.addSlide();
  s.background = { color: ACCENT };
  s.addText('Bilim OS', { x: 0.8, y: 2.4, w: 11.7, h: 1.2, fontSize: 54, bold: true, color: 'FFFFFF', fontFace: FONT });
  s.addText('Рабочий инструмент сегодня — и честное партнёрство в развитии.', { x: 0.85, y: 3.7, w: 11.5, h: 0.6, fontSize: 20, color: 'FFFFFF', fontFace: FONT });
  s.addText([
    { text: URL, options: { color: 'FFFFFF', bold: true, hyperlink: { url: URL } } },
    { text: `   ·   пароль: ${PWD}`, options: { color: 'FFFFFF' } },
  ], { x: 0.85, y: 4.8, w: 11.5, h: 0.5, fontSize: 16, fontFace: FONT });
}

await pptx.writeFile({ fileName: '../Bilim_OS_презентация.pptx' });
console.log('PPTX written: ../Bilim_OS_презентация.pptx');
