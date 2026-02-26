// import { useState } from "react";
// import { api, setToken } from "../../../shared/api/api";
// import styles from "./LoginPage.module.css";

// export default function LoginForm({ onLoggedIn }) {
//   const [mode, setMode] = useState(localStorage.getItem("appRole") || "MANAGER");
//   const [login, setLoginState] = useState(mode === "MANAGER" ? "manager" : "anton");
//   const [password, setPassword] = useState(mode === "MANAGER" ? "manager123" : "pass123");
//   const [err, setErr] = useState(null);
//   const [loading, setLoading] = useState(false);

//   function applyMode(nextMode) {
//     setMode(nextMode);
//     localStorage.setItem("appRole", nextMode);
//     setLoginState(nextMode === "MANAGER" ? "manager" : "anton");
//     setPassword(nextMode === "MANAGER" ? "manager123" : "pass123");
//   }

//   async function submit(e) {
//     e.preventDefault();
//     setErr(null);
//     setLoading(true);
//     try {
//       const res = await api.login(login, password);

//       // ВАЖНО: роль ставим из выбранного режима, а не из JWT
//       setToken(res.accessToken, mode);

//       localStorage.setItem("staffName", login);
//       onLoggedIn();
//     } catch (e) {
//       setErr(e.message || String(e));
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div>
//       <div className={styles.tabs}>
//         <button
//           onClick={() => applyMode("MANAGER")}
//           className={`${styles.tab} ${mode === "MANAGER" ? styles.tabActive : ""}`}
//           type="button"
//         >
//           Manager
//         </button>
//         <button
//           onClick={() => applyMode("STAFF")}
//           className={`${styles.tab} ${mode === "STAFF" ? styles.tabActive : ""}`}
//           type="button"
//         >
//           Staff
//         </button>
//       </div>

//       <form onSubmit={submit} className={styles.form}>
//         <label className={styles.fieldLabel}>
//           Login
//           <input
//             value={login}
//             onChange={(e) => setLoginState(e.target.value)}
//             className={styles.input}
//           />
//         </label>

//         <label className={styles.fieldLabel}>
//           Password
//           <input
//             type="password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             className={styles.input}
//           />
//         </label>

//         <button disabled={loading} className={styles.btn}>
//           {loading ? "..." : "Login"}
//         </button>

//         {err && <div className={styles.err}>{err}</div>}
//       </form>

//       <div className={styles.footer}>appRole = {mode} (stored in localStorage)</div>
//     </div>
//   );
// }
import { useState } from "react";
import { api, setToken } from "../../../shared/api/api";
import styles from "./LoginPage.module.css";

// Читаем роль из JWT payload (без верификации подписи — только для UI)
function getRoleFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "STAFF"; // "MANAGER" | "STAFF" | "ADMIN"
  } catch {
    return "STAFF";
  }
}

export default function LoginForm({ onLoggedIn }) {
  const [login, setLoginState] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api.login(login, password);

      // роль берём из токена, не из UI
      const role = getRoleFromToken(res.accessToken);
      localStorage.setItem("appRole", role);
      localStorage.setItem("staffName", login);
      setToken(res.accessToken);

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
        Login
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