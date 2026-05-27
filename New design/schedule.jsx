/* global React, Icons, MOCK */
const { useState: useSchS } = React;

const COLOR_MAP = {
  blue:   { bg:"#e7f5ff", border:"#74c0fc", text:"#1864ab", strip:"#228be6" },
  pink:   { bg:"#fff0f6", border:"#faa2c1", text:"#c2255c", strip:"#e64980" },
  green:  { bg:"#ebfbee", border:"#8ce99a", text:"#2b8a3e", strip:"#37b24d" },
  orange: { bg:"#fff4e6", border:"#ffc078", text:"#d9480f", strip:"#fd7e14" },
  yellow: { bg:"#fff9db", border:"#ffe066", text:"#974b00", strip:"#fab005" },
  teal:   { bg:"#e6fcf5", border:"#63e6be", text:"#087f5b", strip:"#12b886" },
  red:    { bg:"#fff5f5", border:"#ffa8a8", text:"#c92a2a", strip:"#fa5252" },
  violet: { bg:"#f3f0ff", border:"#b197fc", text:"#5f3dc4", strip:"#7950f2" },
  gray:   { bg:"#f1f3f5", border:"#ced4da", text:"#495057", strip:"#868e96" },
};

function Schedule() {
  const [view, setView] = useSchS("week");
  const todayIdx = 0; // Monday for the demo

  const maxLessons = Math.max(...MOCK.SCHEDULE_8A.map(d => d.length));
  const timeSlots = Array.from({length: maxLessons}, (_, i) => MOCK.SCHEDULE_8A.find(d => d[i])?.[i]);

  return (
    <div className="content">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18}}>
        <div>
          <div style={{fontSize:24, fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.02em"}}>
            Расписание · 8А
          </div>
          <div style={{fontSize:13.5, color:"var(--gray-500)", marginTop:4}}>
            I четверть · Неделя 9 · Классный руководитель: Орозова А.К.
          </div>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn btn-secondary"><Icons.Download size={16}/>PDF</button>
          <button className="btn btn-secondary"><Icons.Pencil size={16}/>Редактировать</button>
        </div>
      </div>

      {/* Controls */}
      <div className="row" style={{gap:8, marginBottom:16, flexWrap:"wrap"}}>
        <div className="row" style={{gap:8}}>
          <button className="icon-btn"><Icons.ChevronLeft size={16}/></button>
          <div className="card" style={{padding:"6px 14px", fontSize:13.5, fontWeight:600, display:"flex", alignItems:"center", gap:6}}>
            <Icons.Calendar size={14} style={{color:"var(--gray-500)"}}/>
            28 окт — 2 ноя 2025
          </div>
          <button className="icon-btn"><Icons.ChevronRight size={16}/></button>
          <button className="btn btn-ghost btn-sm">Сегодня</button>
        </div>
        <div style={{flex:1}}/>
        <div className="row" style={{gap:4, padding:4, background:"var(--gray-100)", borderRadius:8}}>
          {[{id:"day", label:"День"}, {id:"week", label:"Неделя"}, {id:"list", label:"Список"}].map(v => {
            const active = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding:"6px 14px", border:"none",
                background: active ? "white" : "transparent",
                color: active ? "var(--gray-900)" : "var(--gray-500)",
                borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer",
                boxShadow: active ? "var(--shadow-xs)" : "none",
              }}>{v.label}</button>
            );
          })}
        </div>
        <select className="select" style={{width:120, height:36}}>
          <option>8А</option><option>8Б</option><option>9А</option>
        </select>
      </div>

      {/* Week grid */}
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{display:"grid", gridTemplateColumns:"80px repeat(6, 1fr)", borderBottom:"1px solid var(--gray-150)"}}>
          <div style={{padding:"14px 12px", background:"var(--gray-50)", fontSize:11, fontWeight:600, color:"var(--gray-500)", textTransform:"uppercase", letterSpacing:"0.04em"}}>Время</div>
          {MOCK.WEEKDAYS.map((d, i) => {
            const isToday = i === todayIdx;
            return (
              <div key={i} style={{
                padding:"14px 12px",
                background: isToday ? "var(--brand-50)" : "var(--gray-50)",
                borderLeft:"1px solid var(--gray-150)",
              }}>
                <div style={{fontSize:11, fontWeight:600, color: isToday ? "var(--brand-700)" : "var(--gray-500)", textTransform:"uppercase", letterSpacing:"0.04em"}}>
                  {d}
                </div>
                <div style={{fontSize:18, fontWeight:700, color:isToday ? "var(--brand-800)" : "var(--gray-900)", marginTop:2, letterSpacing:"-0.02em"}}>
                  {28 + i}{i === 4 ? "" : i === 5 ? "" : ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        {Array.from({length: maxLessons}, (_, slotI) => {
          const sample = MOCK.SCHEDULE_8A.find(d => d[slotI])?.[slotI];
          return (
            <div key={slotI} style={{display:"grid", gridTemplateColumns:"80px repeat(6, 1fr)", borderBottom: slotI === maxLessons - 1 ? "none" : "1px solid var(--gray-100)"}}>
              <div style={{padding:"14px 12px", borderRight:"1px solid var(--gray-100)", background:"var(--gray-25)"}}>
                <div className="mono" style={{fontSize:12.5, fontWeight:600, color:"var(--gray-900)"}}>{sample?.time}</div>
                <div style={{fontSize:10.5, color:"var(--gray-400)", fontWeight:600, marginTop:2}}>{slotI+1} урок</div>
              </div>
              {MOCK.SCHEDULE_8A.map((day, di) => {
                const l = day[slotI];
                const isToday = di === todayIdx;
                if (!l) return (
                  <div key={di} style={{
                    borderLeft:"1px solid var(--gray-100)",
                    background: isToday ? "rgba(231,245,255,0.3)" : "transparent",
                    minHeight: 88,
                  }}/>
                );
                const c = COLOR_MAP[l.color];
                return (
                  <div key={di} style={{
                    borderLeft:"1px solid var(--gray-100)",
                    background: isToday ? "rgba(231,245,255,0.3)" : "transparent",
                    padding:6,
                    minHeight: 88,
                  }}>
                    <div style={{
                      background: c.bg,
                      borderRadius:8,
                      padding:"8px 10px",
                      paddingLeft:12,
                      height:"100%",
                      position:"relative",
                      cursor:"pointer",
                      transition:"transform 0.12s",
                    }}>
                      <div style={{position:"absolute", left:0, top:8, bottom:8, width:3, background:c.strip, borderRadius:2}}/>
                      <div className="row" style={{justifyContent:"space-between", marginBottom:2}}>
                        <span style={{fontSize:13, fontWeight:600, color:c.text, lineHeight:1.3}}>{l.subj}</span>
                        {l.grade && <span className={`grade sm g${l.grade}`} style={{width:22, height:22, fontSize:11}}>{l.grade}</span>}
                      </div>
                      <div style={{fontSize:11.5, color:c.text, opacity:0.85, marginTop:2, fontWeight:500}}>
                        каб. {l.room}
                      </div>
                      <div style={{fontSize:11, color:c.text, opacity:0.7, marginTop:1}}>
                        {l.teacher}
                      </div>
                      {l.badge && (
                        <div style={{
                          position:"absolute", top:6, right:6,
                          fontSize:9.5, fontWeight:700, color:"var(--red-700)",
                          background:"var(--red-100)", padding:"1px 5px", borderRadius:4,
                          textTransform:"uppercase", letterSpacing:"0.04em",
                        }}>{l.badge}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom strip */}
      <div className="row" style={{gap:16, marginTop:16, flexWrap:"wrap"}}>
        <div className="card" style={{padding:"14px 18px", flex:1, minWidth:240, display:"flex", alignItems:"center", gap:14}}>
          <div style={{width:36, height:36, borderRadius:10, background:"var(--brand-50)", color:"var(--brand-700)", display:"grid", placeItems:"center"}}>
            <Icons.Clock size={18}/>
          </div>
          <div>
            <div style={{fontSize:12, color:"var(--gray-500)", fontWeight:500}}>Сейчас идёт</div>
            <div style={{fontSize:14, fontWeight:600, color:"var(--gray-900)"}}>Математика · каб. 212</div>
            <div style={{fontSize:11.5, color:"var(--gray-500)"}}>До звонка 23 минуты</div>
          </div>
        </div>
        <div className="card" style={{padding:"14px 18px", flex:1, minWidth:240, display:"flex", alignItems:"center", gap:14}}>
          <div style={{width:36, height:36, borderRadius:10, background:"var(--green-100)", color:"var(--green-700)", display:"grid", placeItems:"center"}}>
            <Icons.Calendar size={18}/>
          </div>
          <div>
            <div style={{fontSize:12, color:"var(--gray-500)", fontWeight:500}}>Следующий урок</div>
            <div style={{fontSize:14, fontWeight:600, color:"var(--gray-900)"}}>Русский язык · каб. 104</div>
            <div style={{fontSize:11.5, color:"var(--gray-500)"}}>Турдубаева Г.И., через 33 мин</div>
          </div>
        </div>
        <div className="card" style={{padding:"14px 18px", flex:1, minWidth:240, display:"flex", alignItems:"center", gap:14}}>
          <div style={{width:36, height:36, borderRadius:10, background:"var(--red-50)", color:"var(--red-700)", display:"grid", placeItems:"center"}}>
            <Icons.AlertCircle size={18}/>
          </div>
          <div>
            <div style={{fontSize:12, color:"var(--gray-500)", fontWeight:500}}>Важно на неделе</div>
            <div style={{fontSize:14, fontWeight:600, color:"var(--gray-900)"}}>Контрольная по геометрии</div>
            <div style={{fontSize:11.5, color:"var(--gray-500)"}}>Четверг, 31 окт · 1 урок</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Schedule = Schedule;
