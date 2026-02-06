import styles from "./AppShell.module.css";
import AppHeader from "./AppHeader";

export default function StaffLayout({ name, children }) {
  return (
    <div className={styles.page}>
      <div className={styles.staffContainer}>
        <div className={styles.staffCard}>
          <AppHeader name={name} />
          <div className={styles.staffBody}>{children}</div>
        </div>
      </div>
    </div>
  );
}
