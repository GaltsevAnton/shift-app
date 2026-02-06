import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/api";
import ManagerWeek from "./ManagerWeek";
import styles from "./ManagerMonth.module.css";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYm(year, month1to12) {
  return `${year}-${pad2(month1to12)}`;
}

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

export default function ManagerMonth({ onLogout }) {
  const [month, setMonth] = useState(() => build5MonthsFromCurrent()[0]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);

  const monthOptions = useMemo(() => build5MonthsFromCurrent(), []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

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

  const monthLabel = useMemo(() => month.replace("-", "年") + "月", [month]);

  if (selectedWeekStart) {
    return (
      <ManagerWeek
        weekStart={selectedWeekStart}
        onBack={() => setSelectedWeekStart(null)}
        onLogout={onLogout}
        monthLabel={monthLabel}
      />
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>希望シフト管理（{monthLabel}）</h2>
          <p className={styles.subtitle}>月→週を選択して、スタッフの希望を確認し、ステータスを変更します</p>
        </div>

        <div className={styles.actions}>
          <button onClick={onLogout} className={`${styles.btn} ${styles.btnDanger}`}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.row}>
          <div>
            <span className={styles.label}>月：</span>
            <select
              className={styles.select}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={loading}
            >
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {monthLabelJa(ym)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.hint}>{loading ? "Loading..." : `${weeks.length} 件`}</div>
        </div>

        {msg && <div className={styles.alert}>{msg}</div>}

        {loading ? (
          <div className={styles.skeletonList}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        ) : (
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
                {weeks.map((w) => {
                  const label = jpStatus(w.status);
                  const badgeClass =
                    w.status === "RECEIVING"
                      ? `${styles.badge} ${styles.warn}`
                      : w.status === "CONFIRMED"
                      ? `${styles.badge} ${styles.good}`
                      : `${styles.badge}`;

                  return (
                    <tr key={w.weekStart} className={styles.rowHover}>
                      <td className={styles.td}>
                        <div className={styles.period}>
                          {w.weekStart} <span className={styles.periodSep}>~</span> {w.weekEnd}
                        </div>
                      </td>

                      <td className={styles.td}>
                        <span className={badgeClass}>
                          <span className={styles.dot} />
                          {label}
                        </span>
                      </td>

                      <td className={styles.td}>
                        <button
                          onClick={() => setSelectedWeekStart(w.weekStart)}
                          className={`${styles.btn} ${styles.btnPrimary}`}
                        >
                          開く
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {weeks.length === 0 && (
                  <tr>
                    <td className={styles.td} colSpan={3} style={{ borderBottom: "none" }}>
                      <div className={styles.empty}>No weeks</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
