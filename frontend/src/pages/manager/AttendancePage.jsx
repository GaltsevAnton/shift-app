import { useEffect, useState, useCallback } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import shellStyles from "../../app/layouts/AppShell.module.css";

const API_BASE = import.meta.env.VITE_API_BASE;
const MONTHS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

/* ─── helpers ───────────────────────────────────────────── */
function currentYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}
function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function dateStr(ym, day) {
  return `${ym}-${String(day).padStart(2,"0")}`;
}
function fmtTime(instant) {
  if (!instant) return "--:--";
  return new Date(instant).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo",
  });
}
function fmtDateTime(instant) {
  if (!instant) return "";
  return new Date(instant).toLocaleString("ja-JP", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

const WD_JA = ["日","月","火","水","木","金","土"];
function getDayOfWeek(dateString) {
  return new Date(dateString).getDay();
}

/* ─── AttendancePage ────────────────────────────────────── */
export default function AttendancePage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [ym, setYm]           = useState(currentYM);
  const [records, setRecords] = useState([]);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  // Попап детали
  const [detailPopup, setDetailPopup] = useState(null); // { userId, date, dayRecords }
  const [editRecord, setEditRecord]   = useState(null); // { id, recordedAt, note }
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr]         = useState(null);

  // monthOptions
  const monthOptions = (() => {
    const opts = [], now = new Date();
    for (let delta = -3; delta <= 3; delta++) {
      const d   = new Date(now.getFullYear(), now.getMonth() + delta, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      opts.push({ val, label: `${d.getFullYear()}年 ${MONTHS_JA[d.getMonth()]}` });
    }
    return opts;
  })();

  const load = useCallback(async (ymVal) => {
    setLoading(true); setErr(null);
    try {
      const [y, m] = ymVal.split("-").map(Number);
      const from   = `${ymVal}-01`;
      const lastDay = daysInMonth(ymVal);
      const to     = `${ymVal}-${String(lastDay).padStart(2,"0")}`;

      const [recs, emps] = await Promise.all([
        api.attendanceRecords(from, to),
        api.managerEmployeesList(),
      ]);
      setRecords(Array.isArray(recs) ? recs : []);
      setStaff(Array.isArray(emps) ? emps.filter(e => e.active && e.role === "STAFF") : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(ym); }, [ym, load]);

  const totalDays = daysInMonth(ym);
  const dayNums   = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Группировка: userId → date → records[]
  function getRecordsForDay(userId, date) {
    return records.filter(r => r.userId === userId && r.workDate === date)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  }

  // Статус ячейки по записям
  function getCellStatus(dayRecs) {
    if (dayRecs.length === 0) return null;
    const types = dayRecs.map(r => r.recordType);
    if (types.includes("CLOCK_OUT")) return "finished";
    if (types.includes("BREAK_START") && !types.includes("BREAK_END")) return "break";
    if (types.includes("CLOCK_IN")) return "working";
    return null;
  }

  // Краткое содержимое ячейки
  function getCellContent(dayRecs) {
    const clockIn  = dayRecs.find(r => r.recordType === "CLOCK_IN");
    const clockOut = dayRecs.find(r => r.recordType === "CLOCK_OUT");
    if (!clockIn) return null;
    return {
      in:  fmtTime(clockIn.recordedAt),
      out: clockOut ? fmtTime(clockOut.recordedAt) : null,
    };
  }

  function getCellDotColor(status) {
    switch (status) {
      case "finished": return "#16a34a";
      case "working":  return "#2563eb";
      case "break":    return "#d97706";
      default:         return null;
    }
  }

  // Редактирование записи
  async function handleEditSave() {
    if (!editRecord) return;
    setEditLoading(true); setEditErr(null);
    try {
      await api.attendanceEdit(editRecord.id, {
        recordedAt: new Date(editRecord.recordedAt).toISOString(),
        note:       editRecord.note || null,
      });
      await load(ym);
      setEditRecord(null);
      // Обновляем попап
      if (detailPopup) {
        const updated = records.filter(
          r => r.userId === detailPopup.userId && r.workDate === detailPopup.date
        );
        setDetailPopup(p => ({ ...p, dayRecords: updated }));
      }
    } catch (e) {
      setEditErr(e.message);
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>

        {/* TopBar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "12px 20px",
          background: "linear-gradient(45deg, #ffffff 0%, #d8d8d8 100%)",
          borderBottom: "1px solid #e2e8f0", flexShrink: 0,
        }}>
          <select value={ym} onChange={e => setYm(e.target.value)}
            style={{
              appearance: "none", WebkitAppearance: "none",
              background: "#fff", border: "1.5px solid rgba(0,0,0,0.15)",
              borderRadius: 8, padding: "7px 32px 7px 14px",
              fontSize: 16, fontWeight: 700, color: "#0f172a",
              cursor: "pointer", outline: "none",
            }}>
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>

          <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "#334155" }}>
            🕐 勤怠管理
          </span>
        </div>

        {err && (
          <div style={{ padding: "12px 20px", background: "#fee2e2", color: "#dc2626", fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>読み込み中...</div>
        ) : (
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{
              borderCollapse: "separate", borderSpacing: 0,
              minWidth: "100%", tableLayout: "fixed",
              fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12,
            }}>
              <thead>
                <tr>
                  <th style={thName}>氏名</th>
                  {dayNums.map(d => {
                    const wd = getDayOfWeek(dateStr(ym, d));
                    return (
                      <th key={d} style={{
                        ...thDay,
                        background: wd === 0 ? "#fff5f5" : wd === 6 ? "#eff6ff" : "#fff",
                        color: wd === 0 ? "#ef4444" : wd === 6 ? "#3b82f6" : "#334155",
                      }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{d}</span>
                        <span style={{ display: "block", fontSize: 11, color: "inherit", opacity: 0.7 }}>{WD_JA[wd]}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={totalDays + 1} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                      スタッフが見つかりません
                    </td>
                  </tr>
                )}
                {staff.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {/* Имя */}
                    <td style={tdName}>{s.fullName}</td>

                    {/* Дни */}
                    {dayNums.map(d => {
                      const date    = dateStr(ym, d);
                      const wd      = getDayOfWeek(date);
                      const dayRecs = getRecordsForDay(s.id, date);
                      const status  = getCellStatus(dayRecs);
                      const content = getCellContent(dayRecs);
                      const dot     = getCellDotColor(status);

                      return (
                        <td key={d}
                          onClick={() => dayRecs.length > 0 && setDetailPopup({
                            userId: s.id, userName: s.fullName,
                            date, dayRecords: dayRecs,
                          })}
                          style={{
                            ...tdDay,
                            background: wd === 0 ? "#fff5f5" : wd === 6 ? "#eff6ff" : "#fff",
                            cursor: dayRecs.length > 0 ? "pointer" : "default",
                          }}
                        >
                          {dot && (
                            <div style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: dot, margin: "0 auto 2px",
                            }} />
                          )}
                          {content && (
                            <>
                              <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, fontFamily: "monospace" }}>
                                {content.in}
                              </div>
                              <div style={{ fontSize: 11, color: content.out ? "#dc2626" : "#94a3b8", fontFamily: "monospace" }}>
                                {content.out || "--:--"}
                              </div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail popup ── */}
      {detailPopup && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={e => { if (e.target === e.currentTarget) { setDetailPopup(null); setEditRecord(null); } }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, padding: 24,
            minWidth: 340, maxWidth: 440,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>
              {detailPopup.userName}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
              {detailPopup.date}
            </div>

            {/* Список записей */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {detailPopup.dayRecords.map(r => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: getTypeColor(r.recordType) }}>
                      {getTypeLabel(r.recordType)}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "#1e293b" }}>
                      {fmtTime(r.recordedAt)}
                    </div>
                    {r.note && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>📝 {r.note}</div>
                    )}
                    {r.edited && (
                      <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>✏️ 編集済み</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Фото */}
                    {r.photoPath && (
                        <a href={`${API_BASE}${r.photoPath}`} target="_blank" rel="noreferrer" style={{ fontSize: 20, textDecoration: "none" }}>📷</a>
                    )}
                    {/* Редактировать */}
                    <button
                      onClick={() => setEditRecord({
                        id: r.id,
                        recordedAt: new Date(r.recordedAt).toISOString().slice(0, 16),
                        note: r.note || "",
                      })}
                      style={{
                        padding: "4px 10px", fontSize: 12,
                        background: "#f1f5f9", border: "none",
                        borderRadius: 6, cursor: "pointer", color: "#475569",
                      }}
                    >
                      編集
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Форма редактирования */}
            {editRecord && (
              <div style={{
                padding: 14, borderRadius: 10,
                background: "#fffbeb", border: "1px solid #fcd34d",
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>
                  ✏️ 時刻を修正
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
                    時刻
                    <input
                      type="datetime-local"
                      value={editRecord.recordedAt}
                      onChange={e => setEditRecord({ ...editRecord, recordedAt: e.target.value })}
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
                    コメント
                    <input
                      type="text"
                      value={editRecord.note}
                      onChange={e => setEditRecord({ ...editRecord, note: e.target.value })}
                      placeholder="修正理由など"
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </label>
                  {editErr && <div style={{ color: "#dc2626", fontSize: 12 }}>{editErr}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={handleEditSave} disabled={editLoading}
                      style={{ padding: "7px 16px", background: "#2F5496", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {editLoading ? "..." : "保存"}
                    </button>
                    <button onClick={() => { setEditRecord(null); setEditErr(null); }}
                      style={{ padding: "7px 16px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => { setDetailPopup(null); setEditRecord(null); }}
              style={{ width: "100%", padding: "10px", background: "#f1f5f9", border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer", color: "#475569" }}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

/* ─── helpers ───────────────────────────────────────────── */
function getTypeLabel(type) {
  switch (type) {
    case "CLOCK_IN":    return "出勤";
    case "CLOCK_OUT":   return "退勤";
    case "BREAK_START": return "休憩開始";
    case "BREAK_END":   return "休憩終了";
    default:            return type;
  }
}
function getTypeColor(type) {
  switch (type) {
    case "CLOCK_IN":    return "#16a34a";
    case "CLOCK_OUT":   return "#dc2626";
    case "BREAK_START": return "#d97706";
    case "BREAK_END":   return "#2563eb";
    default:            return "#475569";
  }
}

/* ─── styles ────────────────────────────────────────────── */
const thName = {
  position: "sticky", left: 0, top: 0, zIndex: 40,
  background: "#fff", borderBottom: "2px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  padding: "8px 14px", width: 140, minWidth: 140,
  textAlign: "left", fontSize: 12, fontWeight: 600,
  color: "#94a3b8", letterSpacing: "0.5px",
};
const thDay = {
  position: "sticky", top: 0, zIndex: 20,
  borderBottom: "2px solid #e2e8f0",
  borderRight: "1px solid #f1f5f9",
  width: 52, minWidth: 52, padding: "6px 0",
  textAlign: "center", verticalAlign: "middle",
};
const tdName = {
  position: "sticky", left: 0, zIndex: 4,
  background: "#fff", borderRight: "1px solid #e2e8f0",
  padding: "8px 14px", fontSize: 13, fontWeight: 600,
  color: "#0f172a", whiteSpace: "nowrap",
  overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140,
};
const tdDay = {
  borderRight: "1px solid #f1f5f9",
  padding: "4px 2px", textAlign: "center",
  verticalAlign: "middle", minHeight: 40,
};