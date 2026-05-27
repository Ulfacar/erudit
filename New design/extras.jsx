/* global React, Icons, MOCK */

// Generic empty / stub
function StubPage({ icon, title, desc, role }) {
  const Ic = Icons[icon] || Icons.Inbox;
  return (
    <div className="content" style={{display:"grid", placeItems:"center"}}>
      <div style={{textAlign:"center", maxWidth:480, padding:60}}>
        <div style={{
          width:72, height:72, margin:"0 auto 20px",
          borderRadius:18,
          background:"var(--brand-50)", color:"var(--brand-700)",
          display:"grid", placeItems:"center",
        }}>
          <Ic size={32}/>
        </div>
        <div style={{fontSize:22, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>{title}</div>
        <div style={{fontSize:14, color:"var(--gray-500)", marginTop:8, lineHeight:1.55}}>{desc}</div>
        <button className="btn btn-primary" style={{marginTop:18}}>Открыть</button>
      </div>
    </div>
  );
}

// Homework page (teacher / student / parent)
function Homework({ role }) {
  const teacher = role === "teacher";

  return (
    <div className="content">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18}}>
        <div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>
            {teacher ? "Домашние задания" : "Мои задания"}
          </div>
          <div style={{fontSize:13.5, color:"var(--gray-500)", marginTop:4}}>
            {teacher ? "5 классов · 32 активных задания · 8 на проверке" : "5 невыполненных · 2 на проверке"}
          </div>
        </div>
        {teacher && <button className="btn btn-primary"><Icons.Plus size={16}/>Новое задание</button>}
      </div>

      <div className="row" style={{gap:4, padding:4, background:"var(--gray-100)", borderRadius:8, marginBottom:16, width:"fit-content"}}>
        {(teacher ? ["Все", "Активные (32)", "На проверке (8)", "Закрытые"] : ["Все (7)", "К сдаче (5)", "На проверке (2)", "Оценено"]).map((t, i) => (
          <button key={t} style={{
            padding:"7px 14px", border:"none",
            background: i === 0 ? "white" : "transparent",
            color: i === 0 ? "var(--gray-900)" : "var(--gray-500)",
            borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer",
            boxShadow: i === 0 ? "var(--shadow-xs)" : "none",
          }}>{t}</button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{paddingLeft:20}}>Предмет</th>
              <th>Задание</th>
              {teacher ? <th>Класс</th> : <th>Учитель</th>}
              <th>Срок</th>
              <th>Статус</th>
              <th style={{paddingRight:20, textAlign:"right"}}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {MOCK.HOMEWORK_PENDING.map((h, i) => {
              const statusMap = {
                "todo":   { l:"К выполнению", cls:"tag-gray" },
                "in-progress": { l:"В работе", cls:"tag-yellow" },
                "done":   { l:"Сдано", cls:"tag-green" },
              };
              const st = statusMap[h.status];
              return (
                <tr key={i}>
                  <td style={{paddingLeft:20}}>
                    <span style={{fontWeight:600, color:"var(--gray-900)"}}>{h.subj}</span>
                  </td>
                  <td>
                    <div style={{maxWidth:380, color:"var(--gray-700)"}}>{h.task}</div>
                  </td>
                  <td>{teacher ? <span className="tag tag-blue">8А</span> : <span className="muted">{h.teacher}</span>}</td>
                  <td>
                    <span style={{fontSize:13, fontWeight:500, color: h.due === "Завтра" ? "var(--red-700)" : h.due === "Сдано" ? "var(--green-700)" : "var(--gray-700)"}}>
                      {h.due}
                    </span>
                  </td>
                  <td><span className={`tag ${st.cls}`}>{st.l}</span></td>
                  <td style={{paddingRight:20, textAlign:"right"}}>
                    <button className="btn btn-ghost btn-sm">{teacher ? "Открыть" : (h.status === "done" ? "Просмотр" : "Сдать")}<Icons.ChevronRight size={13}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Moderation (zavuch)
function Moderation() {
  return (
    <div className="content">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18}}>
        <div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>Модерация</div>
          <div style={{fontSize:13.5, color:"var(--gray-500)", marginTop:4}}>12 заявок ждут проверки · 4 спорные оценки</div>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{paddingLeft:20}}>Тип</th>
              <th>Описание</th>
              <th>От кого</th>
              <th>Когда</th>
              <th style={{paddingRight:20, textAlign:"right"}}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {[
              { t:"Оспаривание оценки", d:"Иванов А. (7Б) — оценка «2» по физике от 25.10", w:"Родитель", when:"15 мин назад", pri:"red" },
              { t:"Запрос на справку", d:"Освобождение от физкультуры на 2 недели", w:"Семёнов М. (8А)", when:"1 ч назад", pri:"yellow" },
              { t:"Изменение журнала", d:"Орозова А.К. — правка оценки задним числом", w:"Учитель", when:"2 ч назад", pri:"yellow" },
              { t:"Перевод в класс", d:"Запрос перевода 7Б → 7А", w:"Родитель", when:"Сегодня", pri:"blue" },
              { t:"Жалоба", d:"Нарушение дисциплины на уроке кырг. яз.", w:"Тилекова Б.", when:"Вчера", pri:"red" },
              { t:"Подтверждение пропуска", d:"Болезнь, 26-30 октября (5 дней)", w:"Родитель", when:"Вчера", pri:"blue" },
            ].map((r, i) => (
              <tr key={i}>
                <td style={{paddingLeft:20}}>
                  <div className="row" style={{gap:8}}>
                    <div style={{width:6, height:6, borderRadius:"50%", background: r.pri === "red" ? "var(--red-500)" : r.pri === "yellow" ? "var(--yellow-500)" : "var(--brand-500)"}}/>
                    <span style={{fontSize:13, fontWeight:600, color:"var(--gray-900)"}}>{r.t}</span>
                  </div>
                </td>
                <td><span style={{color:"var(--gray-700)"}}>{r.d}</span></td>
                <td><span className="muted">{r.w}</span></td>
                <td><span className="muted">{r.when}</span></td>
                <td style={{paddingRight:20, textAlign:"right"}}>
                  <div className="row" style={{gap:6, justifyContent:"flex-end"}}>
                    <button className="btn btn-ghost btn-sm">Отклонить</button>
                    <button className="btn btn-primary btn-sm">Рассмотреть</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Students list
function Students() {
  return (
    <div className="content">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18}}>
        <div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>Ученики</div>
          <div style={{fontSize:13.5, color:"var(--gray-500)", marginTop:4}}>Класс 8А · 22 ученика</div>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn btn-secondary"><Icons.Download size={16}/>Экспорт списка</button>
          <button className="btn btn-primary"><Icons.Plus size={16}/>Добавить ученика</button>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{paddingLeft:20}}>Ученик</th>
              <th>Дата рождения</th>
              <th>Родители</th>
              <th>Средний балл</th>
              <th>Посещ.</th>
              <th>Статус</th>
              <th style={{paddingRight:20}}></th>
            </tr>
          </thead>
          <tbody>
            {MOCK.STUDENTS_8A.map((s, i) => {
              const a = MOCK.avg(MOCK.GRADES_8A_MATH[i]);
              const att = 88 + ((i * 11) % 12);
              return (
                <tr key={s.id}>
                  <td style={{paddingLeft:20}}>
                    <div className="row" style={{gap:10}}>
                      <div className={`avatar sm ${s.av}`}>{s.init}</div>
                      <div>
                        <div style={{fontWeight:600, color:"var(--gray-900)"}}>{s.last} {s.first}</div>
                        <div className="muted" style={{fontSize:11.5}}>ID: ER-{String(2025000 + s.id)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{((i % 28) + 1).toString().padStart(2,'0')}.{((i % 11) + 1).toString().padStart(2,'0')}.2010</td>
                  <td className="muted">2 контакта</td>
                  <td><span className="mono" style={{fontWeight:600, color: a >= 4.5 ? "var(--green-700)" : "var(--gray-900)"}}>{a ? a.toFixed(2) : "—"}</span></td>
                  <td>
                    <div className="row" style={{gap:6}}>
                      <span className="mono" style={{fontSize:13, fontWeight:600, color: att >= 95 ? "var(--green-700)" : att >= 90 ? "var(--gray-800)" : "var(--yellow-700)"}}>{att}%</span>
                    </div>
                  </td>
                  <td>
                    {i === 14 || i === 21 ? <span className="tag tag-yellow">Риск</span> : <span className="tag tag-green">Активен</span>}
                  </td>
                  <td style={{paddingRight:20, textAlign:"right"}}>
                    <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}}><Icons.MoreH size={16}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.StubPage = StubPage;
window.Homework = Homework;
window.Moderation = Moderation;
window.Students = Students;
