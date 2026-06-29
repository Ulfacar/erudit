import { amountInWords } from './amount-in-words';

export interface PrintableContract {
  number: string;
  year?: string | null;
  baseAmount: number;
  discountPct: number;
  discountNote?: string | null;
  amount: number;
  prepaymentPct: number;
  scheduleType: string;
  scheduleMonths: number;
  paymentDay: number;
  startDate?: string | null;
  representative?: { fio?: string; inn?: string; phone?: string; passport?: string; issuedBy?: string; address?: string } | null;
  requisites?: { name?: string; inn?: string; account?: string; address?: string } | null;
}

export interface Installment { date?: string | null; amount: number; note?: string | null }

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const som = (n: number) => `${n.toLocaleString('ru-RU')}`;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** Дата словами: «5» марта 2026 года. */
function dateWords(v?: string | null): string {
  if (!v) return '«__» ____________ 20__ года';
  const d = new Date(v);
  return `«${d.getDate()}» ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} года`;
}

/** Период обучения из учебного года «2026-2027» → «1» сентября 2026 года по «25» мая 2027 года. */
function academicPeriod(year?: string | null): string {
  const m = String(year ?? '').match(/(\d{4})\D+(\d{4})/);
  if (!m) return '«1» сентября 20__ года по «25» мая 20__ года';
  return `«1» сентября ${m[1]} года по «25» мая ${m[2]} года`;
}

/** Печатная форма договора об обучении (шаблон Intellect Pro School).
 *  Жёлтым подсвечены изменяемые поля. opts.highlight=false — чистовик без подсветки. */
export function printContract(
  c: PrintableContract,
  studentName: string,
  className?: string,
  opts?: { highlight?: boolean; installments?: Installment[] },
) {
  const highlight = opts?.highlight !== false;
  const r = c.requisites ?? {};
  const rep = c.representative ?? {};
  const v = (s: string | number) => `<span class="v">${esc(String(s))}</span>`;

  // График оплаты: реальные счета или генерация из предоплаты + помесячных платежей
  const rows: Installment[] = opts?.installments ? [...opts.installments] : [];
  if (rows.length === 0) {
    const prepay = Math.round((c.amount * c.prepaymentPct) / 100);
    const base0 = c.startDate ? new Date(c.startDate) : new Date();
    if (prepay > 0) rows.push({ date: c.startDate ?? null, amount: prepay, note: 'Первоначальный взнос' });
    const rest = c.amount - prepay;
    const per = c.scheduleMonths > 0 ? Math.round(rest / c.scheduleMonths) : rest;
    for (let i = 0; i < c.scheduleMonths; i++) {
      const due = new Date(base0);
      due.setMonth(due.getMonth() + i);
      due.setDate(c.paymentDay);
      rows.push({ date: due.toISOString(), amount: per });
    }
  }
  const schedRows = rows.map((row, i) => `<tr>
      <td>${i + 1}</td>
      <td>${v(row.date ? dateWords(row.date).replace(/^«|» года$/g, '').replace('» ', ' ') : '—')}</td>
      <td style="text-align:right">${v(som(row.amount))}</td>
      <td>${row.note ? esc(row.note) : ''}</td>
    </tr>`).join('');

  const schoolName = r.name ?? 'Общественный фонд «Интеллект Про Скул»';
  const schoolAddr = r.address ?? 'Кыргызская Республика, г. Бишкек, ул. Джунусалиева 177/1';
  const sumLine = `${v(som(c.amount))} (${v(amountInWords(c.amount).replace(/ сомов?$| сом$/, ''))}) сом за один учебный год`;

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Договор № ${esc(c.number)}</title>
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

<h1>ДОГОВОР № ${v(c.number)}</h1>
<div class="center">Об оказании платных образовательных услуг</div>
<div class="row"><span>г. Бишкек</span><span>${v(c.startDate ? dateWords(c.startDate) : '«__» ____________ 20__ года')}</span></div>

<p>${esc(schoolName)}, именуемый в дальнейшем «Школа», в лице директора Матанова Жакшылыка Жетимишбековича, действующего на основании Устава, с одной стороны, ${v(rep.fio ?? '—')}, именуемый(-ая) в дальнейшем «Законный представитель», являющийся законным представителем ${v(studentName)}, именуемого(ой) в дальнейшем «Учащийся», с другой стороны, совместно именуемые «Стороны», в интересах Учащегося, в соответствии с Законом Кыргызской Республики «Об образовании», заключили настоящий Договор о нижеследующем:</p>

<h2>Предмет договора</h2>
<p>Настоящий Договор определяет и регулирует отношения между Школой и Законным представителем по вопросу предоставления Школой образовательных услуг в период обучения Учащегося в Школе.</p>
<p>Образовательные услуги предоставляются Школой в рамках государственного образовательного стандарта в соответствии с образовательными программами и учебными планами на период ${v(academicPeriod(c.year))} в ${v(className ?? '__')} кл.</p>
<p>Образовательные услуги предоставляются Школой на основании лицензии Министерства образования и науки Кыргызской Республики, регистрационный номер №В2022-0014 от 16.06.2022 года, серийный номер LS220000750.</p>

<h2>Права и обязанности сторон</h2>
<p><b>Школа обязуется:</b></p>
<ol>
  <li>Обеспечить качество образовательных услуг на уровне не ниже государственного образовательного стандарта Кыргызской Республики;</li>
  <li>Ознакомить Законного представителя с режимом работы и локальными актами Школы;</li>
  <li>Создавать благоприятные условия для интеллектуального, нравственного, эмоционального и физического развития личности Учащегося;</li>
  <li>Нести ответственность за жизнь и здоровье Учащегося во время образовательного процесса;</li>
  <li>Предоставлять учебники и учебную литературу, оборудованные кабинеты, компьютерный класс и библиотеку;</li>
  <li>Осуществлять четвертную и годовую аттестацию Учащегося;</li>
  <li>Обеспечить перевод Учащегося в следующий класс по решению педагогического совета Школы;</li>
  <li>Обеспечивать бесплатное медицинское обслуживание и здоровое питание (второй завтрак, обед, полдник);</li>
  <li>При расторжении Договора по инициативе Законного представителя возвратить оставшуюся сумму в конце учебного года, за исключением суммы задатка;</li>
  <li>Предоставлять информацию о состоянии учёбы и поведения Учащегося по результатам каждой четверти.</li>
</ol>
<p><b>Школа имеет право:</b></p>
<ol>
  <li>Самостоятельно определять программу развития, содержание, формы и методы образовательной работы;</li>
  <li>Устанавливать режим работы, расписание занятий, порядок и сроки промежуточной аттестации;</li>
  <li>Самостоятельно устанавливать и изменять размер оплаты за обучение согласно годовой смете расходов;</li>
  <li>Аннулировать предоставленные скидки при систематическом/грубом нарушении Правил Школы, низкой успеваемости или несвоевременной оплате;</li>
  <li>Ограничить доступ Учащегося к библиотеке, столовой, кружкам при несвоевременной/неполной оплате по Графику (п. 3.1);</li>
  <li>Не допускать Учащегося на занятия со следующей четверти при неоплате по Графику после двух предупреждений;</li>
  <li>Отправлять SMS-уведомления и производить обзвон по указанному номеру при наступлении сроков оплаты/задолженности;</li>
  <li>Не выдавать личное дело Учащегося до полного погашения задолженности;</li>
  <li>Отчислить Учащегося при грубом/систематическом нарушении, систематической неуспеваемости, противозаконных действиях, неоплате свыше 50% суммы, либо по докладным не менее 5 учителей;</li>
  <li>Требовать компенсацию стоимости причинённого Учащимся ущерба имуществу Школы;</li>
  <li>Не продлевать договор на новый учебный год при систематическом нарушении его условий;</li>
  <li>Ограничивать использование гаджетов и проводить выборочную проверку личных вещей в целях безопасности.</li>
</ol>
<p><b>Законный представитель имеет право:</b> знакомиться с содержанием образования и методами обучения (с предупреждением администрации за 1 день); защищать права и интересы Учащегося; получать информацию о медицинских обследованиях; знакомиться с лицензией и учебной документацией; досрочно расторгнуть Договор в установленном порядке.</p>
<p><b>Законный представитель обязуется:</b></p>
<ol>
  <li>Ознакомиться с Уставом Школы и настоящим Договором, соблюдать локальные нормативные акты;</li>
  <li>Ежегодно с 1 марта по 1 апреля заключать договор на следующий учебный год с внесением задатка в размере 50% от стоимости обучения;</li>
  <li>Своевременно вносить оплату согласно Графику; при просрочке Школа вправе взимать неустойку 0,1% за каждый календарный день после 3 календарных дней льготного периода, но не более 20% от суммы просроченного платежа;</li>
  <li>Провести медицинскую диспансеризацию Учащегося и предоставить заключение до прибытия в Школу;</li>
  <li>Обеспечить посещение и ношение школьной формы, участвовать в мероприятиях по успеваемости и поведению;</li>
  <li>Нести материальную ответственность за ущерб имуществу Школы и возместить его в течение 10 календарных дней;</li>
  <li>Обеспечить сохранность учебников, при порче/утере возместить полную стоимость;</li>
  <li>Своевременно забирать Учащегося после занятий, при изменении адреса/телефона уведомлять Администрацию.</li>
</ol>

<h2>Стоимость и порядок оплаты услуг</h2>
<p>3.1. Общий контракт за обучение составляет ${sumLine}.</p>
<p>3.2. В качестве обеспечения исполнения обязательств Законный представитель вносит задаток в размере 50% от стоимости обучения в течение 3 календарных дней с момента подписания Договора. При досрочном расторжении задаток 10% возврату не подлежит.</p>
<p>Оплата производится ежемесячно до ${v(c.paymentDay)}-го числа каждого месяца согласно Графику оплаты (Приложение №1), последняя оплата — до 10-го мая текущего года либо в иные сроки по согласованию.</p>
<p>Оплата производится в сомах наличными в кассу Школы либо безналичными платежами через ОАО «Оптима Банк». При несвоевременной оплате доступ к электронному журналу «EduPage» закрывается до полного погашения задолженности.</p>

<h2>Срок действия и порядок расторжения</h2>
<p>Договор вступает в силу с момента подписания обеими сторонами. Срок действия — один учебный год; при неисполнении финансовых обязательств действует до полного их исполнения. Изменения оформляются Дополнительным соглашением.</p>

<h2>Подписи и реквизиты сторон</h2>
<table class="sign"><tr>
  <td style="width:50%">
    <b>Школа:</b><br>Наименование: ${esc(schoolName)}<br>
    Юридический адрес: ${esc(schoolAddr)}<br>
    Банковский счёт: ОАО «Оптима Банк» №1091408846130168, БИК 109014<br>
    Тел: 0705889889 · Сайт: intellect.edu.kg<br><br>
    Директор: Матанов Жакшылык Жетимишбекович<br><br>
    Подпись: ____________  М.П.
  </td>
  <td style="width:50%">
    <b>Родитель (Законный представитель):</b><br>
    ФИО: ${v(rep.fio ?? '—')}<br>
    Паспорт: ${v(rep.passport ?? '—')}<br>
    ИНН: ${v(rep.inn ?? '—')}<br>
    Выдан: ${v(rep.issuedBy ?? '—')}<br>
    Адрес: ${v(rep.address ?? '—')}<br>
    Тел: ${v(rep.phone ?? '—')}<br><br><br>
    Подпись: ____________
  </td>
</tr></table>

<h2>График оплаты (Приложение №1)</h2>
<table>
  <thead><tr><th style="width:36px">№</th><th>Дата</th><th style="text-align:right">Сумма, сом</th><th>Примечание</th></tr></thead>
  <tbody>${schedRows}</tbody>
</table>

</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
