import styles from "./AppShell.module.css";

export default function AppHeader({ name }) {
  return (
    <div className={styles.appHeader}>
      {/* Лого добавим сюда позже */}
      <div className={styles.company}>ホテル・ヘリテイジ</div>
      <div className={styles.branch}>飯能駅</div>
      <div className={styles.userLine}>{name || "—"}</div>
    </div>
  );
}
