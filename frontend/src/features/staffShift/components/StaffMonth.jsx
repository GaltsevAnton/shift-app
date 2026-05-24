import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/api";
import StaffWeek from "./StaffWeek";
import styles from "./StaffMonth.module.css";

/* ─── constants ─────────────────────────────────────────── */
const HOTEL_NAME  = "ホテル・ヘリテイジ";
const BRANCH_NAME = "飯能 sta.";

/* ─── helpers ───────────────────────────────────────────── */
function pad2(n) { return String(n).padStart(2, "0"); }
function formatYm(y, m) { return `${y}-${pad2(m)}`; }
function addMonths(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return formatYm(d.getFullYear(), d.getMonth() + 1);
}
function currentYm() {
  const d = new Date();
  return formatYm(d.getFullYear(), d.getMonth() + 1);
}
function build5Months() {
  const cur = currentYm();
  return Array.from({ length: 5 }, (_, i) => addMonths(cur, i));
}
function monthLabelJa(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${pad2(m)}月`;
}
function jpStatus(s) {
  if (s === "RECEIVING") return "受付中";
  if (s === "DRAFTING")  return "作成中";
  if (s === "CONFIRMED") return "確定";
  return s;
}
function getName() {
  return localStorage.getItem("staffName") || "";
}

/* ─── Component ─────────────────────────────────────────── */
export default function StaffMonth({ onLogout }) {
  const monthOptions = useMemo(() => build5Months(), []);

  const [month, setMonth] = useState(() => {
    const saved = localStorage.getItem("staffSelectedMonth");
    return saved && monthOptions.includes(saved) ? saved : monthOptions[0];
  });

  const [weeks, setWeeks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    localStorage.getItem("staffSelectedWeek") || null
  );

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.staffWeeks(month);
      setWeeks(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (weeks.length > 0) load(true);
    else load();
  }, [month]);

  if (selectedWeekStart) {
    return (
      <StaffWeek
        weekStart={selectedWeekStart}
        onBack={() => {
          localStorage.removeItem("staffSelectedWeek");
          setSelectedWeekStart(null);
        }}
        onLogout={onLogout}
      />
    );
  }

  const name = getName();

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.hotelName}>{HOTEL_NAME}</div>
            <div className={styles.branchName}>{BRANCH_NAME}</div>
            <div className={styles.staffName}>{name}</div>
          </div>
          <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>

        <div className={styles.divider} />

        {/* ── Body ── */}
        <div className={styles.body}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>
              希望シフト提出（{monthLabelJa(month)}）
            </h2>
            <p className={styles.subtitle}>
              月を選んで、週ごとの提出状況を確認できます
            </p>
          </div>

          {/* Month selector */}
          <div className={styles.monthRow}>
            <span className={styles.monthLabel}>月：</span>
            <select
              className={styles.monthSelect}
              value={month}
              onChange={e => {
                localStorage.setItem("staffSelectedMonth", e.target.value);
                setMonth(e.target.value);
              }}
              disabled={loading}
            >
              {monthOptions.map(ym => (
                <option key={ym} value={ym}>{monthLabelJa(ym)}</option>
              ))}
            </select>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {/* Weeks table */}
          {loading ? (
            <div className={styles.skeletons}>
              {[1,2,3,4].map(i => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : (
            <div className={`${styles.tableWrap} ${refreshing ? styles.refreshing : ""}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>期間</th>
                    <th className={styles.th}>ステータス</th>
                    <th className={styles.th}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(w => (
                    <tr key={w.weekStart} className={styles.tr}>
                      <td className={styles.td}>
                        <span className={styles.periodStart}>{w.weekStart}</span>
                        <span className={styles.periodEnd}>〜 {w.weekEnd}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.badge} ${styles[`badge_${w.status?.toLowerCase()}`]}`}>
                          {jpStatus(w.status)}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <button
                          className={styles.openBtn}
                          onClick={() => {
                            localStorage.setItem("staffSelectedWeek", w.weekStart);
                            setSelectedWeekStart(w.weekStart);
                          }}
                        >
                          開く
                        </button>
                      </td>
                    </tr>
                  ))}
                  {weeks.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.empty}>データがありません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}