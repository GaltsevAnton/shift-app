import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/api";
import styles from "./ManagerWeek.module.css";

const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

function fmt(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtWithDowYmd(ymd) {
  const d = new Date(ymd + "T00:00:00");
  return `${ymd} (${JP_WD[d.getDay()]})`;
}
function isWeekendYmd(ymd) {
  const d = new Date(ymd + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}
function jpStatus(s) {
  if (s === "RECEIVING") return "受付中";
  if (s === "DRAFTING") return "作成中";
  if (s === "CONFIRMED") return "確定";
  return s;
}

export default function ManagerWeek({ weekStart, onBack, onLogout, monthLabel }) {
  const [status, setStatus] = useState("RECEIVING");
  const [users, setUsers] = useState([]);
  const [prefs, setPrefs] = useState([]); // PreferenceResponse[]
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const days = useMemo(() => {
    const ws = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => fmt(addDays(ws, i)));
  }, [weekStart]);

  const from = days[0];
  const to = days[6];

  // карта: userId|date -> pref
  const prefMap = useMemo(() => {
    const m = new Map();
    for (const p of prefs) {
      m.set(`${p.userId}|${p.workDate}`, p);
    }
    return m;
  }, [prefs]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      // статус недели берём из managerWeeks (у нас есть monthLabel, но month может быть не известен)
      // поэтому просто получим месяц из weekStart:
      const ym = weekStart.slice(0, 7);
      const [weeks, u, p] = await Promise.all([
        api.managerWeeks(ym),
        api.managerUsers(),
        api.managerPreferences(from, to),
      ]);

      const wk = weeks.find((w) => w.weekStart === weekStart);
      setStatus(wk?.status || "RECEIVING");

      setUsers(u);
      setPrefs(p);
    } catch (e) {
      setMsg(`Load error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(nextStatus) {
    setMsg(null);
    try {
      await api.setWeekStatus(weekStart, nextStatus);
      setMsg("OK");
      await load();
    } catch (e) {
      setMsg(`Status error: ${e.message || String(e)}`);
    }
  }

  const badgeClass =
    status === "RECEIVING"
      ? `${styles.badge} ${styles.badgeWarn}`
      : status === "CONFIRMED"
      ? `${styles.badge} ${styles.badgeGood}`
      : `${styles.badge}`;

  const msgClass = !msg
    ? ""
    : msg.toLowerCase().includes("error")
    ? `${styles.msg} ${styles.msgErr}`
    : `${styles.msg} ${styles.msgOk}`;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            管理：週 {weekStart}〜（{monthLabel || weekStart.slice(0, 7)}）
          </h2>

          <div className={styles.subline}>
            ステータス：
            <span className={badgeClass}>
              <span className={styles.dot} />
              {jpStatus(status)}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={onBack} className={`${styles.btn} ${styles.btnGhost}`}>
            戻る
          </button>
          <button onClick={onLogout} className={`${styles.btn} ${styles.btnDanger}`}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {msg && <div className={msgClass}>{msg}</div>}

        <div className={styles.toolbar}>
          <button
            onClick={() => changeStatus("DRAFTING")}
            className={styles.btn}
            disabled={loading}
            title="作成中にする（スタッフ編集不可）"
          >
            作成中にする
          </button>

          <button
            onClick={() => changeStatus("CONFIRMED")}
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={loading}
            title="確定にする（スタッフ編集不可）"
          >
            確定にする
          </button>

          <button onClick={load} className={styles.btn} disabled={loading}>
            再読み込み
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={`${styles.th} ${styles.stickyLeft}`}>Staff</th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={[
                        styles.th,
                        isWeekendYmd(d) ? styles.weekendTh : "",
                      ].join(" ")}
                    >
                      {fmtWithDowYmd(d)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={styles.rowHover}>
                    <td className={`${styles.td} ${styles.stickyLeft} ${styles.staffCell}`}>
                      {u.fullName}
                    </td>

                    {days.map((d) => {
                      const p = prefMap.get(`${u.id}|${d}`);
                      const start = p?.startTime ? String(p.startTime).slice(0, 5) : "";
                      const end = p?.endTime ? String(p.endTime).slice(0, 5) : "";
                      const val =
                        !p ? "—"
                        : (!start || !end) ? "休"
                        : `${start}〜${end}`;

                      return (
                        <td
                          key={`${u.id}|${d}`}
                          className={[
                            styles.td,
                            isWeekendYmd(d) ? styles.weekendTd : "",
                          ].join(" ")}
                        >
                          <div className={styles.cellValue}>{val}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className={styles.td} style={{ borderBottom: "none" }}>
                      <div className={styles.empty}>No staff</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.note}>
          ※ この画面は「希望（Preferences）」の確認用です。<br />
          ※ ステータスを「作成中 / 確定」にすると、スタッフ側は編集できません（WeekServiceでロック）。
        </div>
      </div>
    </div>
  );
}
