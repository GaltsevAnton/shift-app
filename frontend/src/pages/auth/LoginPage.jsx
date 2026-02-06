import styles from "../../features/auth/components/LoginPage.module.css";
import LoginForm from "../../features/auth/components/LoginForm";

import AppLayout from "../../app/layouts/AppLayout";

export default function LoginPage({ onLoggedIn }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Login</h2>
          <p className={styles.sub}>役割を選択してログインしてください</p>
        </div>

        <div className={styles.body}>
          <LoginForm onLoggedIn={onLoggedIn} />
        </div>
      </div>
    </div>
  );
}
