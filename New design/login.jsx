/* global React, Icons */
const { useState: useS } = React;

function Login({ onEnter }) {
  const [pwShown, setPwShown] = useS(false);
  const [login, setLogin] = useS("admin1");
  const [pw, setPw] = useS("erudit2025");
  const [role, setRoleSel] = useS("admin");

  return (
    <div style={{
      minHeight:"100vh",
      display:"grid",
      gridTemplateColumns:"1fr 1.1fr",
      background:"var(--gray-0)",
    }}>
      {/* LEFT: Form */}
      <div style={{
        display:"flex", flexDirection:"column",
        padding:"40px 64px",
        justifyContent:"space-between",
        maxWidth:560,
        margin:"0 auto",
        width:"100%",
      }}>
        <div className="row" style={{gap:12}}>
          <div className="brand-mark" style={{width:40, height:40, fontSize:18, borderRadius:10}}>E</div>
          <div>
            <div style={{fontSize:18, fontWeight:700, letterSpacing:"-0.02em", color:"var(--gray-900)"}}>ERUDIT</div>
            <div style={{fontSize:12, color:"var(--gray-500)", fontWeight:500}}>Школьная ERP-система</div>
          </div>
        </div>

        <div>
          <div style={{fontSize:13, color:"var(--brand-700)", fontWeight:600, letterSpacing:"0.02em", marginBottom:12}}>
            Добро пожаловать
          </div>
          <h1 style={{
            fontSize:36, fontWeight:700, letterSpacing:"-0.025em",
            color:"var(--gray-900)", margin:0, lineHeight:1.15
          }}>
            Войдите в свой кабинет
          </h1>
          <p style={{fontSize:15, color:"var(--gray-500)", marginTop:14, lineHeight:1.55, maxWidth:420}}>
            Цифровой кабинет для директоров, учителей, учеников и родителей школы.
            Все ваши данные синхронизируются в режиме реального времени.
          </p>

          {/* Role tabs */}
          <div style={{display:"flex", gap:6, marginTop:32, padding:4, background:"var(--gray-75)", borderRadius:10, width:"fit-content"}}>
            {[
              {id:"admin", label:"Школа"},
              {id:"teacher", label:"Учитель"},
              {id:"student", label:"Ученик"},
              {id:"parent", label:"Родитель"},
            ].map(t => (
              <button key={t.id}
                onClick={() => setRoleSel(t.id)}
                style={{
                  padding:"8px 16px",
                  border:"none",
                  borderRadius:7,
                  fontSize:13,
                  fontWeight:600,
                  background: role === t.id ? "white" : "transparent",
                  color: role === t.id ? "var(--gray-900)" : "var(--gray-500)",
                  boxShadow: role === t.id ? "var(--shadow-sm)" : "none",
                  cursor:"pointer",
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Form */}
          <div style={{marginTop:24, display:"flex", flexDirection:"column", gap:14, maxWidth:420}}>
            <div>
              <label style={{fontSize:12.5, fontWeight:600, color:"var(--gray-700)", display:"block", marginBottom:6}}>
                Логин или email
              </label>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--gray-400)"}}>
                  <Icons.User size={17}/>
                </span>
                <input className="input lg" value={login} onChange={e=>setLogin(e.target.value)} style={{paddingLeft:38}} />
              </div>
            </div>

            <div>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                <label style={{fontSize:12.5, fontWeight:600, color:"var(--gray-700)"}}>Пароль</label>
                <a href="#" style={{fontSize:12.5, color:"var(--brand-700)", fontWeight:600, textDecoration:"none"}}>Забыли пароль?</a>
              </div>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--gray-400)"}}>
                  <Icons.Lock size={17}/>
                </span>
                <input
                  className="input lg"
                  type={pwShown?"text":"password"}
                  value={pw}
                  onChange={e=>setPw(e.target.value)}
                  style={{paddingLeft:38, paddingRight:42}}
                />
                <button onClick={()=>setPwShown(!pwShown)} style={{position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", border:"none", background:"transparent", padding:6, cursor:"pointer", color:"var(--gray-400)"}}>
                  {pwShown ? <Icons.EyeOff size={17}/> : <Icons.Eye size={17}/>}
                </button>
              </div>
            </div>

            <label style={{display:"flex", alignItems:"center", gap:8, fontSize:13, color:"var(--gray-700)", cursor:"pointer", marginTop:4}}>
              <input type="checkbox" defaultChecked style={{accentColor:"var(--brand-600)", width:16, height:16}}/>
              Запомнить меня на этом устройстве
            </label>

            <button className="btn btn-primary btn-lg" onClick={() => onEnter(role)} style={{marginTop:6, width:"100%", justifyContent:"center"}}>
              Войти в кабинет
              <Icons.ArrowRight size={17}/>
            </button>

            <div style={{display:"flex", alignItems:"center", gap:12, margin:"10px 0", color:"var(--gray-400)", fontSize:12}}>
              <div style={{flex:1, height:1, background:"var(--gray-150)"}} />
              или
              <div style={{flex:1, height:1, background:"var(--gray-150)"}} />
            </div>

            <button className="btn btn-secondary btn-lg" style={{width:"100%", justifyContent:"center"}}>
              <Icons.Globe size={17}/> Войти через ЕГСУ
            </button>
          </div>
        </div>

        <div style={{fontSize:12, color:"var(--gray-400)", display:"flex", justifyContent:"space-between"}}>
          <span>© 2026 ERUDIT · Школа №12 им. Чыңгыза Айтматова</span>
          <span>v2.4.1</span>
        </div>
      </div>

      {/* RIGHT: Visual panel */}
      <div style={{
        background:"linear-gradient(135deg, #1864ab 0%, #1971c2 35%, #228be6 100%)",
        position:"relative",
        overflow:"hidden",
        display:"flex",
        flexDirection:"column",
        padding:"48px",
        color:"white",
      }}>
        {/* Decorative SVG */}
        <svg style={{position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.18}} preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div style={{
          position:"absolute", right:-180, top:-160, width:520, height:520,
          background:"radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)",
          borderRadius:"50%",
        }} />
        <div style={{
          position:"absolute", left:-140, bottom:-200, width:480, height:480,
          background:"radial-gradient(circle, rgba(116,192,252,0.32), transparent 70%)",
          borderRadius:"50%",
        }} />

        <div style={{position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", justifyContent:"center", maxWidth:560}}>
          <div className="tag" style={{background:"rgba(255,255,255,0.18)", color:"white", backdropFilter:"blur(8px)", width:"fit-content", fontSize:12}}>
            <span className="tag-dot" style={{background:"#69db7c"}} /> Новое в этом году
          </div>
          <h2 style={{fontSize:40, fontWeight:700, letterSpacing:"-0.025em", lineHeight:1.15, marginTop:18}}>
            Школа, в которой&nbsp;всё&nbsp;на&nbsp;своих местах.
          </h2>
          <p style={{fontSize:16, lineHeight:1.55, marginTop:18, color:"rgba(255,255,255,0.85)", maxWidth:480}}>
            Журналы, расписание, аналитика и связь с родителями — единая платформа для школ Кыргызстана.
          </p>

          {/* Floating cards */}
          <div style={{marginTop:48, display:"flex", flexDirection:"column", gap:14, maxWidth:420}}>
            <div style={{
              background:"rgba(255,255,255,0.12)",
              border:"1px solid rgba(255,255,255,0.18)",
              borderRadius:14,
              padding:16,
              backdropFilter:"blur(12px)",
              display:"flex", alignItems:"center", gap:14,
            }}>
              <div style={{width:42, height:42, borderRadius:10, background:"rgba(255,255,255,0.18)", display:"grid", placeItems:"center"}}>
                <Icons.Sparkles size={20}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:14.5}}>Автоматическая аналитика</div>
                <div style={{fontSize:13, color:"rgba(255,255,255,0.75)", marginTop:2}}>Тренды успеваемости и группы риска</div>
              </div>
            </div>
            <div style={{
              background:"rgba(255,255,255,0.12)",
              border:"1px solid rgba(255,255,255,0.18)",
              borderRadius:14,
              padding:16,
              backdropFilter:"blur(12px)",
              display:"flex", alignItems:"center", gap:14,
              marginLeft:32,
            }}>
              <div style={{width:42, height:42, borderRadius:10, background:"rgba(255,255,255,0.18)", display:"grid", placeItems:"center"}}>
                <Icons.MessageSquare size={20}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:14.5}}>Прямая связь с родителями</div>
                <div style={{fontSize:13, color:"rgba(255,255,255,0.75)", marginTop:2}}>Уведомления в Telegram и WhatsApp</div>
              </div>
            </div>
            <div style={{
              background:"rgba(255,255,255,0.12)",
              border:"1px solid rgba(255,255,255,0.18)",
              borderRadius:14,
              padding:16,
              backdropFilter:"blur(12px)",
              display:"flex", alignItems:"center", gap:14,
              marginLeft:64,
            }}>
              <div style={{width:42, height:42, borderRadius:10, background:"rgba(255,255,255,0.18)", display:"grid", placeItems:"center"}}>
                <Icons.School size={20}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:14.5}}>Адаптировано для школ КР</div>
                <div style={{fontSize:13, color:"rgba(255,255,255,0.75)", marginTop:2}}>5-балльная шкала, двуязычие, ЕГСУ</div>
              </div>
            </div>
          </div>

          <div style={{marginTop:48, display:"flex", gap:32}}>
            <div>
              <div style={{fontSize:32, fontWeight:700, letterSpacing:"-0.02em"}}>140+</div>
              <div style={{fontSize:13, color:"rgba(255,255,255,0.75)"}}>школ в системе</div>
            </div>
            <div>
              <div style={{fontSize:32, fontWeight:700, letterSpacing:"-0.02em"}}>87K</div>
              <div style={{fontSize:13, color:"rgba(255,255,255,0.75)"}}>учеников</div>
            </div>
            <div>
              <div style={{fontSize:32, fontWeight:700, letterSpacing:"-0.02em"}}>99.9%</div>
              <div style={{fontSize:13, color:"rgba(255,255,255,0.75)"}}>uptime</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
