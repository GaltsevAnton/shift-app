import styles from "./AppLayout.module.css";
import AppHeader from "./AppHeader";

export default function AppLayout({ name, children }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <AppHeader name={name} />
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </div>
  );
}
