import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import { api } from "../../shared/api/api";
import ManagerWeekEditor from "../../features/managerWeek/components/ManagerWeekEditor";
import styles from "./ManagerWeekPage.module.css";

function pad2(n) { return String(n).padStart(2, "0"); }
function formatYm(year, month1to12) { return `${year}-${pad2(month1to12)}`; }
function addMonths(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const base = new Date(y, m - 1, 1);
  base.setMonth(base.getMonth() + delta);
  return formatYm(base.getFullYear(), base.getMonth() + 1);
}
function build5MonthsFromCurrent() {
  const d = new Date();
  const current = formatYm(d.getFullYear(), d.getMonth() + 1);
  return Array.from({ length: 5 }, (_, i) => addMonths(current, i));
}
function monthLabelJa(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}
function jpStatus(s) {
  if (s === "RECEIVING") return "受付中";
  if (s === "DRAFTING") return "作成中";
  if (s === "CONFIRMED") return "確定";
  return s;
}

export default function ManagerWeekPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [month, setMonth] = useState(() => build5MonthsFromCurrent()[0]);
  const monthOptions = useMemo(() => build5MonthsFromCurrent(), []);

  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);

  useEffect(() => { load(); }, [month]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api.managerWeeks(month);
      setWeeks(data);
    } catch (e) {
      setMsg(`Load error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  if (selectedWeekStart) {
    return (
      <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
        <div className={styles.topBar}>
          <button className={styles.btn} onClick={() => setSelectedWeekStart(null)} type="button">
            ← 戻る
          </button>
        </div>
        <ManagerWeekEditor weekStart={selectedWeekStart} onBack={() => setSelectedWeekStart(null)} />
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>希望シフト（Manager）</div>
          <div className={styles.sub}>月→週→スタッフを選んで編集できます</div>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.label}>月：</div>
        <select className={styles.select} value={month} onChange={(e) => setMonth(e.target.value)} disabled={loading}>
          {monthOptions.map((ym) => (
            <option key={ym} value={ym}>{monthLabelJa(ym)}</option>
          ))}
        </select>
        <div className={styles.hint}>{loading ? "Loading..." : `${weeks.length} 件`}</div>
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: "55%" }}>期間</th>
              <th className={styles.th} style={{ width: "25%" }}>ステータス</th>
              <th className={styles.th} style={{ width: "20%" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart} className={styles.rowHover}>
                <td className={styles.td}>{w.weekStart} ~ {w.weekEnd}</td>
                <td className={styles.td}><b>{jpStatus(w.status)}</b></td>
                <td className={styles.td}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSelectedWeekStart(w.weekStart)} type="button">
                    開く
                  </button>
                </td>
              </tr>
            ))}
            {weeks.length === 0 && (
              <tr><td className={styles.td} colSpan={3}>No weeks</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ManagerLayout>
  );
}