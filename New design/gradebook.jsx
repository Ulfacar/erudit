/* global React, Icons, MOCK */
const { useState: useGS } = React;

function GradeCell({ value, onClick, focused }) {
  let cls = "grade gn";
  let label = "";
  if (value === "н") { cls = "grade absent"; label = "н"; }
  else if (value === 5) { cls = "grade g5"; label = "5"; }
  else if (value === 4) { cls = "grade g4"; label = "4"; }
  else if (value === 3) { cls = "grade g3"; label = "3"; }
  else if (value === 2) { cls = "grade g2"; label = "2"; }
  else { cls = "grade gn"; label = ""; }

  return (
    <button
      onClick={onClick}
      style={{
        width:46, height:34, padding:0, border:"none", background:"transparent",
        display:"grid", placeItems:"center",
        boxShadow: focused ? "inset 0 0 0 2px var(--brand-500)" : "none",
        borderRadius:8,
      }}
    >
      {label ? <span className={cls} style={{width:32, height:30, fontSize:13}}>{label}</span>
        : <span style={{color:"var(--gray-300)", fontSize:14}}>·</span>}
    </button>
  );
}

function Gradebook() {
  const [focused, setFocused] = useGS(null);
  const [tab, setTab] = useGS("grades");

  return (
    <div className="content">
      {/* Page header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20}}>
        <div>
          <div className="row" style={{gap:8, marginBottom:6, color:"var(--gray-500)", fontSize:13}}>
            <span>Журналы</span>
            <Icons.ChevronRight size={13}/>
            <span>Математика</span>
            <Icons.ChevronRight size={13}/>
            <span style={{color:"var(--gray-900)", fontWeight:500}}>8А</span>
          </div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>
            Журнал — Математика, 8А
          </div>
          <div style={{fontSize:13.5, color:"var(--gray-500)", marginTop:4}}>
            I четверть · Орозова А.К. · 22 ученика · 10 уроков из 36
          </div>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn btn-secondary"><Icons.Download size={16}/>Экспорт</button>
          <button className="btn btn-secondary"><Icons.Pencil size={16}/>Редактировать</button>
          <button className="btn btn-primary"><Icons.Plus size={16}/>Новый урок</button>
        </div>
      </div>

      {/* Sub-controls */}
      <div className="row" style={{gap:8, marginBottom:16, flexWrap:"wrap"}}>
        {/* Tabs */}
        <div className="row" style={{gap:4, padding:4, background:"var(--gray-100)", borderRadius:8}}>
          {[
            { id:"grades", label:"Оценки", icon:"ClipboardCheck" },
            { id:"plan", label:"КТП", icon:"FileText" },
            { id:"attend", label:"Посещаемость", icon:"CheckSquare" },
            { id:"hw", label:"Задания", icon:"Book" },
          ].map(t => {
            const Ic = Icons[t.icon];
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding:"6px 12px", border:"none",
                background: active ? "white" : "transparent",
                color: active ? "var(--gray-900)" : "var(--gray-600)",
                borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer",
                boxShadow: active ? "var(--shadow-xs)" : "none",
                display:"flex", alignItems:"center", gap:6,
              }}>
                <Ic size={14}/>{t.label}
              </button>
            );
          })}
        </div>

        <div style={{flex:1}}/>

        <select className="select" style={{width:170, height:36}}>
          <option>I четверть</option>
          <option>II четверть</option>
          <option>III четверть</option>
          <option>IV четверть</option>
          <option>Весь год</option>
        </select>
        <div className="search-input" style={{minWidth:200, height:36}}>
          <Icons.Search size={14} style={{color:"var(--gray-400)"}} />
          <input placeholder="Найти ученика…"/>
        </div>
        <button className="btn btn-secondary btn-sm"><Icons.Filter size={14}/>Фильтры</button>
      </div>

      {/* Stat strip */}
      <div className="card" style={{padding:"14px 20px", marginBottom:16, display:"flex", alignItems:"center", gap:32}}>
        <div className="row" style={{gap:10}}>
          <div style={{width:36, height:36, borderRadius:10, background:"var(--brand-50)", color:"var(--brand-700)", display:"grid", placeItems:"center"}}>
            <Icons.Award size={18}/>
          </div>
          <div>
            <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Средний по классу</div>
            <div className="row" style={{gap:8, alignItems:"baseline", marginTop:2}}>
              <span className="mono" style={{fontSize:22, fontWeight:700}}>4.21</span>
              <span className="kpi-delta up" style={{fontSize:11}}><Icons.ArrowUp size={11}/>0.15</span>
            </div>
          </div>
        </div>
        <div style={{width:1, height:32, background:"var(--gray-150)"}}/>
        <div>
          <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Качество знаний</div>
          <div style={{fontSize:18, fontWeight:700, color:"var(--gray-900)", marginTop:2}}>76%</div>
        </div>
        <div>
          <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Успеваемость</div>
          <div style={{fontSize:18, fontWeight:700, color:"var(--gray-900)", marginTop:2}}>95%</div>
        </div>
        <div>
          <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Пропуски</div>
          <div style={{fontSize:18, fontWeight:700, color:"var(--gray-900)", marginTop:2}}>14 ур.</div>
        </div>
        <div style={{flex:1}}/>
        {/* Grade distribution */}
        <div className="row" style={{gap:10}}>
          <span style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Распределение</span>
          <div className="row" style={{gap:6}}>
            {[
              { v:"5", n:64, c:"var(--green-500)" },
              { v:"4", n:48, c:"var(--brand-500)" },
              { v:"3", n:22, c:"var(--yellow-500)" },
              { v:"2", n:6, c:"var(--red-500)" },
            ].map(d => (
              <div key={d.v} className="row" style={{gap:5}}>
                <div style={{width:10, height:10, borderRadius:3, background:d.c}}/>
                <span style={{fontSize:12, fontWeight:600, color:"var(--gray-700)"}}>{d.v}</span>
                <span style={{fontSize:11.5, color:"var(--gray-500)"}}>{d.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The grade table */}
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{overflow:"auto"}}>
          <table style={{borderCollapse:"separate", borderSpacing:0, width:"100%", fontSize:13.5}}>
            <thead>
              <tr>
                <th style={{
                  position:"sticky", left:0, zIndex:3,
                  background:"var(--gray-50)",
                  borderBottom:"1px solid var(--gray-150)",
                  borderRight:"1px solid var(--gray-150)",
                  padding:"12px 16px",
                  textAlign:"left",
                  fontSize:11, fontWeight:600, color:"var(--gray-500)",
                  textTransform:"uppercase", letterSpacing:"0.04em",
                  minWidth:260,
                }}>Ученик</th>
                {MOCK.LESSON_DATES.map((l, i) => (
                  <th key={i} style={{
                    background:"var(--gray-50)",
                    borderBottom:"1px solid var(--gray-150)",
                    padding:"8px 4px",
                    minWidth:54, width:54,
                    textAlign:"center",
                    position:"relative",
                  }}>
                    <div style={{fontSize:11.5, fontWeight:700, color:"var(--gray-700)", lineHeight:1}}>{l.d}.{String(l.m).padStart(2,'0')}</div>
                    <div style={{fontSize:10, color:"var(--gray-400)", marginTop:3}}>{l.weekday}</div>
                    {l.important && (
                      <div style={{
                        marginTop:4,
                        fontSize:9, fontWeight:700, color:"var(--red-700)",
                        background:"var(--red-50)",
                        padding:"1px 4px", borderRadius:3,
                        display:"inline-block",
                      }}>{l.type}</div>
                    )}
                    {!l.important && l.type !== "урок" && (
                      <div style={{
                        marginTop:4,
                        fontSize:9, fontWeight:700, color:"var(--yellow-700)",
                        background:"var(--yellow-50)",
                        padding:"1px 4px", borderRadius:3,
                        display:"inline-block",
                      }}>{l.type}</div>
                    )}
                  </th>
                ))}
                <th style={{
                  background:"var(--gray-50)", borderBottom:"1px solid var(--gray-150)",
                  borderLeft:"1px solid var(--gray-150)",
                  padding:"12px 16px",
                  textAlign:"center", fontSize:11, fontWeight:600, color:"var(--gray-500)",
                  textTransform:"uppercase", letterSpacing:"0.04em", minWidth:80,
                }}>Средн.</th>
                <th style={{
                  background:"var(--gray-50)", borderBottom:"1px solid var(--gray-150)",
                  padding:"12px 16px",
                  textAlign:"center", fontSize:11, fontWeight:600, color:"var(--gray-500)",
                  textTransform:"uppercase", letterSpacing:"0.04em", minWidth:80,
                }}>Четв.</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.STUDENTS_8A.map((s, i) => {
                const row = MOCK.GRADES_8A_MATH[i];
                const a = MOCK.avg(row);
                const quarter = a ? Math.round(a) : null;
                return (
                  <tr key={s.id} style={{borderBottom:"1px solid var(--gray-100)"}}>
                    <td style={{
                      position:"sticky", left:0, zIndex:2,
                      background: i % 2 === 0 ? "white" : "var(--gray-25)",
                      borderBottom:"1px solid var(--gray-100)",
                      borderRight:"1px solid var(--gray-150)",
                      padding:"6px 16px",
                    }}>
                      <div className="row" style={{gap:10}}>
                        <span style={{
                          fontSize:11, fontWeight:600, color:"var(--gray-400)", width:18, textAlign:"right",
                          fontVariantNumeric:"tabular-nums",
                        }}>{i+1}</span>
                        <div className={`avatar sm ${s.av}`}>{s.init}</div>
                        <div style={{minWidth:0, flex:1}}>
                          <div style={{fontWeight:600, fontSize:13.5, color:"var(--gray-900)", whiteSpace:"nowrap"}}>
                            {s.last} {s.first}
                          </div>
                        </div>
                      </div>
                    </td>
                    {row.map((g, j) => (
                      <td key={j} style={{
                        padding:0,
                        background: i % 2 === 0 ? "white" : "var(--gray-25)",
                        borderBottom:"1px solid var(--gray-100)",
                        textAlign:"center",
                      }}>
                        <GradeCell
                          value={g}
                          focused={focused === `${i}-${j}`}
                          onClick={() => setFocused(`${i}-${j}`)}
                        />
                      </td>
                    ))}
                    <td style={{
                      background: i % 2 === 0 ? "white" : "var(--gray-25)",
                      borderLeft:"1px solid var(--gray-150)",
                      padding:"8px 16px", textAlign:"center",
                    }}>
                      <span className="mono" style={{
                        fontWeight:600, fontSize:14,
                        color: a >= 4.5 ? "var(--green-700)" : a >= 3.5 ? "var(--gray-800)" : a >= 2.5 ? "var(--yellow-700)" : "var(--red-700)",
                      }}>{a ? a.toFixed(2) : "—"}</span>
                    </td>
                    <td style={{
                      background: i % 2 === 0 ? "white" : "var(--gray-25)",
                      padding:"8px 16px", textAlign:"center",
                    }}>
                      {quarter && <span className={`grade g${quarter}`}>{quarter}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div style={{
          padding:"14px 20px",
          borderTop:"1px solid var(--gray-150)",
          background:"var(--gray-50)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          fontSize:13, color:"var(--gray-600)",
        }}>
          <div className="row" style={{gap:24}}>
            <span>Всего оценок: <b style={{color:"var(--gray-900)"}}>140</b></span>
            <span>Пропусков: <b style={{color:"var(--gray-900)"}}>14</b></span>
            <span>Дата последнего обновления: <b style={{color:"var(--gray-900)"}}>сегодня, 11:42</b></span>
          </div>
          <div className="row" style={{gap:6, fontSize:11.5, color:"var(--gray-500)"}}>
            <span className="kbd" style={{
              fontFamily:"var(--font-mono)", fontSize:11, color:"var(--gray-500)",
              background:"white", border:"1px solid var(--gray-150)", borderRadius:4, padding:"1px 5px",
            }}>↑↓←→</span>
            навигация по ячейкам, цифры — оценка, <span className="kbd" style={{
              fontFamily:"var(--font-mono)", fontSize:11, color:"var(--gray-500)",
              background:"white", border:"1px solid var(--gray-150)", borderRadius:4, padding:"1px 5px",
            }}>H</span> — отсутствие
          </div>
        </div>
      </div>
    </div>
  );
}

window.Gradebook = Gradebook;
