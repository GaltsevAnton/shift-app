import styles from "./AppShell.module.css";

/* ─── Иконки меню (тонкие линии, один стиль) ─────────────── */
const ICON_PROPS = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};

function IconCalendar() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M7.5 13h1M11.5 13h1M15.5 13h1M7.5 16.5h1M11.5 16.5h1" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <circle cx="16.8" cy="9.5" r="2.5" />
      <path d="M16.5 13.6c2.3.2 4 2 4 4.6" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 20V14M10 20V9M15 20V12M20 20V5" />
    </svg>
  );
}
export function IconUser() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  );
}
export function IconLogout() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 4H7a2 2 0 00-2 2v12a2 2 0 002 2h7" />
      <path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

const MANAGER_MENU = [
  { key: "SHIFTS",     label: "シフト管理", Icon: IconCalendar },
  { key: "ATTENDANCE", label: "勤怠管理",   Icon: IconClock },
  { key: "EMPLOYEES",  label: "ユーザー",   Icon: IconUsers },
  { key: "SETTINGS",   label: "設定",       Icon: IconGear },
  { key: "LOGGING",    label: "Logging",    Icon: IconChart },
];

export default function ManagerLayout({ name, view, onNavigate, onLogout, children }) {
  return (
    <div className={styles.managerShell}>
      {/* ── Sidebar: узкая полоса с иконками, подпись — подсказкой при наведении ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <img src="/logo.png" alt="HannoSHIFT" className={styles.sidebarLogoImg} />
        </div>

        <nav className={styles.sidebarNav}>
          {MANAGER_MENU.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`${styles.sidebarItem} ${view === key ? styles.sidebarItemActive : ""}`}
              onClick={() => onNavigate(key)}
              aria-label={label}
              aria-current={view === key ? "page" : undefined}
              data-tip={label}
            >
              <Icon />
            </button>
          ))}
        </nav>

        {/* Личное (希望シフト) и выход — пока остаются и здесь, чтобы были на всех страницах,
            у которых ещё нет новой шапки */}
        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={`${styles.sidebarItem} ${view === "PREFS" ? styles.sidebarItemActive : ""}`}
            onClick={() => onNavigate("PREFS")}
            aria-label="希望シフト"
            data-tip={`${name || ""}｜希望シフト`}
          >
            <IconUser />
          </button>
          <button
            type="button"
            className={styles.sidebarItem}
            onClick={onLogout}
            aria-label="ログアウト"
            data-tip="ログアウト"
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      <main className={styles.managerMain}>
        {children}
      </main>
    </div>
  );
}