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

export default function LoginForm({ onLoggedIn }) {
  const [login, setLoginState] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState(null);
  const [loading, setLoading]   = useState(false);

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
      onLoggedIn();
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          autoComplete="current-password"
        />
      </label>

      <button disabled={loading} className={styles.btn}>
        {loading ? "..." : "Login"}
      </button>

      {err && <div className={styles.err}>{err}</div>}
    </form>
  );
}