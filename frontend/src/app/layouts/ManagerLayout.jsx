import styles from "./AppShell.module.css";
import AppHeader from "./AppHeader";

export default function ManagerLayout({ name, children }) {
  return (
    <div className={styles.page}>
      <div className={styles.managerContainer}>
        <AppHeader name={name} />
        <div className={styles.managerBody}>{children}</div>
      </div>
    </div>
  );
}
