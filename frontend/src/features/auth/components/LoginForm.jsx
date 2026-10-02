import { useState } from "react";
import { api, setToken } from "../../../shared/api/api";
import styles from "./LoginPage.module.css";

function decodeTokenPayload(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64).split("").map(c =>
      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
    ).join("")
  );
  return JSON.parse(json);
}

function getRoleFromToken(token) {
  try {
    return decodeTokenPayload(token).role || "STAFF";
  } catch {
    return "STAFF";
  }
}

function getFullNameFromToken(token) {
  try {
    const p = decodeTokenPayload(token);
    return p.fullName || p.name || p.sub || "";
  } catch {
    return "";
  }
}

function resetViewportZoom() {
  const vp = document.querySelector('meta[name="viewport"]');
  if (!vp) return;
  vp.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0");
  setTimeout(() => {
    vp.setAttribute("content", "width=device-width, initial-scale=1.0");
  }, 300);
}

/* ─── icons ─────────────────────────────────────────────── */
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" fill="currentColor" />
      <path d="M3.8 20.5c0-4.1 3.7-7 8.2-7s8.2 2.9 8.2 7z" fill="currentColor" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 10V7.5a4.5 4.5 0 019 0V10" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor" />
      <circle cx="12" cy="15.5" r="1.6" fill="#fff" />
    </svg>
  );
}
function EyeIcon({ off }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3L2 20h20L12 3z" fill="#f5a524" />
      <path d="M12 9v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="#fff" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />
    </svg>
  );
}

/* ─── LoginForm ─────────────────────────────────────────── */
export default function LoginForm() {
  const [login, setLoginState] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState(null);
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await api.login(login, password);

      localStorage.setItem("appRole", getRoleFromToken(res.accessToken));
      localStorage.setItem("staffName", getFullNameFromToken(res.accessToken) || login);
      setToken(res.accessToken);

      resetViewportZoom();
      // даём Safari время зафиксировать форму (предложение сохранить пароль), потом редирект
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    } catch (e) {
      setErr(e.message || String(e));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="login-id" className={styles.label}>ログインID</label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}><UserIcon /></span>
          <input
            id="login-id"
            name="username"
            value={login}
            onChange={(e) => { setLoginState(e.target.value); setErr(null); }}
            className={`${styles.input} ${err ? styles.inputError : ""}`}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            inputMode="text"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="password-input" className={styles.label}>パスワード</label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}><LockIcon /></span>
          <input
            id="password-input"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErr(null); }}
            className={`${styles.input} ${styles.inputWithEye} ${err ? styles.inputError : ""}`}
            autoComplete="current-password"
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>

        {/* Ошибка — всплывающая подсказка под полем пароля */}
        {err && (
          <div className={styles.tip} role="alert">
            <span className={styles.tipIcon}><WarnIcon /></span>
            {err}
          </div>
        )}
      </div>

      <button type="submit" disabled={loading || !login || !password} className={styles.btn}>
        {loading ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            ログイン中...
          </>
        ) : (
          <>
            ログイン
            <span className={styles.btnArrow}><ArrowIcon /></span>
          </>
        )}
      </button>
    </form>
  );
}