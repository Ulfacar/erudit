/* global React, Icons, MOCK */

function Heatmap({ data, rows, cols, max = 5 }) {
  // data: 2D array, rows x cols, values 0..max
  return (
    <div style={{display:"grid", gridTemplateColumns:`140px repeat(${cols.length}, 1fr)`, gap:2}}>
      <div/>
      {cols.map((c, i) => (
        <div key={i} style={{fontSize:10.5, fontWeight:600, color:"var(--gray-500)", textAlign:"center", padding:"4px 0", textTransform:"uppercase", letterSpacing:"0.02em"}}>{c}</div>
      ))}
      {data.map((row, ri) => (
        <React.Fragment key={ri}>
          <div style={{fontSize:12, color:"var(--gray-700)", fontWeight:500, padding:"4px 12px 4px 0", display:"flex", alignItems:"center", justifyContent:"flex-end"}}>{rows[ri]}</div>
          {row.map((v, ci) => {
            const t = v / max;
            // Diverging: red(low) -> yellow(mid) -> green(high), centered at 4
            let bg;
            if (v < 3.5) {
              const x = (3.5 - v) / 1.5; // 0..1
              bg = `rgba(250, 82, 82, ${0.15 + x * 0.7})`;
            } else if (v < 4.3) {
              bg = `rgba(250, 176, 5, ${0.15 + (v - 3.5) / 0.8 * 0.3})`;
            } else {
              bg = `rgba(64, 192, 87, ${0.15 + (v - 4.3) / 0.7 * 0.7})`;
            }
            const textColor = (v < 3.0 || v > 4.5) ? "var(--gray-900)" : "var(--gray-700)";
            return (
              <div key={ci} style={{
                background:bg, borderRadius:6,
                fontSize:12, fontWeight:600, color:textColor,
                display:"grid", placeItems:"center", padding:"8px 0",
                fontFamily:"var(--font-mono)", fontVariantNumeric:"tabular-nums",
              }}>{v.toFixed(1)}</div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function Analytics() {
  // Subject avg matrix by class
  const subjects = ["Матем.", "Рус.яз.", "Кырг.т.", "Англ.", "Физика", "Химия", "Биол.", "История", "Геогр.", "Инфор."];
  const classes = ["5А", "6А", "7А", "7Б", "8А", "8Б", "9А", "9Б", "10А", "11А"];

  // Deterministic matrix
  function gen(i, j) {
    const base = 4.0;
    const v = base + Math.sin(i * 1.3 + j * 0.7) * 0.6 + Math.cos(j * 0.5) * 0.3;
    return Math.max(2.5, Math.min(5, v));
  }
  const matrix = classes.map((_, ri) => subjects.map((_, ci) => gen(ri, ci)));

  return (
    <div className="content">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24}}>
        <div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>Аналитика школы</div>
          <div style={{fontSize:13.5, color:"var(--gray-500)", marginTop:4}}>I четверть 2025/26 · обновлено сегодня в 06:00</div>
        </div>
        <div className="row" style={{gap:8}}>
          <select className="select" style={{width:160}}>
            <option>I четверть</option><option>II четверть</option><option>Весь год</option>
          </select>
          <button className="btn btn-secondary"><Icons.Filter size={16}/>Все классы</button>
          <button className="btn btn-primary"><Icons.Download size={16}/>Экспорт</button>
        </div>
      </div>

      {/* KPI bar */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:12, marginBottom:24}}>
        {[
          { l:"Средний балл", v:"4.21", d:"+0.08", up:true, c:"var(--brand-600)" },
          { l:"Качество знаний", v:"68%", d:"+3%", up:true, c:"var(--green-600)" },
          { l:"Успеваемость", v:"94.6%", d:"+0.4%", up:true, c:"var(--green-600)" },
          { l:"Посещаемость", v:"94.2%", d:"-0.6%", up:false, c:"var(--yellow-600)" },
          { l:"Группа риска", v:"38", d:"-5", up:true, c:"var(--red-600)" },
          { l:"Отличников", v:"187", d:"+12", up:true, c:"var(--violet-600)" },
        ].map((k, i) => (
          <div key={i} className="card" style={{padding:"16px 18px"}}>
            <div style={{fontSize:11.5, color:"var(--gray-500)", fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22, fontWeight:700, color:"var(--gray-900)", marginTop:6, letterSpacing:"-0.02em"}}>{k.v}</div>
            <div className="row" style={{gap:4, marginTop:2}}>
              <span style={{fontSize:11.5, fontWeight:600, color: k.up ? "var(--green-700)" : "var(--red-700)"}}>{k.up ? "↑" : "↓"} {k.d}</span>
              <span style={{fontSize:11, color:"var(--gray-400)"}}>от пр. четв.</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, marginBottom:16}}>
        {/* Subjects bars */}
        <div className="card card-pad">
          <div className="section-header">
            <div>
              <div className="section-title">Средний балл по предметам</div>
              <div className="section-sub">Сравнение с прошлой четвертью</div>
            </div>
            <button className="btn btn-ghost btn-sm">Подробнее<Icons.ChevronRight size={14}/></button>
          </div>
          <div className="col" style={{gap:10, marginTop:6}}>
            {[
              { s:"Английский язык", v:4.52, prev:4.41 },
              { s:"Биология", v:4.42, prev:4.38 },
              { s:"Информатика", v:4.38, prev:4.21 },
              { s:"История Кыргызстана", v:4.31, prev:4.28 },
              { s:"Литература", v:4.25, prev:4.30 },
              { s:"Математика", v:4.18, prev:4.10 },
              { s:"Физика", v:4.05, prev:3.92 },
              { s:"Химия", v:3.94, prev:4.01 },
              { s:"Русский язык", v:3.88, prev:3.85 },
            ].map((row, i) => {
              const w = ((row.v - 3) / 2) * 100;
              const prevW = ((row.prev - 3) / 2) * 100;
              const diff = row.v - row.prev;
              return (
                <div key={i}>
                  <div className="row" style={{justifyContent:"space-between", marginBottom:5}}>
                    <span style={{fontSize:13, color:"var(--gray-800)", fontWeight:500}}>{row.s}</span>
                    <div className="row" style={{gap:8}}>
                      <span className="mono" style={{fontSize:13, fontWeight:700, color:"var(--gray-900)"}}>{row.v.toFixed(2)}</span>
                      <span style={{fontSize:11, fontWeight:600, color: diff >= 0 ? "var(--green-700)" : "var(--red-700)", width:42, textAlign:"right"}}>
                        {diff >= 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div style={{position:"relative", height:8, background:"var(--gray-75)", borderRadius:4}}>
                    {/* Previous (ghost) */}
                    <div style={{position:"absolute", left:0, top:0, bottom:0, width:`${prevW}%`, background:"var(--gray-200)", borderRadius:4}}/>
                    {/* Current */}
                    <div style={{position:"absolute", left:0, top:0, bottom:0, width:`${w}%`, background: row.v >= 4.3 ? "var(--green-500)" : row.v >= 4.0 ? "var(--brand-500)" : "var(--yellow-500)", borderRadius:4}}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{gap:16, marginTop:14, paddingTop:14, borderTop:"1px solid var(--gray-100)"}}>
            <div className="row" style={{gap:6}}>
              <div style={{width:14, height:6, background:"var(--gray-200)", borderRadius:2}}/>
              <span style={{fontSize:11.5, color:"var(--gray-500)"}}>Прошлая четверть</span>
            </div>
            <div className="row" style={{gap:6}}>
              <div style={{width:14, height:6, background:"var(--brand-500)", borderRadius:2}}/>
              <span style={{fontSize:11.5, color:"var(--gray-500)"}}>Текущая</span>
            </div>
          </div>
        </div>

        {/* Grade distribution donut + bar */}
        <div className="card card-pad">
          <div className="section-header">
            <div>
              <div className="section-title">Распределение оценок</div>
              <div className="section-sub">14 822 оценок за четверть</div>
            </div>
          </div>
          <div className="row" style={{gap:24, marginTop:14, alignItems:"center", justifyContent:"center"}}>
            {/* SVG donut with 4 segments */}
            <div style={{position:"relative"}}>
              <svg width="180" height="180" viewBox="0 0 36 36" style={{transform:"rotate(-90deg)"}}>
                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--gray-100)" strokeWidth="4"/>
                {(() => {
                  const segs = [
                    { v: 42, c: "var(--green-500)" },
                    { v: 34, c: "var(--brand-500)" },
                    { v: 18, c: "var(--yellow-500)" },
                    { v: 6, c: "var(--red-500)" },
                  ];
                  const C = 2 * Math.PI * 14;
                  let off = 0;
                  return segs.map((s, i) => {
                    const len = (s.v / 100) * C;
                    const el = (
                      <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={s.c} strokeWidth="4"
                              strokeDasharray={`${len} ${C}`} strokeDashoffset={-off}
                              strokeLinecap="butt"/>
                    );
                    off += len;
                    return el;
                  });
                })()}
              </svg>
              <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center"}}>
                <div>
                  <div className="mono" style={{fontSize:26, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>4.21</div>
                  <div style={{fontSize:11, color:"var(--gray-500)", fontWeight:500, marginTop:-2}}>средний балл</div>
                </div>
              </div>
            </div>
            <div style={{flex:1}}>
              {[
                { l:"Отлично (5)", v:42, n:"6225", c:"var(--green-500)" },
                { l:"Хорошо (4)", v:34, n:"5039", c:"var(--brand-500)" },
                { l:"Удовл. (3)", v:18, n:"2668", c:"var(--yellow-500)" },
                { l:"Неуд. (2)", v:6, n:"890", c:"var(--red-500)" },
              ].map((s, i) => (
                <div key={i} className="row" style={{gap:10, marginBottom:10}}>
                  <div style={{width:10, height:10, borderRadius:3, background:s.c}}/>
                  <span style={{flex:1, fontSize:13, color:"var(--gray-700)"}}>{s.l}</span>
                  <span style={{fontSize:13, fontWeight:700, color:"var(--gray-900)"}}>{s.v}%</span>
                  <span style={{fontSize:11, color:"var(--gray-400)", width:48, textAlign:"right"}}>{s.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card card-pad" style={{marginBottom:16}}>
        <div className="section-header">
          <div>
            <div className="section-title">Тепловая карта успеваемости</div>
            <div className="section-sub">Средний балл по классу и предмету</div>
          </div>
          <div className="row" style={{gap:8}}>
            <span style={{fontSize:11.5, color:"var(--gray-500)"}}>Шкала:</span>
            <div className="row" style={{gap:4}}>
              <span style={{fontSize:11, color:"var(--red-700)"}}>2.5</span>
              <div style={{width:80, height:8, borderRadius:4, background:"linear-gradient(to right, #fa5252, #fab005, #40c057)"}}/>
              <span style={{fontSize:11, color:"var(--green-700)"}}>5.0</span>
            </div>
          </div>
        </div>
        <div style={{marginTop:14, overflow:"auto"}}>
          <Heatmap data={matrix} rows={classes} cols={subjects} max={5}/>
        </div>
      </div>

      {/* Bottom: trend + top/bottom */}
      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16}}>
        <div className="card card-pad">
          <div className="section-header">
            <div>
              <div className="section-title">Динамика среднего балла</div>
              <div className="section-sub">5 параллелей · последние 4 четверти</div>
            </div>
          </div>
          <div style={{marginTop:8}}>
            <svg width="100%" height="240" viewBox="0 0 600 240" preserveAspectRatio="none">
              {/* grid */}
              {[3.5, 4.0, 4.5, 5.0].map((y, i) => {
                const yPos = 30 + (5 - y) / 1.5 * 180;
                return (
                  <g key={i}>
                    <line x1="40" y1={yPos} x2="600" y2={yPos} stroke="var(--gray-100)" strokeWidth="1"/>
                    <text x="32" y={yPos+4} fontSize="10" textAnchor="end" fill="var(--gray-400)">{y.toFixed(1)}</text>
                  </g>
                );
              })}
              {/* x labels */}
              {["IV 24/25", "I 25/26", "II 25/26", "Сейчас"].map((l, i) => (
                <text key={i} x={50 + i * 185} y="230" fontSize="11" fill="var(--gray-500)" fontWeight="500">{l}</text>
              ))}
              {/* Lines */}
              {(() => {
                const series = [
                  { name:"5-6 классы", data:[4.35, 4.32, 4.38, 4.38], c:"#228be6" },
                  { name:"7-8 классы", data:[4.05, 4.12, 4.18, 4.18], c:"#37b24d" },
                  { name:"9 классы", data:[3.95, 4.02, 4.08, 4.08], c:"#fab005" },
                  { name:"10-11 классы", data:[4.42, 4.38, 4.45, 4.47], c:"#7950f2" },
                ];
                return series.map((s, si) => {
                  const pts = s.data.map((v, i) => [50 + i * 185, 30 + (5 - v) / 1.5 * 180]);
                  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
                  return (
                    <g key={si}>
                      <path d={d} fill="none" stroke={s.c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="white" stroke={s.c} strokeWidth="2"/>)}
                    </g>
                  );
                });
              })()}
            </svg>
            <div className="row" style={{gap:18, marginTop:8, flexWrap:"wrap"}}>
              {[
                { name:"5-6 классы", c:"#228be6" },
                { name:"7-8 классы", c:"#37b24d" },
                { name:"9 классы", c:"#fab005" },
                { name:"10-11 классы", c:"#7950f2" },
              ].map((s, i) => (
                <div key={i} className="row" style={{gap:6}}>
                  <div style={{width:10, height:2.5, background:s.c, borderRadius:2}}/>
                  <span style={{fontSize:12, color:"var(--gray-600)"}}>{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top + risks */}
        <div className="col" style={{gap:16}}>
          <div className="card card-pad">
            <div className="section-header">
              <div className="section-title">Топ учеников</div>
              <button className="btn btn-ghost btn-sm">Все<Icons.ChevronRight size={13}/></button>
            </div>
            <div className="col" style={{gap:0, marginTop:6}}>
              {[
                { n:"Курманбекова Айсулуу", c:"11А", g:4.97, i:1, av:"av-pink", init:"КА" },
                { n:"Бекмуратова Айгерим", c:"8А", g:4.92, i:2, av:"av-violet", init:"БА" },
                { n:"Маматов Бекзат", c:"10А", g:4.88, i:3, av:"av-blue", init:"МБ" },
                { n:"Тилекова Айдай", c:"9А", g:4.85, i:4, av:"av-teal", init:"ТА" },
              ].map(t => (
                <div key={t.i} className="row" style={{padding:"8px 0", borderBottom: t.i === 4 ? "none" : "1px solid var(--gray-100)", gap:10}}>
                  <span style={{width:20, fontSize:11.5, fontWeight:700, color: t.i === 1 ? "var(--yellow-700)" : "var(--gray-400)", textAlign:"center"}}>{t.i}</span>
                  <div className={`avatar sm ${t.av}`}>{t.init}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:600, color:"var(--gray-900)"}}>{t.n}</div>
                    <div style={{fontSize:11.5, color:"var(--gray-500)"}}>{t.c}</div>
                  </div>
                  <span className="mono" style={{fontSize:14, fontWeight:700, color:"var(--green-700)"}}>{t.g.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-header">
              <div>
                <div className="section-title">Предметы с просадкой</div>
                <div className="section-sub">Падение более чем на 0.05</div>
              </div>
            </div>
            <div className="col" style={{gap:8, marginTop:6}}>
              {[
                { s:"Химия", d:-0.07, t:"Анара Эркинбекова" },
                { s:"Литература", d:-0.05, t:"Гульнара Турдубаева" },
              ].map((r, i) => (
                <div key={i} style={{padding:"10px 12px", background:"var(--red-50)", border:"1px solid var(--red-100)", borderRadius:8}}>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span style={{fontSize:13, fontWeight:600, color:"var(--gray-900)"}}>{r.s}</span>
                    <span style={{fontSize:13, fontWeight:700, color:"var(--red-700)"}}>↓ {Math.abs(r.d).toFixed(2)}</span>
                  </div>
                  <div style={{fontSize:11.5, color:"var(--gray-600)", marginTop:2}}>учитель: {r.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Analytics = Analytics;
