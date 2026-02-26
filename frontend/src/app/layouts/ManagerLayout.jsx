// import styles from "./AppShell.module.css";

// const MENU = [
//   { key: "PREFS",     label: "希望シフト", icon: "📅" },
//   { key: "SHIFTS",    label: "Manager",    icon: "⚙️" },
//   { key: "EMPLOYEES", label: "Employees",  icon: "👥" },
// ];

// export default function ManagerLayout({ name, view, onNavigate, onLogout, children }) {
//   return (
//     <div className={styles.managerShell}>
//       {/* ── Sidebar ── */}
//       <aside className={styles.sidebar}>
//         <div className={styles.sidebarLogo}>
//           <span className={styles.sidebarLogoIcon}>🍽</span>
//           <span className={styles.sidebarLogoText}>ShiftApp</span>
//         </div>

//         <nav className={styles.sidebarNav}>
//           {MENU.map((item) => (
//             <button
//               key={item.key}
//               className={`${styles.sidebarItem} ${view === item.key ? styles.sidebarItemActive : ""}`}
//               onClick={() => onNavigate(item.key)}
//               type="button"
//             >
//               <span className={styles.sidebarIcon}>{item.icon}</span>
//               <span className={styles.sidebarLabel}>{item.label}</span>
//             </button>
//           ))}
//         </nav>

//         <div className={styles.sidebarFooter}>
//           <div className={styles.sidebarUser}>
//             <span className={styles.sidebarUserAvatar}>
//               {(name || "M")[0].toUpperCase()}
//             </span>
//             <span className={styles.sidebarUserName}>{name}</span>
//           </div>
//           <button className={styles.sidebarLogout} onClick={onLogout} type="button">
//             Logout
//           </button>
//         </div>
//       </aside>

//       {/* ── Main content ── */}
//       <main className={styles.managerMain}>
//         {children}
//       </main>
//     </div>
//   );
// }

import styles from "./AppShell.module.css";

const MANAGER_MENU = [
  { key: "SHIFTS",    label: "Manager",    icon: "⚙️" },
  { key: "EMPLOYEES", label: "Employees",  icon: "👥" },
];

export default function ManagerLayout({ name, view, onNavigate, onLogout, children }) {
  return (
    <div className={styles.managerShell}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.sidebarLogoIcon}>🍽</span>
          <span className={styles.sidebarLogoText}>ShiftApp</span>
        </div>

        {/* Верхнее меню — менеджерские функции */}
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
            </button>
          ))}
        </nav>

        {/* Нижняя часть — личные смены + пользователь + logout */}
        <div className={styles.sidebarFooter}>
          {/* Личные смены — привязаны к имени пользователя */}
          <button
            className={`${styles.sidebarItemPersonal} ${view === "PREFS" ? styles.sidebarItemActive : ""}`}
            onClick={() => onNavigate("PREFS")}
            type="button"
          >
            <div className={styles.sidebarUserAvatar}>
              {(name || "M")[0].toUpperCase()}
            </div>
            <div className={styles.sidebarPersonalInfo}>
              <span className={styles.sidebarUserName}>{name}</span>
              <span className={styles.sidebarPersonalHint}>📅 希望シフト</span>
            </div>
          </button>

          <button className={styles.sidebarLogout} onClick={onLogout} type="button">
            Logout
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