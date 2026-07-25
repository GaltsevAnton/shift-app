import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/api";
import styles from "./StaffWeek.module.css";

/* ─── constants ─────────────────────────────────────────── */
const HOTEL_NAME  = "ホテル・ヘリテイジ";
const BRANCH_NAME = "飯能 sta.";
const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

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
function dowJa(dateStr) {
  return JP_WD[new Date(dateStr + "T00:00:00").getDay()];
}
function isWeekend(dateStr) {
  const d = new Date(dateStr + "T00:00:00").getDay();
  return d === 0 || d === 6;
}
function jpStatus(s) {
  if (s === "RECEIVING") return "受付中";
  if (s === "DRAFTING")  return "作成中";
  if (s === "CONFIRMED") return "確定";
  return s;
}
function calcDuration(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm, e = eh * 60 + em;
  if (e <= s) e += 24 * 60;
  return e - s;
}
function buildTimeOptions() {
  const out = [];
  for (let mins = 6 * 60; mins < 30 * 60; mins += 30) {
    const h = String(Math.floor(mins / 60) % 24).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    out.push(`${h}:${m}`);
  }
  return out;
}
const TIME_OPTIONS = buildTimeOptions();
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

  const [status1, setStatus1] = useState("RECEIVING");
  const [status2, setStatus2] = useState("RECEIVING");
  const [days, setDays]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [msgOk, setMsgOk]     = useState(false);
  const [toast, setToast]     = useState(false);

  const name = getName();

  const editable1 = status1 === "RECEIVING";
  const editable2 = status2 === "RECEIVING";

  function showToast() {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }

  const [copying, setCopying]     = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [fillStart, setFillStart] = useState("10:00");
  const [fillEnd, setFillEnd]     = useState("21:00");

  function showCopyToast() {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 3000);
  }

  async function copyPrev() {
    if (copying) return;
    setCopying(true);
    setMsg(null);
    try {
      // Вычисляем предыдущий месяц
      const [y, m] = month.split("-").map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  
      // Загружаем данные прошлого месяца
      const prev = await api.staffMonth(prevMonth);
      const prevDays = prev.days;
  
      // Заполняем текущие дни по дню недели
      setDays(cur => cur.map(d => {
        const dow = new Date(d.date + "T00:00:00").getDay();
        // Ищем первый день с таким же днём недели в прошлом месяце
        const match = prevDays.find(p =>
          new Date(p.date + "T00:00:00").getDay() === dow && !p.off && p.startTime
        );
        if (!match) return { ...d, off: true, startTime: "", endTime: "" };
        return {
          ...d,
          off:       false,
          startTime: match.startTime || "",
          endTime:   match.endTime   || "",
        };
      }));
  
      showCopyToast();
    } catch (e) {
      setMsg(e.message || String(e));
      setMsgOk(false);
    } finally {
      setCopying(false);
    }
  }

  function fillAll(half) {
    if (!fillStart || !fillEnd) return;
    setDays(prev => prev.map(d => {
      const h = new Date(d.date + "T00:00:00").getDate() <= 15 ? 1 : 2;
      if (h !== half) return d;
      return { ...d, off: false, startTime: fillStart, endTime: fillEnd };
    }));
  }
  
  function fillWeekdays(half) {
    if (!fillStart || !fillEnd) return;
    setDays(prev => prev.map(d => {
      const h = new Date(d.date + "T00:00:00").getDate() <= 15 ? 1 : 2;
      if (h !== half) return d;
      const dow = new Date(d.date + "T00:00:00").getDay();
      if (dow === 0 || dow === 6) return { ...d, off: true, startTime: "", endTime: "" };
      return { ...d, off: false, startTime: fillStart, endTime: fillEnd };
    }));
  }
  
  function fillNone(half) {
    setDays(prev => prev.map(d => {
      const h = new Date(d.date + "T00:00:00").getDate() <= 15 ? 1 : 2;
      if (h !== half) return d;
      return { ...d, off: true, startTime: "", endTime: "" };
    }));
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setMsg(null);
    try {
      const res = await api.staffMonth(month);
      setStatus1(res.status1);
      setStatus2(res.status2);
      setDays(res.days.map(d => ({
        date:      d.date,
        off:       d.off,
        startTime: d.startTime || "",
        endTime:   d.endTime   || "",
        last:      d.last      || false,
      })));
    } catch (e) {
      setMsg(e.message || String(e));
      setMsgOk(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("staffSelectedMonth", month);
    load();
  }, [month]);

  function updateDay(idx, patch) {
    setDays(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      if (copy[idx].off) {
        copy[idx].startTime = "";
        copy[idx].endTime   = "";
      }
      return copy;
    });
  }

  async function save() {
    if (saving) return;
    setMsg(null);

    for (const d of days) {
      const half = new Date(d.date + "T00:00:00").getDate() <= 15 ? 1 : 2;
      const editable = half === 1 ? editable1 : editable2;
      if (!editable) continue;
      if (!d.off && (d.startTime || d.endTime) && (!d.startTime || !d.endTime)) {
        setMsg(`${d.date}：開始・終了時間を両方入力してください`);
        setMsgOk(false);
        return;
      }
    }

    setSaving(true);
    try {
      await api.staffMonthSave(month, days.map(d => ({
        date:      d.date,
        off:       d.off || (!d.startTime && !d.endTime),
        startTime: d.startTime || null,
        endTime:   d.endTime   || null,
      })));
      showToast();
    } catch (e) {
      setMsg(e.message || String(e));
      setMsgOk(false);
    } finally {
      setSaving(false);
    }
  }

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

          <div className={styles.titleRow}>
            <div>
              <h2 className={styles.title}>希望シフト提出</h2>
              <p className={styles.subtitle}>希望する出勤日と時間を設定してください</p>
            </div>
          </div>

          {/* Month selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>月：</span>
            <select
              style={{
                appearance: "none", WebkitAppearance: "none",
                background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E\") no-repeat right 12px center",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                padding: "8px 36px 8px 14px",
                fontSize: 15, fontWeight: 700, color: "#0f172a",
                cursor: "pointer", outline: "none", minWidth: 150,
              }}
              value={month}
              onChange={e => setMonth(e.target.value)}
              disabled={loading}
            >
              {monthOptions.map(ym => (
                <option key={ym} value={ym}>{monthLabelJa(ym)}</option>
              ))}
            </select>
          </div>

          {msg && (
            <div className={`${styles.msg} ${msgOk ? styles.msgOk : styles.msgErr}`}>
              {msg}
            </div>
          )}

          {loading ? (
            <div className={styles.loading}>読み込み中...</div>
          ) : (
            <>
            {/* ── Блок 1: 1〜15日 ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 10,
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>1日〜15日</div>
                  <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                    ⚠️ 前月20日までに提出してください
                  </div>
                </div>
                <span className={`${styles.badge} ${styles[`badge_${status1?.toLowerCase()}`]}`}>
                  {jpStatus(status1)}
                </span>
              </div>

              {editable1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select className={styles.timeSelect} value={fillStart}
                      onChange={e => setFillStart(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className={styles.tilde}>〜</span>
                    <select className={styles.timeSelect} value={fillEnd}
                      onChange={e => setFillEnd(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={styles.copyBtn} onClick={() => fillAll(1)}
                      style={{ flex: 1, whiteSpace: "nowrap" }}>全日程</button>
                    <button className={styles.copyBtn} onClick={() => fillWeekdays(1)}
                      style={{ flex: 1, whiteSpace: "nowrap" }}>平日のみ</button>
                    <button className={styles.copyBtn} onClick={() => fillNone(1)}
                      style={{ flex: 1, whiteSpace: "nowrap" }}>全て休み</button>
                  </div>
                </div>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>日付</th>
                      <th className={styles.th}>休</th>
                      <th className={styles.th}>時間（希望）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.filter(d => new Date(d.date + "T00:00:00").getDate() <= 15).map((d, idx) => {
                      const wknd = isWeekend(d.date);
                      const dur  = calcDuration(d.startTime, d.endTime);
                      return (
                        <tr key={d.date} className={styles.tr}>
                          <td className={`${styles.td} ${styles.tdDate} ${wknd ? styles.weekend : ""}`}>
                            {d.date.slice(5).replace("-", "/")}（{dowJa(d.date)}）
                          </td>
                          <td className={styles.td}>
                            <input type="checkbox" className={styles.checkbox}
                              checked={d.off} disabled={!editable1}
                              onChange={e => {
                                const realIdx = days.findIndex(x => x.date === d.date);
                                updateDay(realIdx, { off: e.target.checked });
                              }}
                            />
                          </td>
                          <td className={styles.td}>
                            {!d.off && (
                              <div className={styles.timeRow}>
                                <select className={styles.timeSelect} value={d.startTime}
                                  disabled={!editable1}
                                  onChange={e => {
                                    const realIdx = days.findIndex(x => x.date === d.date);
                                    updateDay(realIdx, { startTime: e.target.value });
                                  }}>
                                  <option value="">--</option>
                                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <span className={styles.tilde}>〜</span>
                                {d.last ? (
                                  <span className={styles.lastBadge}>L</span>
                                ) : (
                                  <select className={styles.timeSelect} value={d.endTime}
                                    disabled={!editable1}
                                    onChange={e => {
                                      const realIdx = days.findIndex(x => x.date === d.date);
                                      updateDay(realIdx, { endTime: e.target.value });
                                    }}>
                                    <option value="">--</option>
                                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                )}
                              </div>
                            )}
                            {!d.off && d.startTime && d.endTime && (() => {
                              if (dur > 16 * 60) return <div className={styles.warn}>※ 長すぎます</div>;
                              if (dur < 30)      return <div className={styles.warn}>※ 短すぎます</div>;
                              if (d.endTime <= d.startTime) return <div className={styles.note}>※ 夜勤</div>;
                              return null;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Блок 2: 16〜末日 ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 10,
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>16日〜末日</div>
                  <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                    ⚠️ 当月5日までに提出してください
                  </div>
                </div>
                <span className={`${styles.badge} ${styles[`badge_${status2?.toLowerCase()}`]}`}>
                  {jpStatus(status2)}
                </span>
              </div>

              {editable2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select className={styles.timeSelect} value={fillStart}
                      onChange={e => setFillStart(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className={styles.tilde}>〜</span>
                    <select className={styles.timeSelect} value={fillEnd}
                      onChange={e => setFillEnd(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={styles.copyBtn} onClick={() => fillAll(2)}
                      style={{ flex: 1, whiteSpace: "nowrap" }}>全日程</button>
                    <button className={styles.copyBtn} onClick={() => fillWeekdays(2)}
                      style={{ flex: 1, whiteSpace: "nowrap" }}>平日のみ</button>
                    <button className={styles.copyBtn} onClick={() => fillNone(2)}
                      style={{ flex: 1, whiteSpace: "nowrap" }}>全て休み</button>
                  </div>
                </div>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>日付</th>
                      <th className={styles.th}>休</th>
                      <th className={styles.th}>時間（希望）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.filter(d => new Date(d.date + "T00:00:00").getDate() > 15).map((d, idx) => {
                      const wknd = isWeekend(d.date);
                      const dur  = calcDuration(d.startTime, d.endTime);
                      return (
                        <tr key={d.date} className={styles.tr}>
                          <td className={`${styles.td} ${styles.tdDate} ${wknd ? styles.weekend : ""}`}>
                            {d.date.slice(5).replace("-", "/")}（{dowJa(d.date)}）
                          </td>
                          <td className={styles.td}>
                            <input type="checkbox" className={styles.checkbox}
                              checked={d.off} disabled={!editable2}
                              onChange={e => {
                                const realIdx = days.findIndex(x => x.date === d.date);
                                updateDay(realIdx, { off: e.target.checked });
                              }}
                            />
                          </td>
                          <td className={styles.td}>
                            {!d.off && (
                              <div className={styles.timeRow}>
                                <select className={styles.timeSelect} value={d.startTime}
                                  disabled={!editable2}
                                  onChange={e => {
                                    const realIdx = days.findIndex(x => x.date === d.date);
                                    updateDay(realIdx, { startTime: e.target.value });
                                  }}>
                                  <option value="">--</option>
                                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <span className={styles.tilde}>〜</span>
                                {d.last ? (
                                  <span className={styles.lastBadge}>L</span>
                                ) : (
                                  <select className={styles.timeSelect} value={d.endTime}
                                    disabled={!editable2}
                                    onChange={e => {
                                      const realIdx = days.findIndex(x => x.date === d.date);
                                      updateDay(realIdx, { endTime: e.target.value });
                                    }}>
                                    <option value="">--</option>
                                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                )}
                              </div>
                            )}
                            {!d.off && d.startTime && d.endTime && (() => {
                              if (dur > 16 * 60) return <div className={styles.warn}>※ 長すぎます</div>;
                              if (dur < 30)      return <div className={styles.warn}>※ 短すぎます</div>;
                              if (d.endTime <= d.startTime) return <div className={styles.note}>※ 夜勤</div>;
                              return null;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}

          {!loading && (
            <div className={styles.bottomBar}>
              <div className={styles.bottomLeft}>
                <button
                  className={styles.saveBtn}
                  onClick={save}
                  disabled={(!editable1 && !editable2) || saving}
                >
                  {saving ? "..." : "更新"}
                </button>
                {toast && <span className={styles.toast}>✓ 更新しました</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}