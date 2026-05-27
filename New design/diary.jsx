/* global React, Icons, MOCK */
const { useState: useDS } = React;

function Diary({ role }) {
  const isParent = role === "parent";
  const [child, setChild] = useDS(0);
  const children = [
    { name:"Айдана Абдыкадырова", cls:"8А", av:"av-violet", init:"АА", age:14, avg:4.42 },
    { name:"Тимур Абдыкадыров", cls:"5Б", av:"av-blue", init:"ТА", age:11, avg:4.18 },
  ];

  return (
    <div className="content">
      {/* Parent child switcher */}
      {isParent && (
        <div className="card" style={{padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:8}}>
          <span style={{fontSize:13, fontWeight:600, color:"var(--gray-700)", marginRight:8}}>Ребёнок:</span>
          {children.map((c, i) => (
            <button key={i} onClick={() => setChild(i)} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"6px 14px 6px 6px",
              border:`1px solid ${child === i ? "var(--brand-500)" : "var(--gray-200)"}`,
              background: child === i ? "var(--brand-50)" : "white",
              borderRadius:999, cursor:"pointer", fontSize:13, fontWeight:600,
              color: child === i ? "var(--brand-800)" : "var(--gray-800)",
            }}>
              <div className={`avatar sm ${c.av}`}>{c.init}</div>
              {c.name.split(" ")[0]} · {c.cls}
            </button>
          ))}
          <div style={{flex:1}}/>
          <button className="btn btn-secondary btn-sm"><Icons.MessageSquare size={14}/>Связаться с учителем</button>
          <button className="btn btn-secondary btn-sm"><Icons.FileText size={14}/>Справка</button>
        </div>
      )}

      {/* Header card */}
      <div className="card" style={{padding:24, marginBottom:18, background:"linear-gradient(135deg, var(--gray-0) 0%, var(--gray-50) 100%)"}}>
        <div style={{display:"flex", alignItems:"center", gap:20, flexWrap:"wrap"}}>
          <div className={`avatar lg ${children[child].av}`} style={{width:64, height:64, fontSize:22, borderRadius:16}}>{children[child].init}</div>
          <div style={{flex:1, minWidth:200}}>
            <div style={{fontSize:22, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>{children[child].name}</div>
            <div className="row" style={{gap:8, marginTop:4}}>
              <span className="tag tag-blue">{children[child].cls} · 2025/26</span>
              <span style={{fontSize:13, color:"var(--gray-500)"}}>{children[child].age} лет · Школа №12 им. Ч. Айтматова</span>
            </div>
          </div>
          <div style={{display:"flex", gap:24}}>
            <div>
              <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Средний</div>
              <div className="mono" style={{fontSize:22, fontWeight:700, color:"var(--green-700)", marginTop:2}}>{children[child].avg.toFixed(2)}</div>
            </div>
            <div>
              <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Посещ.</div>
              <div style={{fontSize:22, fontWeight:700, color:"var(--gray-900)", marginTop:2}}>96<span style={{fontSize:14, color:"var(--gray-400)"}}>%</span></div>
            </div>
            <div>
              <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Место</div>
              <div style={{fontSize:22, fontWeight:700, color:"var(--gray-900)", marginTop:2}}>4<span style={{fontSize:14, color:"var(--gray-400)"}}> / 22</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="row" style={{justifyContent:"space-between", marginBottom:14}}>
        <div className="row" style={{gap:8}}>
          <button className="icon-btn"><Icons.ChevronLeft size={16}/></button>
          <div style={{fontSize:15, fontWeight:600, color:"var(--gray-900)"}}>28 окт — 2 ноя 2025</div>
          <button className="icon-btn"><Icons.ChevronRight size={16}/></button>
          <button className="btn btn-ghost btn-sm">Сегодня</button>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn btn-secondary btn-sm"><Icons.Filter size={14}/>Все предметы</button>
          <button className="btn btn-secondary btn-sm"><Icons.Download size={14}/>PDF</button>
        </div>
      </div>

      {/* Two-column layout: days + side */}
      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        {/* Days */}
        <div className="col" style={{gap:14}}>
          {MOCK.DIARY_WEEK.map((day, di) => {
            const todayBadge = di === 0;
            return (
              <div key={di} className="card">
                <div style={{
                  padding:"14px 20px",
                  borderBottom:"1px solid var(--gray-100)",
                  display:"flex", alignItems:"center", gap:10,
                }}>
                  <div style={{fontSize:15, fontWeight:600, color:"var(--gray-900)"}}>{day.day}</div>
                  {todayBadge && <span className="tag tag-blue">Сегодня</span>}
                  <div style={{flex:1}}/>
                  <span style={{fontSize:12, color:"var(--gray-500)"}}>{day.lessons.length} уроков</span>
                </div>
                <div>
                  {day.lessons.map((l, li) => (
                    <div key={li} style={{
                      display:"grid",
                      gridTemplateColumns:"54px 1fr auto",
                      gap:14,
                      padding:"14px 20px",
                      borderBottom: li === day.lessons.length - 1 ? "none" : "1px solid var(--gray-100)",
                      alignItems:"center",
                      background: l.important ? "var(--red-50)" : "transparent",
                    }}>
                      <div style={{textAlign:"right"}}>
                        <div className="mono" style={{fontSize:14, fontWeight:600, color:"var(--gray-900)"}}>{l.time}</div>
                        <div style={{fontSize:10.5, color:"var(--gray-400)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", marginTop:2}}>{li+1} урок</div>
                      </div>
                      <div style={{minWidth:0}}>
                        <div className="row" style={{gap:8}}>
                          <span style={{fontWeight:600, fontSize:14, color:"var(--gray-900)"}}>{l.subj}</span>
                          {l.important && <span className="tag tag-red">контрольная</span>}
                        </div>
                        <div style={{fontSize:13, color:"var(--gray-600)", marginTop:3, lineHeight:1.5}}>
                          {l.topic}
                        </div>
                        {l.hw && (
                          <div style={{marginTop:8, padding:"8px 12px", background:"var(--gray-50)", border:"1px solid var(--gray-150)", borderRadius:8, fontSize:12.5, color:"var(--gray-700)"}}>
                            <span style={{fontSize:10.5, fontWeight:700, color:"var(--gray-500)", textTransform:"uppercase", letterSpacing:"0.04em", marginRight:8}}>ДЗ</span>
                            {l.hw}
                          </div>
                        )}
                      </div>
                      <div>
                        {l.grade ? (
                          <span className={`grade lg g${l.grade}`}>{l.grade}</span>
                        ) : (
                          <div style={{width:38, height:38, border:"1.5px dashed var(--gray-200)", borderRadius:10}}/>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side panels */}
        <div className="col" style={{gap:16}}>
          {/* HW pending */}
          <div className="card">
            <div className="section-header" style={{padding:"16px 20px 0"}}>
              <div>
                <div className="section-title">Домашние задания</div>
                <div className="section-sub">К выполнению на этой неделе</div>
              </div>
              <span className="tag tag-yellow">5</span>
            </div>
            <div style={{padding:"12px 0 8px"}}>
              {MOCK.HOMEWORK_PENDING.slice(0,5).map((h, i) => {
                const colors = {
                  "todo":"var(--gray-200)",
                  "in-progress":"var(--yellow-500)",
                  "done":"var(--green-500)",
                };
                return (
                  <div key={i} style={{padding:"10px 20px", borderBottom: i === 4 ? "none" : "1px solid var(--gray-100)", display:"flex", gap:12, alignItems:"flex-start"}}>
                    <div style={{
                      width:18, height:18, marginTop:2, borderRadius:5,
                      border: `1.5px solid ${colors[h.status]}`,
                      background: h.status === "done" ? "var(--green-500)" : "transparent",
                      display:"grid", placeItems:"center", flexShrink:0,
                    }}>
                      {h.status === "done" && <Icons.CheckCircle size={12} style={{color:"white"}}/>}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div className="row" style={{gap:6, marginBottom:2}}>
                        <span style={{fontSize:12.5, fontWeight:600, color:"var(--gray-900)"}}>{h.subj}</span>
                        <span style={{fontSize:11, color: h.due === "Завтра" ? "var(--red-700)" : h.due === "Сдано" ? "var(--green-700)" : "var(--gray-500)", fontWeight:600}}>· {h.due}</span>
                      </div>
                      <div style={{fontSize:12.5, color:"var(--gray-600)", lineHeight:1.4, textDecoration: h.status === "done" ? "line-through" : "none"}}>{h.task}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent grades */}
          <div className="card card-pad">
            <div className="section-header">
              <div>
                <div className="section-title">Последние оценки</div>
                <div className="section-sub">За эту неделю</div>
              </div>
            </div>
            <div className="col" style={{gap:0}}>
              {[
                { subj:"Математика", g:5, date:"29 окт", note:"Контрольная работа" },
                { subj:"Информатика", g:5, date:"29 окт", note:"Алгоритмы" },
                { subj:"Биология", g:5, date:"28 окт", note:"Устный ответ" },
                { subj:"Алгебра", g:4, date:"30 окт", note:"Работа на уроке" },
                { subj:"Литература", g:4, date:"29 окт", note:'"Джамиля"' },
                { subj:"Английский", g:4, date:"28 окт", note:"Present Perfect" },
                { subj:"Кыргыз тили", g:4, date:"29 окт", note:"Сын атооч" },
                { subj:"Русский язык", g:3, date:"30 окт", note:"Союзы в СПП" },
              ].map((r, i) => (
                <div key={i} className="row" style={{gap:12, padding:"8px 0", borderBottom: i === 7 ? "none" : "1px solid var(--gray-100)"}}>
                  <span className={`grade sm g${r.g}`}>{r.g}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:600, color:"var(--gray-900)"}}>{r.subj}</div>
                    <div style={{fontSize:11.5, color:"var(--gray-500)"}}>{r.note}</div>
                  </div>
                  <span style={{fontSize:11.5, color:"var(--gray-400)"}}>{r.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher note */}
          {isParent && (
            <div className="card card-pad" style={{borderColor:"var(--brand-100)", background:"var(--brand-50)"}}>
              <div className="row" style={{gap:10}}>
                <div className="avatar sm av-pink">АО</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5, fontWeight:600, color:"var(--gray-900)"}}>Айгуль Орозова</div>
                  <div style={{fontSize:11, color:"var(--brand-700)", fontWeight:500}}>Кл. руководитель · вчера, 18:23</div>
                </div>
              </div>
              <div style={{fontSize:13, color:"var(--gray-800)", marginTop:10, lineHeight:1.55}}>
                Айдана отлично справилась с контрольной по геометрии — лучший результат в классе. Поздравляю!
              </div>
              <div className="row" style={{gap:8, marginTop:12}}>
                <button className="btn btn-primary btn-sm" style={{flex:1, justifyContent:"center"}}>Ответить</button>
                <button className="btn btn-secondary btn-sm">Все 12 сообщений</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.Diary = Diary;
