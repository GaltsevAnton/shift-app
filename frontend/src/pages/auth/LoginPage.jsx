import styles from "../../features/auth/components/LoginPage.module.css";
import LoginForm from "../../features/auth/components/LoginForm";

export default function LoginPage({ onLoggedIn }) {
  return (
    <div className={styles.page}>
      {/* Декоративные круги фона */}
      <span className={styles.decoTop} aria-hidden="true" />
      <span className={styles.decoBottom} aria-hidden="true" />

      <main className={styles.inner}>
        {/* Логотип */}
        <div className={styles.brand}>
          <img src="/logo.png" alt="" className={styles.brandLogo} />
          <div className={styles.brandTexts}>
            <span className={styles.brandHotel}>ホテル・ヘリテイジ</span>
            <span className={styles.brandApp}>HannoSHIFT</span>
          </div>
        </div>

        {/* Карточка входа */}
        <section className={styles.card}>
          <h1 className={styles.title}>ログイン</h1>
          <p className={styles.sub}>ログインIDとパスワードを入力してください</p>
          <LoginForm onLoggedIn={onLoggedIn} />
        </section>
      </main>
    </div>
  );
}