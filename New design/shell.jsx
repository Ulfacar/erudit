/* global React, Icons */
const { useState } = React;

// Navigation per role
const NAV = {
  admin: [
    { id: "dashboard", label: "Дашборд", icon: "Home" },
    { id: "analytics", label: "Аналитика", icon: "Chart" },
    { id: "schedule", label: "Расписание", icon: "Calendar" },
    { id: "gradebook", label: "Журналы", icon: "Book" },
    { id: "students", label: "Ученики", icon: "Users", badge: "1247" },
    { id: "teachers", label: "Учителя", icon: "Briefcase", badge: "87" },
    { id: "reports", label: "Отчёты", icon: "FileText" },
    { id: "settings", label: "Настройки школы", icon: "Settings" },
  ],
  zavuch: [
    { id: "dashboard", label: "Дашборд", icon: "Home" },
    { id: "schedule", label: "Расписание", icon: "Calendar" },
    { id: "gradebook", label: "Журналы", icon: "Book" },
    { id: "analytics", label: "Аналитика", icon: "Chart" },
    { id: "moderation", label: "Модерация", icon: "CheckSquare", badge: "12", alert: true },
    { id: "students", label: "Ученики", icon: "Users" },
    { id: "reports", label: "Отчёты", icon: "FileText" },
  ],
  teacher: [
    { id: "gradebook", label: "Журнал оценок", icon: "Book" },
    { id: "schedule", label: "Моё расписание", icon: "Calendar" },
    { id: "homework", label: "Домашние задания", icon: "ClipboardCheck", badge: "3" },
    { id: "students", label: "Мои классы", icon: "Users" },
    { id: "messages", label: "Сообщения", icon: "MessageSquare", badge: "5", alert: true },
  ],
  student: [
    { id: "diary", label: "Дневник", icon: "Book" },
    { id: "schedule", label: "Расписание", icon: "Calendar" },
    { id: "homework", label: "Домашние задания", icon: "ClipboardCheck", badge: "5" },
    { id: "grades", label: "Мои оценки", icon: "Award" },
    { id: "messages", label: "Сообщения", icon: "MessageSquare" },
  ],
  parent: [
    { id: "diary", label: "Дневник", icon: "Book" },
    { id: "schedule", label: "Расписание", icon: "Calendar" },
    { id: "homework", label: "Домашние задания", icon: "ClipboardCheck" },
    { id: "grades", label: "Успеваемость", icon: "Chart" },
    { id: "messages", label: "Учителя", icon: "MessageSquare" },
    { id: "payments", label: "Платежи", icon: "FileText" },
  ],
};

const ROLES = {
  admin:   { name: "Айдай Бекмуратовна", role: "Директор школы", short: "Директор", av: "av-blue", init: "АБ" },
  zavuch:  { name: "Гульнара Турсуновна", role: "Завуч по УВР", short: "Завуч", av: "av-violet", init: "ГТ" },
  teacher: { name: "Айгуль Орозова", role: "Учитель математики", short: "Учитель", av: "av-pink", init: "АО" },
  student: { name: "Айдана Абдыкадырова", role: "Ученица 8А", short: "Ученик", av: "av-violet", init: "АА" },
  parent:  { name: "Тимур Абдыкадыров", role: "Родитель · 2 ребёнка", short: "Родитель", av: "av-orange", init: "ТА" },
};

function NavItem({ item, active, onClick }) {
  const Icon = Icons[item.icon];
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon"><Icon size={18} /></span>
      <span>{item.label}</span>
      {item.badge && <span className={`nav-badge ${item.alert ? "alert" : ""}`}>{item.badge}</span>}
    </button>
  );
}

function Sidebar({ role, page, setPage }) {
  const items = NAV[role];
  const user = ROLES[role];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">E</div>
        <div>
          <div className="brand-name">ERUDIT</div>
          <div className="brand-sub">Школа №12, Бишкек</div>
        </div>
      </div>

      <div className="sidebar-section-label">Меню</div>
      <nav className="sidebar-nav">
        {items.map((it) => (
          <NavItem key={it.id} item={it} active={page === it.id} onClick={() => setPage(it.id)} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className={`avatar ${user.av}`}>{user.init}</div>
          <div style={{minWidth: 0, flex: 1}}>
            <div className="user-name" style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
          <span style={{color:"var(--gray-400)"}}><Icons.Logout size={16} /></span>
        </div>
      </div>
    </aside>
  );
}

function RoleSwitcher({ role, setRole, setPage }) {
  const [open, setOpen] = useState(false);
  const opts = [
    { id: "admin",   label: "Директор", desc: "Полный доступ" },
    { id: "zavuch",  label: "Завуч", desc: "Модерация и УВР" },
    { id: "teacher", label: "Учитель", desc: "Журнал, ДЗ" },
    { id: "student", label: "Ученик", desc: "Дневник 8А" },
    { id: "parent",  label: "Родитель", desc: "2 ребёнка" },
  ];
  const current = ROLES[role];
  return (
    <div style={{position:"relative"}}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(!open)}
        style={{height:36, gap:10, paddingLeft:6}}
      >
        <div className={`avatar xs ${current.av}`}>{current.init}</div>
        <span>{current.short}</span>
        <Icons.ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{position:"fixed", inset:0, zIndex:40}} />
          <div style={{
            position:"absolute", top:"calc(100% + 8px)", right:0,
            background:"white", border:"1px solid var(--gray-150)", borderRadius:12,
            boxShadow:"var(--shadow-lg)", padding:6, minWidth:260, zIndex:50
          }}>
            <div style={{padding:"8px 12px 6px", fontSize:11, fontWeight:600, color:"var(--gray-500)", textTransform:"uppercase", letterSpacing:"0.04em"}}>
              Войти как
            </div>
            {opts.map(o => {
              const u = ROLES[o.id];
              return (
                <button
                  key={o.id}
                  onClick={() => { setRole(o.id); setPage(NAV[o.id][0].id); setOpen(false); }}
                  className="nav-item"
                  style={{margin:0, gap:12, padding:"8px 10px"}}
                >
                  <div className={`avatar sm ${u.av}`}>{u.init}</div>
                  <div style={{flex:1, textAlign:"left"}}>
                    <div style={{fontWeight:600, fontSize:13.5, color:"var(--gray-900)"}}>{o.label}</div>
                    <div style={{fontSize:11.5, color:"var(--gray-500)"}}>{o.desc}</div>
                  </div>
                  {role === o.id && <Icons.CheckCircle size={16} style={{color:"var(--brand-600)"}} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Topbar({ title, subtitle, role, setRole, setPage, actions }) {
  return (
    <div className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div style={{fontSize:12.5, color:"var(--gray-500)", marginTop:2}}>{subtitle}</div>}
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <div className="search-input">
          <Icons.Search size={15} style={{color:"var(--gray-400)"}} />
          <input placeholder="Поиск учеников, классов, материалов…" />
          <span className="kbd">⌘K</span>
        </div>
        {actions}
        <button className="icon-btn"><Icons.Inbox size={17} /></button>
        <button className="icon-btn"><Icons.Bell size={17} /><span className="dot" /></button>
        <div style={{width:1, height:24, background:"var(--gray-150)", margin:"0 4px"}} />
        <RoleSwitcher role={role} setRole={setRole} setPage={setPage} />
      </div>
    </div>
  );
}

window.NAV = NAV;
window.ROLES = ROLES;
window.Sidebar = Sidebar;
window.Topbar = Topbar;
