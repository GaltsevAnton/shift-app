import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/api";
import styles from "./ManagerWeekEditor.module.css";

const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

function dowJaFromYmd(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return JP_WD[d.getDay()];
}

function isWeekendYmd(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

function jpStatus(s) {
  if (s === "RECEIVING") return "受付中";
  if (s === "DRAFTING") return "作成中";
  if (s === "CONFIRMED") return "確定";
  return s;
}

function buildTimeOptions(stepMinutes = 30, startHour = 6, endHour = 30) {
  const out = [];
  const start = startHour * 60;
  const end = endHour * 60;
  for (let mins = start; mins < end; mins += stepMinutes) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hh = String(h % 24).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}
const TIME_OPTIONS = buildTimeOptions(30, 6, 30);

function minutesFromHHMM(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function calcDurationMinutes(start, end) {
  const s = minutesFromHHMM(start);
  let e = minutesFromHHMM(end);
  if (e <= s) e += 24 * 60;
  return e - s;
}

export default function ManagerWeekEditor({ weekStart, onBack }) {
  const [status, setStatus] = useState("RECEIVING");
  const [rows, setRows] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const selectedUser = useMemo(
    () => rows.find((r) => r.userId === Number(selectedUserId)) || null,
    [rows, selectedUserId]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    if (!selectedUser) return;
    const norm = (t) => (t ? String(t).slice(0, 5) : "");
    setDays(
      selectedUser.days.map((d) => ({
        date: d.date,
        off: d.off,
        startTime: norm(d.startTime),
        endTime: norm(d.endTime),
      }))
    );
  }, [selectedUser]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.managerWeek(weekStart);
      setStatus(res.status);
      setRows(res.rows || []);

      if ((res.rows || []).length > 0) {
        setSelectedUserId(String(res.rows[0].userId));
      } else {
        setSelectedUserId(null);
        setDays([]);
      }
    } catch (e) {
      setMsg(`Load error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const locked = status === "CONFIRMED"; // менеджер НЕ редактирует, если 確定

  function updateDay(idx, patch) {
    const copy = [...days];
    copy[idx] = { ...copy[idx], ...patch };
    if (copy[idx].off) {
      copy[idx].startTime = "";
      copy[idx].endTime = "";
    }
    setDays(copy);
  }

  async function save() {
    setMsg(null);
    try {
      if (!selectedUserId) return;

      const payloadDays = days.map((d) => ({
        date: d.date,
        off: d.off,
        startTime: d.off ? null : d.startTime || null,
        endTime: d.off ? null : d.endTime || null,
      }));

      const res = await api.managerWeekSave(weekStart, Number(selectedUserId), payloadDays);
      setMsg(String(res));
      await load();
    } catch (e) {
      setMsg(`Save error: ${e.message || String(e)}`);
    }
  }

  async function setStatusReq(next) {
    setMsg(null);
    try {
      const res = await api.setWeekStatus(weekStart, next);
      setMsg(String(res));
      await load();
    } catch (e) {
      setMsg(`Status error: ${e.message || String(e)}`);
    }
  }

  const badge =
    status === "RECEIVING"
      ? styles.badgeWarn
      : status === "CONFIRMED"
      ? styles.badgeGood
      : styles.badgeMid;

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>Manager Week: {weekStart}〜</div>
          <div className={styles.sub}>
            ステータス：
            <span className={`${styles.badge} ${badge}`}>{jpStatus(status)}</span>
            {locked && <span className={styles.locked}>（確定：編集不可）</span>}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={onBack} type="button">戻る</button>

          <button className={styles.btn} onClick={() => setStatusReq("RECEIVING")} type="button">
            受付中
          </button>
          <button className={styles.btn} onClick={() => setStatusReq("DRAFTING")} type="button">
            作成中
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStatusReq("CONFIRMED")} type="button">
            確定
          </button>
        </div>
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>No staff</div>
      ) : (
        <>
          <div className={styles.pickRow}>
            <div className={styles.label}>スタッフ：</div>
            <select
              className={styles.select}
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {rows.map((r) => (
                <option key={r.userId} value={r.userId}>
                  {r.userName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: 160 }}>日付</th>
                  <th className={styles.th} style={{ width: 70 }}>休</th>
                  <th className={styles.th}>時間（希望）</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, idx) => (
                  <tr key={d.date} className={styles.rowHover}>
                    <td className={`${styles.td} ${isWeekendYmd(d.date) ? styles.weekendCell : ""}`}>
                      {d.date} ({dowJaFromYmd(d.date)})
                    </td>
                    <td className={styles.td}>
                      <input
                        type="checkbox"
                        checked={d.off}
                        disabled={locked}
                        onChange={(e) => updateDay(idx, { off: e.target.checked })}
                      />
                    </td>
                    <td className={styles.td}>
                      <div className={styles.timeRow}>
                        <select
                          className={styles.selectTime}
                          value={d.startTime}
                          disabled={locked || d.off}
                          onChange={(e) => updateDay(idx, { startTime: e.target.value })}
                        >
                          <option value="">--</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>

                        <span>〜</span>

                        <select
                          className={styles.selectTime}
                          value={d.endTime}
                          disabled={locked || d.off}
                          onChange={(e) => updateDay(idx, { endTime: e.target.value })}
                        >
                          <option value="">--</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {!d.off && d.startTime && d.endTime && (() => {
                        const overnight = d.endTime <= d.startTime;
                        const dur = calcDurationMinutes(d.startTime, d.endTime);
                        if (dur > 16 * 60) return <div className={styles.warn}>※ 長すぎます（最大16時間）</div>;
                        if (dur < 30) return <div className={styles.warn}>※ 短すぎます（30分以上）</div>;
                        if (overnight) return <div className={styles.note}>※ 翌日まで（夜勤）</div>;
                        return null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.bottom}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={save}
              disabled={locked || !selectedUserId}
              type="button"
            >
              保存
            </button>
          </div>
        </>
      )}
    </div>
  );
}
