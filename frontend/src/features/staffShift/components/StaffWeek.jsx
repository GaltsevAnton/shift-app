import { useEffect, useState } from "react";
import { api } from "../../../shared/api/api";
import styles from "./StaffWeek.module.css";

/* ─── constants ─────────────────────────────────────────── */
const HOTEL_NAME  = "ホテル・ヘリテイジ";
const BRANCH_NAME = "飯能 sta.";
const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

/* ─── helpers ───────────────────────────────────────────── */
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

function calcDuration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm, e = eh * 60 + em;
  if (e <= s) e += 24 * 60;
  return e - s;
}

function getName() {
  return localStorage.getItem("staffName") || "";
}

/* ─── Component ─────────────────────────────────────────── */
export default function StaffWeek({ weekStart, onBack, onLogout }) {
  const [status, setStatus] = useState("RECEIVING");
  const [days, setDays]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [msgOk, setMsgOk]   = useState(false);
  const [toast, setToast]         = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const editable = status === "RECEIVING";
  const name = getName();

  function showToast() {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }

  function showCopyToast() {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 3000);
  }

  useEffect(() => { load(); }, [weekStart]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setMsg(null);
    try {
      const res = await api.staffWeek(weekStart);
      setStatus(res.status);
      const norm = t => t ? String(t).slice(0, 5) : "";
      setDays(res.days.map(d => ({
        date: d.date,
        off: d.off,
        startTime: norm(d.startTime),
        endTime:   norm(d.endTime),
        last:      d.last ?? false,
      })));
    } catch (e) {
      setMsg(e.message || String(e));
      setMsgOk(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function updateDay(idx, patch) {
    setDays(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      if (copy[idx].off) { copy[idx].startTime = ""; copy[idx].endTime = ""; }
      return copy;
    });
  }

  async function save() {
    if (saving) return;
    setMsg(null);

    // Валидация на фронте
    for (const d of days) {
      if (!d.off && !d.startTime && !d.endTime) {
        setMsg(`${d.date}：出勤日は開始・終了時間を入力してください`);
        setMsgOk(false);
        return;
      }
      if (!d.off && (d.startTime || d.endTime) && (!d.startTime || !d.endTime)) {
        setMsg(`${d.date}：開始・終了時間を両方入力してください`);
        setMsgOk(false);
        return;
      }
    }

    setSaving(true);
    
    try {
      await api.staffWeekSave(weekStart, days.map(d => ({
        date: d.date,
        off: d.off,
        startTime: d.off ? null : d.startTime || null,
        endTime:   d.off ? null : d.endTime   || null,
      })));
      showToast();
      // не перезагружаем страницу — данные уже актуальны в стейте
    } catch (e) {
      setMsg(e.message || String(e));
      setMsgOk(false);
    } finally {
      setSaving(false);
    }
  }

  async function copyPrev() {
    if (copying) return;
    setCopying(true);
    setMsg(null);
    try {
      const res = await api.staffCopyPrev(weekStart);
      // перезагружаем данные чтобы показать скопированные значения
      await load(true);
      showCopyToast();
    } catch (e) {
      setMsg(e.message || String(e));
      setMsgOk(false);
    } finally {
      setCopying(false);
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

          {/* Title row */}
          <div className={styles.titleRow}>
            <div>
              <h2 className={styles.title}>週入力：{weekStart}〜</h2>
              <p className={styles.subtitle}>希望する出勤日と休日を設定できます</p>
            </div>
            <div className={styles.statusArea}>
              <span className={styles.statusLabel}>ステータス：</span>
              <span className={`${styles.badge} ${styles[`badge_${status?.toLowerCase()}`]}`}>
                {jpStatus(status)}
              </span>
              {!editable && <span className={styles.locked}>（編集不可）</span>}
            </div>
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
              {/* Toolbar top */}
              <div className={styles.toolbar}>
                <button
                  className={styles.copyBtn}
                  onClick={copyPrev}
                  disabled={!editable || copying}
                >
                  {copying ? "..." : "前週コピー"}
                </button>
                {copyToast && (
                  <span className={styles.toast}>✓ コピーしました</span>
                )}
              </div>

              {/* Info —受付中 */}
              {status === "RECEIVING" && (
                <div className={styles.infoHint}>
                  時間を選ぶには、休日のチェックを外してください
                </div>
              )}

              {/* Table */}
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
                    {days.map((d, idx) => {
                      const wknd = isWeekend(d.date);
                      return (
                        <tr key={d.date} className={styles.tr}>
                          <td className={`${styles.td} ${styles.tdDate} ${wknd ? styles.weekend : ""}`}>
                            {d.date} ({dowJa(d.date)})
                          </td>

                          <td className={styles.td}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={d.off}
                              disabled={!editable}
                              onChange={e => updateDay(idx, { off: e.target.checked })}
                            />
                          </td>

                          <td className={styles.td}>
                            <div className={styles.timeRow}>
                              <select
                                className={styles.timeSelect}
                                value={d.startTime}
                                disabled={!editable || d.off}
                                size={1}
                                onChange={e => updateDay(idx, { startTime: e.target.value })}
                              >
                                <option value="">--</option>
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>

                              <span className={styles.tilde}>〜</span>

                              {d.last ? (
                                <span className={styles.lastBadge}>L</span>
                              ) : (
                                <select
                                  className={styles.timeSelect}
                                  value={d.endTime}
                                  disabled={!editable || d.off}
                                  size={1}
                                  onChange={e => updateDay(idx, { endTime: e.target.value })}
                                >
                                  <option value="">--</option>
                                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              )}
                            </div>

                            {/* Duration warnings */}
                            {!d.off && d.startTime && d.endTime && (() => {
                              const dur = calcDuration(d.startTime, d.endTime);
                              if (dur > 16 * 60) return <div className={styles.warn}>※ 勤務時間が長すぎます（最大16時間）</div>;
                              if (dur < 30)      return <div className={styles.warn}>※ 勤務時間が短すぎます（30分以上）</div>;
                              if (d.endTime <= d.startTime) return <div className={styles.note}>※ 翌日まで（夜勤）</div>;
                              return null;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Warning — 確定 */}
              {status === "CONFIRMED" && (
                <div className={styles.infoWarning}>
                  都合が悪い場合は必ず店長に連絡をお願いします。
                </div>
              )}

              {/* Bottom bar */}
              <div className={styles.bottomBar}>
                <div className={styles.bottomLeft}>
                  <button
                    className={styles.saveBtn}
                    onClick={save}
                    disabled={!editable || saving}
                  >
                    {saving ? "..." : "更新"}
                  </button>
                  {toast && (
                    <span className={styles.toast}>✓ 更新しました</span>
                  )}
                </div>
                <button className={styles.backBtn} onClick={onBack}>
                  戻る
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}