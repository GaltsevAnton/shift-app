import styles from "./AppShell.module.css";

const MANAGER_MENU = [
  { key: "SHIFTS",    label: "シフト管理",  icon: "📅", sub: "月" },
  { key: "EMPLOYEES", label: "従業員管理",  icon: "👥" },
  { key: "SETTINGS",  label: "設定",        icon: "⚙️" },
];

export default function ManagerLayout({ name, view, onNavigate, onLogout, children }) {
  return (
    <div className={styles.managerShell}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>

        {/* Logo / branding */}
        <div className={styles.sidebarLogo}>
          <img
            src="/logo.png"
            alt="Hotel Heritage"
            className={styles.sidebarLogoImg}
          />
          <div className={styles.sidebarLogoTexts}>
            <span className={styles.sidebarHotelName}>ホテル・ヘリテイジ</span>
            <span className={styles.sidebarAppName}>HannoSHIFT</span>
          </div>
        </div>

        <div className={styles.sidebarDivider} />

        {/* Main nav */}
        <nav className={styles.sidebarNav}>
          {MANAGER_MENU.map((item) => (
            <button
              key={item.key}
              className={`${styles.sidebarItem} ${view === item.key ? styles.sidebarItemActive : ""}`}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <span className={styles.sidebarIcon}>{item.icon}</span>
              <span className={styles.sidebarLabel}>{item.label}</span>
              {item.sub && (
                <span className={styles.sidebarBadge}>{item.sub}</span>
              )}
            </button>
          ))}

          {/* Disabled items — coming soon */}
          <button className={`${styles.sidebarItem} ${styles.sidebarItemDisabled}`} disabled type="button">
            <span className={styles.sidebarIcon}>📊</span>
            <span className={styles.sidebarLabel}>レポート</span>
            <span className={styles.sidebarSoon}>準備中</span>
          </button>
        </nav>

        {/* Footer — personal shifts + logout */}
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarDivider} />

          <button
            className={`${styles.sidebarItemPersonal} ${view === "PREFS" ? styles.sidebarItemActive : ""}`}
            onClick={() => onNavigate("PREFS")}
            type="button"
          >
            <div className={styles.sidebarUserAvatar}>
              {(name || "M")[0].toUpperCase()}
            </div>
            <div className={styles.sidebarPersonalInfo}>
              <span className={styles.sidebarUserName}>{name || "—"}</span>
              <span className={styles.sidebarPersonalHint}>📅 希望シフト</span>
            </div>
          </button>

          <button className={styles.sidebarLogout} onClick={onLogout} type="button">
            ログアウト
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={styles.managerMain}>
        {children}
      </main>
    </div>
  );
}