/* global React, Icons, MOCK */

// Simple SVG line chart
function LineChart({ data, height = 80, width = 280, color = "var(--brand-600)", showArea = true }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const step = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${d} L${pts[pts.length-1][0]},${height} L${pts[0][0]},${height} Z`;
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      {showArea && (
        <>
          <defs>
            <linearGradient id="larea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#larea)" />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p, i) => i === pts.length - 1 && (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="white" stroke={color} strokeWidth="2"/>
      ))}
    </svg>
  );
}

function Donut({ value, size = 120, stroke = 12, color = "var(--brand-600)", track = "var(--gray-100)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ data, height = 140, color = "var(--brand-600)" }) {
  const max = Math.max(...data.map(d => d.v));
  return (
    <div style={{display:"flex", alignItems:"flex-end", gap:8, height, padding:"0 4px"}}>
      {data.map((d, i) => (
        <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%"}}>
          <div style={{flex:1, width:"100%", display:"flex", alignItems:"flex-end"}}>
            <div style={{
              width:"100%",
              height: `${(d.v/max)*100}%`,
              background: d.color || color,
              borderRadius:"6px 6px 2px 2px",
              minHeight:4,
              opacity: d.dim ? 0.4 : 1,
            }} />
          </div>
          <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:500}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const k = MOCK.SCHOOL_KPI;
  return (
    <div className="content">
      {/* Header row */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24}}>
        <div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>
            Доброе утро, Айдай Бекмуратовна
          </div>
          <div style={{fontSize:14, color:"var(--gray-500)", marginTop:4}}>
            Понедельник, 28 октября 2025 · I четверть, неделя 9 из 10
          </div>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn btn-secondary"><Icons.Download size={16}/>Экспорт отчёта</button>
          <button className="btn btn-primary"><Icons.Plus size={16}/>Создать объявление</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16, marginBottom:24}}>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label"><Icons.Users size={14}/> Всего учеников</div>
            <div className="kpi-value">{k.totalStudents.toLocaleString("ru")}</div>
            <div className="row" style={{gap:6}}>
              <span className="kpi-delta up"><Icons.ArrowUp size={12}/> 32 за месяц</span>
              <span className="muted" style={{fontSize:12}}>· 87 классов</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label"><Icons.CheckCircle size={14}/> Посещаемость сегодня</div>
            <div className="row" style={{gap:14, alignItems:"baseline"}}>
              <div className="kpi-value">{k.attendance}<span style={{fontSize:18, color:"var(--gray-400)"}}>%</span></div>
              <span className="kpi-delta down"><Icons.ArrowDown size={12}/> 0.6%</span>
            </div>
            <div className="muted" style={{fontSize:12}}>1175 присутствуют · 72 отсутствуют</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label"><Icons.Award size={14}/> Средний балл по школе</div>
            <div className="row" style={{gap:14, alignItems:"baseline"}}>
              <div className="kpi-value mono">{k.avgGrade.toFixed(2)}</div>
              <span className="kpi-delta up"><Icons.ArrowUp size={12}/> 0.08</span>
            </div>
            <div className="muted" style={{fontSize:12}}>по сравнению с прошлой четвертью</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label"><Icons.Briefcase size={14}/> Учителей в системе</div>
            <div className="row" style={{gap:14, alignItems:"baseline"}}>
              <div className="kpi-value">{k.teachers}</div>
              <span className="tag tag-green" style={{marginLeft:0}}>76 активны</span>
            </div>
            <div className="muted" style={{fontSize:12}}>3 в декретном · 8 в отпуске</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16, marginBottom:16}}>
        {/* Attendance + grade trend */}
        <div className="card card-pad">
          <div className="section-header">
            <div>
              <div className="section-title">Посещаемость и успеваемость</div>
              <div className="section-sub">Последние 14 дней по школе</div>
            </div>
            <div className="row" style={{gap:4, padding:4, background:"var(--gray-75)", borderRadius:8}}>
              {["7 дней", "14 дней", "Месяц", "Четверть"].map((t, i) => (
                <button key={t} style={{
                  padding:"5px 10px", border:"none",
                  background: i === 1 ? "white" : "transparent",
                  color: i === 1 ? "var(--gray-900)" : "var(--gray-500)",
                  borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer",
                  boxShadow: i === 1 ? "var(--shadow-xs)" : "none",
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{display:"flex", gap:32, alignItems:"center", padding:"4px 0 16px"}}>
            <div>
              <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Посещаемость</div>
              <div className="row" style={{gap:8, marginTop:6}}>
                <div className="kpi-value" style={{fontSize:22}}>94.6%</div>
                <span className="kpi-delta up" style={{fontSize:11}}><Icons.ArrowUp size={10}/>0.4%</span>
              </div>
            </div>
            <div style={{width:1, height:36, background:"var(--gray-150)"}}/>
            <div>
              <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Средний балл</div>
              <div className="row" style={{gap:8, marginTop:6}}>
                <div className="kpi-value mono" style={{fontSize:22}}>4.21</div>
                <span className="kpi-delta up" style={{fontSize:11}}><Icons.ArrowUp size={10}/>0.08</span>
              </div>
            </div>
            <div style={{width:1, height:36, background:"var(--gray-150)"}}/>
            <div>
              <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em"}}>Группа риска</div>
              <div className="row" style={{gap:8, marginTop:6}}>
                <div className="kpi-value" style={{fontSize:22, color:"var(--yellow-700)"}}>38</div>
                <span className="kpi-delta down" style={{fontSize:11, color:"var(--green-700)"}}><Icons.ArrowDown size={10}/>5</span>
              </div>
            </div>
          </div>
          <div style={{width:"100%", height:200, marginTop:8}}>
            <svg width="100%" height="200" viewBox="0 0 600 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="att-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#228be6" stopOpacity="0.22"/>
                  <stop offset="100%" stopColor="#228be6" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="grd-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#37b24d" stopOpacity="0.18"/>
                  <stop offset="100%" stopColor="#37b24d" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0, 1, 2, 3].map(i => (
                <line key={i} x1="0" y1={20 + i*50} x2="600" y2={20 + i*50} stroke="var(--gray-100)" strokeWidth="1"/>
              ))}
              {/* Attendance area + line */}
              {(() => {
                const data = MOCK.ATTENDANCE_14D;
                const min = 90, max = 97;
                const pts = data.map((v, i) => [i * (600/(data.length-1)), 170 - ((v - min)/(max-min))*150]);
                const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
                const area = `${d} L600,200 L0,200 Z`;
                return (
                  <>
                    <path d={area} fill="url(#att-area)"/>
                    <path d={d} fill="none" stroke="#228be6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                    {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="white" stroke="#228be6" strokeWidth="2"/>)}
                  </>
                );
              })()}
              {/* Grade line */}
              {(() => {
                const data = [4.10, 4.12, 4.15, 4.13, 4.18, 4.16, 4.19, 4.20, 4.17, 4.19, 4.22, 4.21, 4.23, 4.21];
                const min = 4.0, max = 4.3;
                const pts = data.map((v, i) => [i * (600/(data.length-1)), 170 - ((v - min)/(max-min))*150]);
                const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
                return <path d={d} fill="none" stroke="#37b24d" strokeWidth="2.5" strokeDasharray="4 4" strokeLinejoin="round"/>;
              })()}
            </svg>
          </div>
          <div className="row" style={{justifyContent:"space-between", marginTop:8, padding:"0 4px"}}>
            {["15 окт", "17", "19", "21", "23", "25", "27", "Сегодня"].map((d, i) => (
              <span key={i} style={{fontSize:11, color:"var(--gray-400)", fontWeight:500}}>{d}</span>
            ))}
          </div>
          <div className="row" style={{gap:18, marginTop:14, paddingTop:14, borderTop:"1px solid var(--gray-100)"}}>
            <div className="row" style={{gap:6}}>
              <div style={{width:10, height:10, borderRadius:2, background:"#228be6"}}/>
              <span style={{fontSize:12, color:"var(--gray-600)"}}>Посещаемость, %</span>
            </div>
            <div className="row" style={{gap:6}}>
              <div style={{width:10, height:2, background:"#37b24d", borderRadius:2}}/>
              <span style={{fontSize:12, color:"var(--gray-600)"}}>Средний балл</span>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="card card-pad">
          <div className="section-header">
            <div>
              <div className="section-title">Лента событий</div>
              <div className="section-sub">Что происходит в школе сейчас</div>
            </div>
            <button className="btn btn-ghost btn-sm">Все</button>
          </div>
          <div className="col" style={{gap:0}}>
            {MOCK.FEED.map((f, i) => {
              const Icon = Icons[f.icon] || Icons.Bell;
              const colorMap = {
                blue:"var(--brand-100)", yellow:"var(--yellow-100)", violet:"#ede9fe",
                green:"var(--green-100)", teal:"#c3fae8", gray:"var(--gray-100)"
              };
              const iconColorMap = {
                blue:"var(--brand-700)", yellow:"var(--yellow-700)", violet:"var(--violet-600)",
                green:"var(--green-700)", teal:"var(--teal-600)", gray:"var(--gray-600)"
              };
              return (
                <div key={i} style={{display:"flex", gap:12, padding:"12px 0", borderBottom: i === MOCK.FEED.length - 1 ? "none" : "1px solid var(--gray-100)"}}>
                  <div style={{
                    width:34, height:34, borderRadius:8,
                    background: colorMap[f.color], color: iconColorMap[f.color],
                    display:"grid", placeItems:"center", flexShrink:0,
                  }}>
                    <Icon size={16}/>
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, lineHeight:1.45}}>
                      <span style={{fontWeight:600, color:"var(--gray-900)"}}>{f.who}</span>
                      <span style={{color:"var(--gray-600)"}}> {f.what}</span>
                      {f.cls && <span style={{color:"var(--gray-500)"}}> · {f.cls}</span>}
                    </div>
                    <div style={{fontSize:11.5, color:"var(--gray-400)", marginTop:2}}>{f.when}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower row: classes + announcements */}
      <div style={{display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16}}>
        <div className="card">
          <div className="section-header" style={{padding:"20px 20px 0"}}>
            <div>
              <div className="section-title">Средний балл по классам</div>
              <div className="section-sub">Текущая четверть · показано 12 из 87</div>
            </div>
            <div className="row" style={{gap:8}}>
              <button className="btn btn-ghost btn-sm"><Icons.Filter size={14}/>Параллель</button>
              <button className="btn btn-ghost btn-sm">Все классы<Icons.ArrowRight size={14}/></button>
            </div>
          </div>
          <table className="table" style={{marginTop:12}}>
            <thead>
              <tr>
                <th style={{paddingLeft:20}}>Класс</th>
                <th>Учеников</th>
                <th>Средний балл</th>
                <th>Динамика</th>
                <th style={{width:"35%"}}>Распределение</th>
                <th style={{paddingRight:20}}></th>
              </tr>
            </thead>
            <tbody>
              {MOCK.CLASS_AVG.map(c => {
                const pct = ((c.avg - 3.5) / 1.5) * 100;
                const color = c.avg >= 4.3 ? "var(--green-500)" : c.avg >= 4.0 ? "var(--brand-500)" : "var(--yellow-500)";
                return (
                  <tr key={c.cls}>
                    <td style={{paddingLeft:20}}>
                      <div className="row" style={{gap:10}}>
                        <div style={{
                          width:32, height:32, borderRadius:8,
                          background:"var(--gray-50)",
                          border:"1px solid var(--gray-150)",
                          display:"grid", placeItems:"center",
                          fontWeight:700, fontSize:12, color:"var(--gray-700)"
                        }}>{c.cls}</div>
                      </div>
                    </td>
                    <td className="muted">{c.students}</td>
                    <td><span className="mono" style={{fontWeight:600, fontSize:14}}>{c.avg.toFixed(2)}</span></td>
                    <td>
                      <span className={`kpi-delta ${c.trend >= 0 ? "up" : "down"}`}>
                        {c.trend >= 0 ? <Icons.ArrowUp size={11}/> : <Icons.ArrowDown size={11}/>}
                        {Math.abs(c.trend).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <div style={{height:6, background:"var(--gray-100)", borderRadius:3, overflow:"hidden"}}>
                        <div style={{width:`${pct}%`, height:"100%", background:color, borderRadius:3}}/>
                      </div>
                    </td>
                    <td style={{paddingRight:20, textAlign:"right"}}>
                      <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}}><Icons.ChevronRight size={14}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Announcements */}
        <div className="col" style={{gap:16}}>
          <div className="card card-pad">
            <div className="section-header">
              <div className="section-title">Объявления и события</div>
              <button className="btn btn-ghost btn-sm"><Icons.Plus size={14}/></button>
            </div>
            <div className="col" style={{gap:10}}>
              {MOCK.ANNOUNCEMENTS.map((a, i) => {
                const priColor = a.priority === "high" ? "var(--red-500)" : a.priority === "med" ? "var(--yellow-500)" : "var(--brand-500)";
                return (
                  <div key={i} style={{padding:"12px 14px", border:"1px solid var(--gray-150)", borderRadius:10, position:"relative", paddingLeft:18}}>
                    <div style={{position:"absolute", left:0, top:14, bottom:14, width:3, background:priColor, borderRadius:2}}/>
                    <div style={{fontWeight:600, fontSize:13.5, color:"var(--gray-900)"}}>{a.title}</div>
                    <div style={{fontSize:12, color:"var(--brand-700)", fontWeight:500, marginTop:3}}>{a.date}</div>
                    <div style={{fontSize:12.5, color:"var(--gray-600)", marginTop:6, lineHeight:1.45}}>{a.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk students */}
          <div className="card card-pad">
            <div className="section-header">
              <div>
                <div className="section-title">Группа риска</div>
                <div className="section-sub">Низкая успеваемость или посещаемость</div>
              </div>
              <span className="tag tag-yellow">38</span>
            </div>
            <div className="col" style={{gap:0}}>
              {[
                { name:"Иванов Артём", cls:"7Б", reason:"Пропуски 5+ дней", av:"av-blue", init:"ИА" },
                { name:"Семёнов Михаил", cls:"8А", reason:"Средний 2.8", av:"av-gray", init:"СМ" },
                { name:"Юсупов Руслан", cls:"8А", reason:"Долги по 3 предметам", av:"av-yellow", init:"ЮР" },
              ].map((s, i) => (
                <div key={i} className="row" style={{padding:"10px 0", borderBottom: i === 2 ? "none" : "1px solid var(--gray-100)", gap:12}}>
                  <div className={`avatar sm ${s.av}`}>{s.init}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:600, color:"var(--gray-900)"}}>{s.name}</div>
                    <div style={{fontSize:11.5, color:"var(--gray-500)"}}>{s.cls} · {s.reason}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}}><Icons.ChevronRight size={14}/></button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" style={{marginTop:8, justifyContent:"center", width:"100%"}}>
                Показать всех 38 учеников
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
window.LineChart = LineChart;
window.Donut = Donut;
window.BarChart = BarChart;
