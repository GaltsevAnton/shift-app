import { useEffect, useState } from "react";
import { api } from "../../../shared/api/api";

import styles from "./StaffWeek.module.css";

const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

function dowJaFromYmd(dateStr) {
  // dateStr: "YYYY-MM-DD"
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

function isEditable(status) {
  return status === "RECEIVING";
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

export default function StaffWeek({ weekStart, onBack, onLogout }) {
  const [status, setStatus] = useState("RECEIVING");
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.staffWeek(weekStart);
      setStatus(res.status);

      const norm = (t) => (t ? String(t).slice(0, 5) : ""); // "10:00:00" -> "10:00"
      setDays(
        res.days.map((d) => ({
          date: d.date,
          off: d.off,
          startTime: norm(d.startTime),
          endTime: norm(d.endTime),
        }))
      );
    } catch (e) {
      setMsg(`Load error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

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
      const payloadDays = days.map((d) => ({
        date: d.date,
        off: d.off,
        startTime: d.off ? null : d.startTime || null,
        endTime: d.off ? null : d.endTime || null,
      }));
      const res = await api.staffWeekSave(weekStart, payloadDays);
      setMsg(String(res));
      await load();
    } catch (e) {
      setMsg(`Save error: ${e.message || String(e)}`);
    }
  }

  async function copyPrev() {
    setMsg(null);
    try {
      const res = await api.staffCopyPrev(weekStart);
      setMsg(String(res));
      await load();
    } catch (e) {
      setMsg(`Copy error: ${e.message || String(e)}`);
    }
  }

  const editable = isEditable(status);

  // тон статуса для бейджа
  const statusLabel = jpStatus(status);
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
            <h2 className={styles.title}>週入力：{weekStart}〜</h2>
            <div className={styles.subline}>
              ステータス：
              <span className={badgeClass}>
                <span className={styles.dot} />
                {statusLabel}
              </span>
              {!editable && "（編集不可）"}
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
  
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <>
              <div className={styles.toolbar}>
                <button onClick={copyPrev} disabled={!editable} className={styles.btn}>
                  前週コピー
                </button>
              </div>
  
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th} style={{ width: "140px" }}>日付</th>
                      <th className={styles.th} style={{ width: "70px" }}>休</th>
                      <th className={styles.th}>時間（希望）</th>
                    </tr>
                  </thead>
  
                  <tbody>
                    {days.map((d, idx) => (
                      <tr key={d.date} className={styles.rowHover}>
                        <td
                          className={`${styles.td} ${styles.nowrap} ${isWeekendYmd(d.date) ? styles.weekendCell : ""}`}
                        >
                          {d.date} ({dowJaFromYmd(d.date)})
                        </td>
  
                        <td className={styles.td}>
                          <input
                            className={styles.checkbox}
                            type="checkbox"
                            checked={d.off}
                            disabled={!editable}
                            onChange={(e) => updateDay(idx, { off: e.target.checked })}
                          />
                        </td>
  
                        <td className={styles.td}>
                          <div className={styles.timeRow}>
                            <select
                              className={styles.select}
                              value={d.startTime}
                              disabled={!editable || d.off}
                              onChange={(e) => updateDay(idx, { startTime: e.target.value })}
                            >
                              <option value="">--</option>
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
  
                            <span>〜</span>
  
                            <select
                              className={styles.select}
                              value={d.endTime}
                              disabled={!editable || d.off}
                              onChange={(e) => updateDay(idx, { endTime: e.target.value })}
                            >
                              <option value="">--</option>
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
  
                          {!d.off && d.startTime && d.endTime && (() => {
                            const overnight = d.endTime <= d.startTime;
                            const dur = calcDurationMinutes(d.startTime, d.endTime);
  
                            const tooLong = dur > 16 * 60;
                            const tooShort = dur < 30;
  
                            if (tooLong) {
                              return (
                                <div className={`${styles.helper} ${styles.warn}`}>
                                  ※ 勤務時間が長すぎます（最大16時間まで）
                                </div>
                              );
                            }
                            if (tooShort) {
                              return (
                                <div className={`${styles.helper} ${styles.warn}`}>
                                  ※ 勤務時間が短すぎます（30分以上）
                                </div>
                              );
                            }
                            if (overnight) {
                              return (
                                <div className={`${styles.helper} ${styles.note}`}>
                                  ※ 翌日まで（夜勤）
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
  
              <div className={styles.toolbar}>
                <button
                  onClick={save}
                  disabled={!editable}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  更新
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
}
