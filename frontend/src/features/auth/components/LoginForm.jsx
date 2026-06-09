import { useState } from "react";
import { api, setToken } from "../../../shared/api/api";
import styles from "./LoginPage.module.css";

function getRoleFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "STAFF";
  } catch {
    return "STAFF";
  }
}

function getFullNameFromToken(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    const payload = JSON.parse(json);
    return payload.fullName || payload.name || payload.sub || "";
  } catch {
    return "";
  }
}

function resetViewportZoom() {
  const vp = document.querySelector('meta[name="viewport"]');
  if (!vp) return;
  vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
  setTimeout(() => {
    vp.setAttribute('content', 'width=device-width, initial-scale=1.0');
  }, 300);
}

export default function LoginForm() {
  const [login, setLoginState] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState(null);
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api.login(login, password);

      const role = getRoleFromToken(res.accessToken);
      localStorage.setItem("appRole", role);
      const fullName = getFullNameFromToken(res.accessToken);
      localStorage.setItem("staffName", fullName || login);
      setToken(res.accessToken);

      resetViewportZoom();
      setToken(res.accessToken);
      // даём Safari время зафиксировать форму, потом редирект
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.fieldLabel}>
        Login ID
        <input
          value={login}
          onChange={(e) => setLoginState(e.target.value)}
          className={styles.input}
          autoComplete="username"
        />
      </label>

      <label className={styles.fieldLabel}>
        Password
        <div style={{ position: "relative" }}>
          <input
            id="password-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            autoComplete="current-password"
            style={{ paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)",
              background: "none", border: "none",
              cursor: "pointer", padding: 0,
              color: "#94a3b8", display: "flex", alignItems: "center",
            }}
          >
            {showPassword ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </label>

      <button disabled={loading} className={styles.btn}>
        {loading ? "..." : "Login"}
      </button>

      {err && <div className={styles.err}>{err}</div>}
    </form>
  );
}