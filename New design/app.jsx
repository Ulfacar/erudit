/* global React, ROLES, Sidebar, Topbar, Login, Dashboard, Gradebook, Diary, Schedule, Analytics, Homework, Moderation, Students, StubPage, NAV */
/* global TweaksPanel, TweakSection, TweakRadio, TweakSlider, TweakColor, useTweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryColor": "#228be6",
  "density": "comfortable",
  "fontFamily": "Inter",
  "accent": "blue"
}/*EDITMODE-END*/;

const PRIMARY_OPTIONS = ["#228be6", "#1864ab", "#0ca678", "#7950f2", "#e8590c"];
const DENSITY_MAP = { compact: 0.88, comfortable: 1, spacious: 1.12 };
const FONT_MAP = {
  Inter: "'Inter', sans-serif",
  "IBM Plex Sans": "'IBM Plex Sans', sans-serif",
  Manrope: "'Manrope', sans-serif",
};

const PAGE_TITLES = {
  dashboard:  { t: "Дашборд",          s: "Обзор школы" },
  analytics:  { t: "Аналитика",        s: "Глубокий разрез успеваемости" },
  schedule:   { t: "Расписание",       s: "" },
  gradebook:  { t: "Журнал оценок",    s: "" },
  diary:      { t: "Дневник",          s: "" },
  homework:   { t: "Домашние задания", s: "" },
  students:   { t: "Ученики",          s: "" },
  teachers:   { t: "Учителя",          s: "" },
  reports:    { t: "Отчёты",           s: "" },
  settings:   { t: "Настройки школы",  s: "" },
  moderation: { t: "Модерация",        s: "" },
  messages:   { t: "Сообщения",        s: "" },
  grades:     { t: "Мои оценки",       s: "" },
  payments:   { t: "Платежи",          s: "" },
};

function App() {
  const [stage, setStage] = React.useState("login"); // login | app
  const [role, setRole] = React.useState("admin");
  const [page, setPage] = React.useState("dashboard");
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-600", tweaks.primaryColor);
    // Recompute a couple derived shades by mixing
    const c = tweaks.primaryColor;
    // Simple darker/lighter — keep as-is for now (use design tokens)
    root.style.setProperty("--density", DENSITY_MAP[tweaks.density] || 1);
    root.style.setProperty("--font-sans", FONT_MAP[tweaks.fontFamily] || FONT_MAP.Inter);
  }, [tweaks]);

  function renderPage() {
    if (page === "dashboard") return <Dashboard />;
    if (page === "analytics") return <Analytics />;
    if (page === "gradebook") return <Gradebook />;
    if (page === "diary") return <Diary role={role} />;
    if (page === "schedule") return <Schedule />;
    if (page === "homework") return <Homework role={role} />;
    if (page === "moderation") return <Moderation />;
    if (page === "students") return <Students />;
    if (page === "teachers") return <StubPage icon="Briefcase" title="Учителя" desc="Список педагогов, нагрузка, классное руководство, отпуска. Здесь админ управляет составом."/>;
    if (page === "reports") return <StubPage icon="FileText" title="Отчёты" desc="Сформированные отчёты для МОН КР, внутренней статистики и родительских собраний."/>;
    if (page === "settings") return <StubPage icon="Settings" title="Настройки школы" desc="Параметры учебного года, четвертей, ролевая модель, интеграции."/>;
    if (page === "messages") return <StubPage icon="MessageSquare" title="Сообщения" desc="Переписка с учителями, родителями и администрацией."/>;
    if (page === "grades") return <StubPage icon="Award" title="Мои оценки" desc="Сводка по всем предметам за четверть и год."/>;
    if (page === "payments") return <StubPage icon="FileText" title="Платежи" desc="Питание, экскурсии, родительский комитет, добровольные взносы."/>;
    return <Dashboard />;
  }

  if (stage === "login") {
    return (
      <Login onEnter={(r) => { setRole(r); setPage(NAV[r][0].id); setStage("app"); }} />
    );
  }

  const pageMeta = PAGE_TITLES[page] || { t: "ERUDIT", s: "" };

  return (
    <>
      <div className="app">
        <Sidebar role={role} page={page} setPage={setPage} />
        <div className="main">
          <Topbar
            title={pageMeta.t}
            subtitle={pageMeta.s}
            role={role}
            setRole={setRole}
            setPage={setPage}
          />
          <div style={{flex:1, overflow:"hidden", display:"flex", flexDirection:"column"}}>
            <div style={{flex:1, overflow:"auto"}}>
              {renderPage()}
            </div>
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Цвет акцента">
          <TweakColor
            label="Бренд"
            value={tweaks.primaryColor}
            options={PRIMARY_OPTIONS}
            onChange={(v) => setTweak("primaryColor", v)}
          />
        </TweakSection>
        <TweakSection label="Плотность">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            options={[
              { value: "compact", label: "Плотно" },
              { value: "comfortable", label: "Норма" },
              { value: "spacious", label: "Шире" },
            ]}
            onChange={(v) => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection label="Шрифт">
          <TweakRadio
            label="Family"
            value={tweaks.fontFamily}
            options={[
              { value: "Inter", label: "Inter" },
              { value: "IBM Plex Sans", label: "Plex" },
              { value: "Manrope", label: "Manrope" },
            ]}
            onChange={(v) => setTweak("fontFamily", v)}
          />
        </TweakSection>
        <TweakSection label="Навигация">
          <button
            className="btn btn-secondary btn-sm"
            style={{width:"100%", justifyContent:"center"}}
            onClick={() => setStage("login")}
          >
            Вернуться на экран входа
          </button>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
