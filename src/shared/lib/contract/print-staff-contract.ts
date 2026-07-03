import { amountInWords } from './amount-in-words';

export interface PrintableStaffContract {
  number: string;
  staffId: string;
  position: string;
  salary: number;
  startDate?: string | null;
  endDate?: string | null;
}

/* TODO(G7): реквизиты школы — уточнить у Эмира (пока скопированы из print-contract.ts) */
const SCHOOL = {
  name: 'Общественный фонд «Интеллект Про Скул»',
  director: 'Матанов Жакшылык Жетимишбекович',
  address: 'Кыргызская Республика, г. Бишкек, ул. Джунусалиева 177/1',
  bank: 'ОАО «Оптима Банк» №1091408846130168, БИК 109014',
  phone: '0705889889',
};

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const som = (n: number) => `${n.toLocaleString('ru-RU')}`;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** Дата словами: «5» марта 2026 года. */
function dateWords(v?: string | null): string {
  if (!v) return '«__» ____________ 20__ года';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '«__» ____________ 20__ года';
  return `«${d.getDate()}» ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} года`;
}

/** Печатная форма трудового договора (каркас G7).
 *  Жёлтым подсвечены изменяемые поля. opts.highlight=false — чистовик без подсветки. */
export function printStaffContract(c: PrintableStaffContract, opts?: { highlight?: boolean }) {
  const highlight = opts?.highlight !== false;
  const v = (s: string | number) => `<span class="v">${esc(String(s))}</span>`;
  const dash = '«____»';
  const staffName = c.staffId || dash;
  const salary = Number.isFinite(c.salary) ? c.salary : 0;
  const salaryWords = amountInWords(salary).replace(/ сомов?$| сом$/, '');
  const term = c.endDate ? `${dateWords(c.startDate)} по ${dateWords(c.endDate)}` : 'на неопределённый срок';

  /* TODO(G7): ЗАМЕНИТЬ ЦЕЛИКОМ на шаблон трудового договора от Эмира. Логику (шапка/подписи/печать) не трогать — только этот блок. */
  const SECTIONS_HTML = `
<h2>2. Предмет договора</h2>
<ol>
  <li>Работодатель принимает Работника на должность ${v(c.position || dash)}, а Работник обязуется лично выполнять трудовую функцию по указанной должности.</li>
  <li>Местом работы Работника является ${esc(SCHOOL.name)} по адресу: ${esc(SCHOOL.address)}.</li>
  <li>Работник подчиняется правилам внутреннего трудового распорядка, локальным актам Работодателя и распоряжениям руководителя.</li>
  <li>Работа по настоящему договору является основной, если стороны письменно не согласуют иное.</li>
</ol>

<h2>3. Срок договора</h2>
<ol>
  <li>Настоящий договор вступает в силу с даты его подписания сторонами.</li>
  <li>Срок действия договора: ${v(term)}.</li>
  <li>Дата начала работы Работника: ${v(dateWords(c.startDate))}.</li>
  <li>Испытательный срок устанавливается продолжительностью «__» месяцев либо не устанавливается по соглашению сторон.</li>
</ol>

<h2>4. Оплата труда</h2>
<ol>
  <li>Работнику устанавливается должностной оклад в размере ${v(som(salary))} (${v(salaryWords)}) сом в месяц.</li>
  <li>Заработная плата выплачивается в сроки и порядке, установленные законодательством Кыргызской Республики и локальными актами Работодателя.</li>
  <li>Надбавки, премии и иные выплаты производятся при наличии оснований и в порядке, утверждённом Работодателем.</li>
  <li>Удержания из заработной платы производятся только в случаях, предусмотренных законодательством Кыргызской Республики.</li>
</ol>

<h2>5. Права и обязанности Работника</h2>
<ol>
  <li>Работник обязан добросовестно выполнять трудовые обязанности, соблюдать трудовую дисциплину и требования охраны труда.</li>
  <li>Работник обязан бережно относиться к имуществу Работодателя и незамедлительно сообщать о ситуациях, угрожающих жизни, здоровью или имуществу.</li>
  <li>Работник имеет право на рабочее место, оплату труда, отдых, отпуск и иные гарантии согласно законодательству Кыргызской Республики.</li>
  <li>Работник имеет право получать информацию, необходимую для выполнения своих должностных обязанностей.</li>
</ol>

<h2>6. Права и обязанности Работодателя</h2>
<ol>
  <li>Работодатель обязан предоставить Работнику работу по обусловленной должности и обеспечить условия труда, соответствующие требованиям законодательства.</li>
  <li>Работодатель обязан своевременно выплачивать заработную плату и вести кадровый учёт Работника.</li>
  <li>Работодатель имеет право требовать исполнения трудовых обязанностей и соблюдения локальных актов.</li>
  <li>Работодатель имеет право применять меры поощрения и дисциплинарного взыскания в порядке, предусмотренном законодательством.</li>
</ol>

<h2>7. Прочие условия</h2>
<ol>
  <li>Режим рабочего времени и времени отдыха определяется правилами внутреннего трудового распорядка и графиком работы: «__».</li>
  <li>Ежегодный оплачиваемый отпуск предоставляется в порядке и продолжительности, установленных законодательством Кыргызской Республики: «__» календарных дней.</li>
  <li>Условия о материальной ответственности, конфиденциальности и обработке персональных данных применяются в пределах законодательства Кыргызской Республики.</li>
  <li>Изменение и расторжение настоящего договора осуществляется по соглашению сторон либо по основаниям, предусмотренным законодательством.</li>
  <li>Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из сторон.</li>
</ol>`;

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Трудовой договор № ${esc(c.number)}</title>
<style>
  body{font-family:'Times New Roman',serif;color:#000;margin:18mm;line-height:1.45;font-size:13px;text-align:justify}
  h1{font-size:15px;text-align:center;margin:4px 0}
  h2{font-size:13px;text-align:center;margin:16px 0 8px;text-transform:uppercase}
  .center{text-align:center}
  .row{display:flex;justify-content:space-between;margin:6px 0}
  ol{margin:4px 0 4px 18px;padding:0}
  ol li{margin:3px 0}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td,th{border:1px solid #000;padding:5px 7px;font-size:12px}
  th{background:#eee}
  .sign{display:flex;justify-content:space-between;margin-top:14px;font-size:12px}
  .sign td{border:none;padding:2px 0;vertical-align:top}
  .v{background:${highlight ? '#fff59d' : 'transparent'};padding:0 2px;font-weight:600}
  .toolbar{position:fixed;top:8px;right:8px}
  .toolbar button{font:13px sans-serif;margin-left:6px;padding:6px 10px;cursor:pointer}
  @media print{.toolbar{display:none}body{margin:16mm}}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">Печать / PDF</button>
  <button onclick="document.body.classList.toggle('clean');for(const e of document.querySelectorAll('.v'))e.style.background=document.body.classList.contains('clean')?'transparent':'#fff59d'">Подсветка вкл/выкл</button>
</div>

<h1>ТРУДОВОЙ ДОГОВОР № ${v(c.number)}</h1>
<div class="row"><span>г. Бишкек</span><span>${v(dateWords(c.startDate))}</span></div>

<p>${esc(SCHOOL.name)}, именуемый в дальнейшем «Работодатель», в лице директора ${esc(SCHOOL.director)}, действующего на основании Устава, с одной стороны, и ${v(staffName)}, именуемый(-ая) в дальнейшем «Работник», с другой стороны, совместно именуемые «Стороны», заключили настоящий трудовой договор о нижеследующем:</p>

${SECTIONS_HTML}

<h2>8. Подписи и реквизиты сторон</h2>
<table class="sign"><tr>
  <td style="width:50%">
    <b>Работодатель:</b><br>Наименование: ${esc(SCHOOL.name)}<br>
    Юридический адрес: ${esc(SCHOOL.address)}<br>
    Банковский счёт: ${esc(SCHOOL.bank)}<br>
    Тел: ${esc(SCHOOL.phone)} · Сайт: intellect.edu.kg<br><br>
    Директор: ${esc(SCHOOL.director)}<br><br>
    Подпись: ____________  М.П.
  </td>
  <td style="width:50%">
    <b>Работник:</b><br>
    ФИО: ${v(staffName)}<br>
    Паспорт: ${v(dash)}<br>
    ИНН: ${v(dash)}<br>
    Адрес: ${v(dash)}<br><br><br>
    Подпись: ____________
  </td>
</tr></table>

</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
