import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import styles from "./ManagerTablePage.module.css";

/* ─── constants ─────────────────────────────────────────── */
const WD_JA     = ["日","月","火","水","木","金","土"];
const MONTHS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const MAX_SLOTS = 5;

const STATUS_META = {
  RECEIVING: { label:"受付中", cls:"receiving" },
  DRAFTING:  { label:"作成中", cls:"drafting"  },
  CONFIRMED: { label:"確定",   cls:"confirmed" },
};

const START_TIME_OPTS = [];
for (let h = 3; h < 24; h++)
  for (let m of [0, 30])
    START_TIME_OPTS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

const END_TIME_OPTS = [];
for (let h = 0; h < 24; h++)
  for (let m of [0, 30])
    END_TIME_OPTS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

const SORT_FIELDS = [
  { value: "sortOrder",  label: "順番№" },
  { value: "name",       label: "氏名" },
  { value: "position",   label: "職種・役職" },
  { value: "department", label: "部署" },
];

const VIEW_MODES = [
  { value: "month",  label: "月" },
  { value: "week",   label: "週" },
  { value: "period", label: "期間" },
];

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
function getName() {
  return localStorage.getItem("staffName") || "";
}
function findWeekForDate(weeks, date) {
  return weeks.find(w => {
    const ws = new Date(w.weekStart), we = new Date(w.weekStart);
    we.setDate(we.getDate() + 6);
    const d = new Date(date);
    return d >= ws && d <= we;
  });
}
function formatTime(t) {
  if (!t) return "--";
  return typeof t === "string" ? t.slice(0, 5) : t;
}
function emptySlot() {
  return { startTime:"", endTime:"", last:false, workplace:"", breakOverride: null, _breakOpen: false };
}
function periodDays(from, to) {
  if (!from || !to) return 0;
  return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
}
function isNextDay(startTime, endTime) {
  if (!startTime || !endTime) return false;
  return endTime < startTime;
}
function toMinutesLocal(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function getAutoBreakMinutes(startTime, endTime, breakRules = []) {
  if (!startTime || !endTime) return null;
  let start = toMinutesLocal(startTime);
  let end   = toMinutesLocal(endTime);
  if (end <= start) end += 24 * 60;
  const duration = end - start;
  if (duration <= 0) return null;
  const rule = [...breakRules]
    .filter(r => duration > r.thresholdMinutes)
    .sort((a, b) => b.thresholdMinutes - a.thresholdMinutes)[0];
  return rule ? rule.breakMinutes : 0;
}

function getWorkHint(startTime, endTime, breakOverride, breakRules = []) {
  if (!startTime || !endTime) return null;
  let start = toMinutesLocal(startTime);
  let end   = toMinutesLocal(endTime);
  if (end <= start) end += 24 * 60;
  const duration = end - start;
  if (duration <= 0) return null;

  const breakMin = breakOverride !== null && breakOverride !== undefined
    ? breakOverride
    : (getAutoBreakMinutes(startTime, endTime, breakRules) || 0);

  const workMin = duration - breakMin;
  const h = Math.floor(workMin / 60);
  const m = workMin % 60;
  return m > 0 ? `${h}時${m}分` : `${h}時`;
}
function fmtBreakMinutes(mins) {
  if (mins === null || mins === undefined) return null;
  if (mins === 0) return "0分";
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}時${m}分` : `${h}時`;
}
// Вернуть список недель (monday) для данного месяца ym
function weeksInMonth(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  const first  = new Date(y, m - 1, 1);
  const last   = new Date(y, m, 0);

  // monday of first day (локальная дата)
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));

  // monday of last day (локальная дата)
  const end = new Date(last);
  end.setDate(last.getDate() - ((last.getDay() + 6) % 7));

  const weeks = [];
  let cur = new Date(start);
  while (cur <= end) {
    const ws = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
    const we = new Date(cur);
    we.setDate(we.getDate() + 6);
    const weStr = `${we.getFullYear()}-${String(we.getMonth()+1).padStart(2,"0")}-${String(we.getDate()).padStart(2,"0")}`;
    weeks.push({ weekStart: ws, weekEnd: weStr });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function currentMondayLocal() {
  const now  = new Date();
  const diff = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - diff);
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ─── localStorage helpers ──────────────────────────────── */
function saveFilterSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* ignore */ }
}
function loadFilterSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch { return null; }
}

/* ─── ContextMenu ───────────────────────────────────────── */
function ContextMenu({ x, y, copiedPattern, selectedCount, onEdit, onCopy, onPaste, onClose }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (rect.right  > vw) ref.current.style.left = `${x - rect.width}px`;
    if (rect.bottom > vh) ref.current.style.top  = `${y - rect.height}px`;
  }, [x, y]);

  const menuStyle = {
    position: "fixed", top: y, left: x, zIndex: 3000,
    background: "#fff", borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    border: "1px solid #e0e0e0",
    minWidth: 180, overflow: "hidden",
  };
  const itemStyle = {
    display: "block", width: "100%", padding: "10px 16px",
    textAlign: "left", border: "none", background: "none",
    cursor: "pointer", fontSize: 13, color: "#333",
  };

  return (
    <div ref={ref} style={menuStyle} onMouseDown={e => e.stopPropagation()}>
      <button style={itemStyle}
        onMouseEnter={e => e.target.style.background = "#f5f5f5"}
        onMouseLeave={e => e.target.style.background = "none"}
        onClick={() => { onEdit(); onClose(); }}>
        ✏️ 編集
      </button>
      <div style={{ height: 1, background: "#eee", margin: "2px 0" }} />
      <button style={itemStyle}
        onMouseEnter={e => e.target.style.background = "#f5f5f5"}
        onMouseLeave={e => e.target.style.background = "none"}
        onClick={() => { onCopy(); onClose(); }}>
        📋 このパターンをコピー
      </button>
      {copiedPattern && (
        <button style={itemStyle}
          onMouseEnter={e => e.target.style.background = "#EBF3FF"}
          onMouseLeave={e => e.target.style.background = "none"}
          onClick={() => { onPaste(); onClose(); }}>
          📅 {selectedCount > 1 ? `${selectedCount}日に適用` : "コピーを適用"}
        </button>
      )}
    </div>
  );
}

/* ─── AlertModal ────────────────────────────────────────── */
function AlertModal({ message, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "28px 32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        minWidth: 280, maxWidth: 360, textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, color: "#333", marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </div>
        <button onClick={onClose} style={{
          background: "#2F5496", color: "#fff", border: "none",
          borderRadius: 8, padding: "8px 28px", fontSize: 14, cursor: "pointer",
        }}>
          OK
        </button>
      </div>
    </div>
  );
}

/* ─── ReportLoader ──────────────────────────────────────── */
function ReportLoader() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "36px 48px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        minWidth: 260,
      }}>
        <div style={{
          width: 48, height: 48,
          border: "4px solid #E0E8F5",
          borderTop: "4px solid #2F5496",
          borderRadius: "50%",
          animation: "mgr-spin 0.8s linear infinite",
        }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 }}>
            レポートを生成中...
          </div>
          <div style={{ fontSize: 13, color: "#666" }}>
            しばらくお待ちください
          </div>
        </div>
        <style>{`@keyframes mgr-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

/* ─── CellPopover → модальное окно «シフト編集» по центру экрана ─── */
const CP_ICON = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};
function CpIcoCalendar() { return (<svg {...CP_ICON}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M9 15.5l2 2 4-4" /></svg>); }
function CpIcoClose()    { return (<svg {...CP_ICON}><path d="M6 6l12 12M18 6L6 18" /></svg>); }
function CpIcoPin()      { return (<svg {...CP_ICON}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></svg>); }
function CpIcoClock()    { return (<svg {...CP_ICON}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>); }
function CpIcoCup()      { return (<svg {...CP_ICON}><path d="M4.5 9h11v5.5a4.5 4.5 0 01-4.5 4.5H9a4.5 4.5 0 01-4.5-4.5V9z" /><path d="M15.5 10.5h1.5a2.5 2.5 0 010 5h-1.5" /><path d="M4 21h12" /></svg>); }
function CpIcoAlarm()    { return (<svg {...CP_ICON}><circle cx="12" cy="13" r="7" /><path d="M12 9.5V13l2.5 1.5M5 4.5L3 6.5M19 4.5l2 2" /></svg>); }
function CpIcoSave()     { return (<svg {...CP_ICON}><path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>); }
function CpIcoTrash()    { return (<svg {...CP_ICON}><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5a1 1 0 001 .9h7a1 1 0 001-.9l1-12.5M9.5 7V4.5h5V7" /></svg>); }

// «9時間00分» / «40分»
function fmtJpDuration(mins) {
  if (mins === null || mins === undefined || mins < 0) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h === 0 ? `${m}分` : `${h}時間${String(m).padStart(2, "0")}分`;
}
// «2026年 9月 23日 (水)»
function fmtJpDate(ds) {
  if (!ds) return "";
  const [y, m, d] = ds.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${y}年 ${m}月 ${d}日 (${WD_JA[wd]})`;
}
function slotDurationMinutes(start, end) {
  if (!start || !end) return null;
  let s = toMinutesLocal(start), e = toMinutesLocal(end);
  if (e <= s) e += 24 * 60;
  return e - s;
}

// bulkDates — массовое редактирование (Shift+клик / «全日を選択»): одна и та же смена на все выбранные дни
function CellPopover({ day, currentDate, prevDaySlots, onGoToPrevDay,
                       staffName, staffPosition, staffDepartments = [], bulkDates = null,
                       onClose, onSave, workplaces, breakRules = [] }) {
  const isBulk    = Array.isArray(bulkDates) && bulkDates.length > 0;
  const bulkSorted = isBulk ? [...bulkDates].sort() : [];
  const isOff = day.off && (!day.slots || day.slots.length === 0);
  const [off, setOff]     = useState(isOff);
  const [slots, setSlots] = useState(() => {
    if (isOff || !day.slots || day.slots.length === 0) return [emptySlot()];
    return day.slots.map(s => ({
      startTime:     s.startTime ? formatTime(s.startTime) : "",
      endTime:       s.endTime   ? formatTime(s.endTime)   : "",
      last:          s.last || false,
      workplace:     s.workplace || "",
      breakOverride: (s.breakOverrideMinutes !== null && s.breakOverrideMinutes !== undefined)
        ? s.breakOverrideMinutes
        : null,
    }));
  });

  // Esc — закрыть
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateSlot(i, field, value) {
    setSlots(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }
  function addSlot() {
    if (slots.length >= MAX_SLOTS) return;
    setSlots(prev => [...prev, emptySlot()]);
  }
  function removeSlot(i) {
    if (slots.length <= 1) return;
    setSlots(prev => prev.filter((_, idx) => idx !== i));
  }
  function handleSave() {
    if (off) { onSave({ off: true, slots: [] }); return; }

    const incomplete = slots.some(s => s.startTime && !s.endTime);
    if (incomplete) {
      alert("終了時間を入力してください");
      return;
    }

    const validSlots = slots
      .filter(s => s.startTime)
      .map(s => ({
        startTime:     s.startTime,
        endTime:       s.endTime,
        last:          s.last,
        workplace:     s.workplace || null,
        nextDay:       isNextDay(s.startTime, s.endTime),
        breakOverrideMinutes: s.breakOverride,
      }));

    onSave(validSlots.length === 0
      ? { off: true, slots: [] }
      : { off: false, slots: validSlots });
  }

  const saveDisabled = !off && slots.some(s => !s.startTime || !s.endTime);

  // Варианты перерыва: "" = авто по правилам, "0" = なし, иначе минуты правила
  const breakOptions = useMemo(() => {
    const seen = new Set();
    return breakRules
      .filter(r => r.breakMinutes > 0 && !seen.has(r.breakMinutes) && seen.add(r.breakMinutes))
      .map(r => ({ value: String(r.breakMinutes), label: `${fmtJpDuration(r.breakMinutes)}${r.name ? `（${r.name}）` : ""}` }));
  }, [breakRules]);

  function autoBreakLabel(slot) {
    const auto = getAutoBreakMinutes(slot.startTime, slot.endTime, breakRules) || 0;
    if (!auto) return "なし（自動）";
    return `${fmtJpDuration(auto)}（自動）`;
  }

  const modal = (
    <div className={styles.cpOverlay}
      onMouseDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}>
      <div className={styles.cpModal} role="dialog" aria-modal="true" aria-label="シフト編集">

        {/* ── Заголовок ── */}
        <div className={styles.cpHead}>
          <span className={styles.cpHeadIcon}><CpIcoCalendar /></span>
          <div className={styles.cpHeadText}>
            <div className={styles.cpTitle}>
              {isBulk ? "シフト一括編集" : "シフト編集"}
              {isBulk && <span className={styles.cpBulkCount}>{bulkSorted.length}日選択中</span>}
            </div>
            <div className={styles.cpDate}>
              {isBulk
                ? (bulkSorted.length === 1
                    ? fmtJpDate(bulkSorted[0])
                    : `${fmtJpDate(bulkSorted[0])} 〜 ${fmtJpDate(bulkSorted[bulkSorted.length - 1])}`)
                : fmtJpDate(currentDate)}
            </div>
          </div>
          <button type="button" className={styles.cpClose} onClick={onClose} aria-label="閉じる"><CpIcoClose /></button>
        </div>

        <div className={styles.cpBody}>
          {/* ── Сотрудник ── */}
          <div className={styles.cpStaff}>
            <div className={styles.cpStaffText}>
              <div className={styles.cpStaffName}>{staffName}</div>
              {staffPosition && <div className={styles.cpStaffPos}>{staffPosition}</div>}
            </div>
            {staffDepartments.length > 0 && (
              <div className={styles.cpChips}>
                {staffDepartments.map(d => <span key={d} className={styles.cpChip}>{d}</span>)}
              </div>
            )}
          </div>

          {/* ── 前日からの引き続き ── */}
          {prevDaySlots && prevDaySlots.length > 0 && (
            <button type="button" className={styles.cpPrev} onClick={onGoToPrevDay}>
              <span className={styles.cpPrevTitle}>← 前日からの引き続き（クリックで前日を編集）</span>
              {prevDaySlots.map((s, i) => (
                <span key={i} className={styles.cpPrevRow}>
                  <span className={styles.cpPrevTag}>前日</span>{formatTime(s.startTime)}
                  <span className={styles.cpPrevArrow}>→</span>
                  <span className={styles.cpPrevTag}>当日</span>{formatTime(s.endTime)}
                  {s.workplace && <span className={styles.cpPrevPlace}>{s.workplace}</span>}
                </span>
              ))}
            </button>
          )}

          {isBulk && (
            <div className={styles.cpBulkNote}>選択した {bulkSorted.length} 日すべてに同じシフトを設定します（既存のシフトは上書きされます）。</div>
          )}

          <div className={styles.cpCard}>
            {/* Переключает только сама галочка — клик по строке ничего не делает */}
            <div className={styles.cpOffRow}>
              <input type="checkbox" checked={off} onChange={e => setOff(e.target.checked)}
                className={styles.cpCheck} aria-label="公休" />
              <span>公休</span>
            </div>

            {off ? (
              <div className={styles.cpOffNote}>
                {isBulk ? "選択した日はすべて公休になります。" : "この日は公休です。シフト情報はありません。"}
              </div>
            ) : (
              <>
                {slots.map((slot, i) => {
                  const nd    = isNextDay(slot.startTime, slot.endTime);
                  const dur   = slotDurationMinutes(slot.startTime, slot.endTime);
                  const brk   = dur === null ? null
                    : (slot.breakOverride !== null && slot.breakOverride !== undefined)
                      ? slot.breakOverride
                      : (getAutoBreakMinutes(slot.startTime, slot.endTime, breakRules) || 0);
                  const work  = dur === null ? null : dur - (brk || 0);
                  return (
                    <div key={i} className={styles.cpSlot}>
                      {slots.length > 1 && (
                        <div className={styles.cpSlotHead}>
                          <span>シフト {i + 1}</span>
                          <button type="button" className={styles.cpSlotRemove} onClick={() => removeSlot(i)} aria-label="削除">
                            <CpIcoTrash />
                          </button>
                        </div>
                      )}

                      <div className={styles.cpField}>
                        <span className={styles.cpLabel}><CpIcoPin />場所</span>
                        <select className={styles.cpSelect} value={slot.workplace}
                          onChange={e => updateSlot(i, "workplace", e.target.value)}>
                          <option value="">— 未選択 —</option>
                          {workplaces.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                        </select>
                      </div>

                      <div className={styles.cpField}>
                        <span className={styles.cpLabel}><CpIcoClock />開始</span>
                        <select className={styles.cpSelect} value={slot.startTime}
                          onChange={e => updateSlot(i, "startTime", e.target.value)}>
                          <option value="">--:--</option>
                          {START_TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div className={styles.cpField}>
                        <span className={styles.cpLabel}>
                          <CpIcoClock />終了
                          {nd && <span className={styles.cpNextDay}>翌日</span>}
                        </span>
                        <select className={styles.cpSelect} value={slot.endTime}
                          onChange={e => updateSlot(i, "endTime", e.target.value)}>
                          <option value="">--:--</option>
                          {END_TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      {dur !== null && (
                        <>
                          <div className={styles.cpTotal}><CpIcoClock />合計: {fmtJpDuration(dur)}</div>

                          <div className={styles.cpField}>
                            <span className={styles.cpLabel}><CpIcoCup />休憩</span>
                            <select className={cx(styles.cpSelect, styles.cpSelectBreak)}
                              value={slot.breakOverride === null || slot.breakOverride === undefined ? "" : String(slot.breakOverride)}
                              onChange={e => updateSlot(i, "breakOverride", e.target.value === "" ? null : Number(e.target.value))}>
                              <option value="">{autoBreakLabel(slot)}</option>
                              <option value="0">なし（0分）</option>
                              {breakOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>

                          <div className={styles.cpField}>
                            <span className={cx(styles.cpLabel, styles.cpLabelWork)}><CpIcoAlarm />実働</span>
                            <div className={styles.cpWork}>{fmtJpDuration(work)}</div>
                          </div>
                        </>
                      )}

                      <label className={styles.cpLastRow}>
                        <input type="checkbox" checked={slot.last} className={styles.cpCheckSm}
                          onChange={e => updateSlot(i, "last", e.target.checked)} />
                        <span className={styles.cpLastBadge}>L</span>
                        ラスト（終了未定）
                      </label>
                    </div>
                  );
                })}

                {slots.length < MAX_SLOTS && (
                  <button type="button" className={styles.cpAddSlot} onClick={addSlot}>＋ シフトを追加</button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Кнопки ── */}
        <div className={styles.cpFoot}>
          <button type="button" className={styles.cpCancel} onClick={onClose}>キャンセル</button>
          <button type="button" className={styles.cpSave} onClick={handleSave} disabled={saveDisabled}>
            <CpIcoSave />保存
          </button>
        </div>
      </div>
    </div>
  );

  // Портал в body — окно поверх всего (боковое меню, шапка), а не внутри ячейки таблицы
  return createPortal(modal, document.body);
}

/* ─── small UI helpers (новый дизайн 2026-10-02, как в 勤怠管理) ─── */
const cx = (...a) => a.filter(Boolean).join(" ");

// 表示列: строки под именем + колонка №
const COL_ITEMS = [
  { value: "number",     label: "№" },
  { value: "position",   label: "職種・役職" },
  { value: "department", label: "部署" },
];

// 表示行: строки внутри смены (порядок = порядок в ячейке)
const ROW_ITEMS = [
  { value: "in",    label: "出勤" },
  { value: "out",   label: "退勤" },
  { value: "work",  label: "実働" },
  { value: "break", label: "休憩" },
  { value: "place", label: "場所" },
];

const STATUS_ITEMS = [
  { value: "RECEIVING", label: "受付中", color: "#b8c4d0" },
  { value: "DRAFTING",  label: "作成中", color: "#f0b23c" },
  { value: "CONFIRMED", label: "確定",   color: "#1a8a5f" },
];

function Chevron({ open }) {
  return (
    <svg className={cx(styles.chev, open && styles.chevOpen)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TB_ICON = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};
function IcoDownload() { return (<svg {...TB_ICON}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 19.5h15" /></svg>); }
function IcoBell()     { return (<svg {...TB_ICON}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 004 0" /></svg>); }
function IcoGear()     { return (<svg {...TB_ICON}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" /></svg>); }
function IcoUser()     { return (<svg {...TB_ICON}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg>); }
function IcoLogout()   { return (<svg {...TB_ICON}><path d="M14 4H7a2 2 0 00-2 2v12a2 2 0 002 2h7" /><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" /></svg>); }
function IcoSearch()   { return (<svg {...TB_ICON}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>); }
function IcoPrev()     { return (<svg {...TB_ICON}><path d="M15 6l-6 6 6 6" /></svg>); }
function IcoNext()     { return (<svg {...TB_ICON}><path d="M9 6l6 6-6 6" /></svg>); }
function IcoClear()    { return (<svg {...TB_ICON} strokeWidth={2.4}><path d="M7 7l10 10M17 7L7 17" /></svg>); }
function IcoSelectAll() { return (<svg {...TB_ICON}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M8.5 14.5l2.3 2.3 4.7-4.7" /></svg>); }
function IcoEdit()     { return (<svg {...TB_ICON}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>); }
function IcoClose()    { return (<svg {...TB_ICON}><path d="M6 6l12 12M18 6L6 18" /></svg>); }

// Закрытие выпадающего списка по клику мимо
function useOutsideClose(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Кнопка + панель (部署 / 職種・役職 / 表示フィルター / 並び替え / 表示列 / その他)
function DropdownShell({ label, filtered, align, width, className, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useOutsideClose(open, setOpen, ref);
  return (
    <div ref={ref} className={cx(styles.wpDropdownWrap, className)}>
      <button type="button"
        className={cx(styles.wpDropdownBtn, open && styles.wpDropdownBtnActive, filtered && styles.wpDropdownBtnFiltered)}
        onClick={() => setOpen(v => !v)}>
        {label}
        <Chevron open={open} />
      </button>
      {open && (
        <div className={cx(styles.wpDropdownPanel, align === "right" && styles.panelRight)}
          style={width ? { width } : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}

// Группа чекбоксов (заголовок + すべて + пункты; item.special — серым)
function CheckGroup({ title, items, set, onToggle, onToggleAll, hideAll }) {
  const keys   = items.map(i => i.value);
  const allOn  = keys.length > 0 && keys.every(k => set.has(k));
  const someOn = keys.some(k => set.has(k));
  return (
    <div className={styles.panelGroup}>
      {title && <div className={styles.panelTitle}>{title}</div>}
      {!hideAll && (
        <label className={styles.wpDropdownAll}>
          <input type="checkbox" className={styles.colToggleCheck}
            checked={allOn}
            ref={el => { if (el) el.indeterminate = !allOn && someOn; }}
            onChange={() => onToggleAll(keys, !allOn)}
          />
          <span>すべて</span>
        </label>
      )}
      {items.map(item => (
        <label key={item.value} className={styles.wpDropdownItem}>
          <input type="checkbox" className={styles.colToggleCheck}
            checked={set.has(item.value)}
            onChange={() => onToggle(item.value)}
          />
          <span className={item.special ? styles.wpSpecialLabel : undefined}>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

// Список полей сортировки (клик по активному — смена направления)
function SortList({ sortConfig, setSortConfig }) {
  return (
    <div className={styles.panelGroup}>
      <div className={styles.panelTitle}>並び替え</div>
      {SORT_FIELDS.map(f => {
        const active = sortConfig.field === f.value;
        return (
          <button key={f.value} type="button"
            className={cx(styles.sortItem, active && styles.sortItemActive)}
            onClick={() => setSortConfig({
              field: f.value,
              dir: active ? (sortConfig.dir === "asc" ? "desc" : "asc") : "asc",
            })}>
            <span>{f.label}</span>
            <span className={styles.sortDir}>{active ? (sortConfig.dir === "asc" ? "↑" : "↓") : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

// Статус половины месяца: [1〜15日 | ● 作成中 ⌄] + список
function StatusSelect({ label, value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useOutsideClose(open, setOpen, ref);
  const cur = STATUS_ITEMS.find(i => i.value === value) || STATUS_ITEMS[0];
  return (
    <div ref={ref} className={styles.statusWrap}>
      <button type="button"
        className={cx(styles.statusBtn, open && styles.statusBtnOpen)}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}>
        <span className={styles.statusLabel}>{label}</span>
        <span className={styles.statusDivider} />
        <span className={styles.statusDot} style={{ background: cur.color }} />
        <span className={styles.statusText}>{cur.label}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className={styles.statusMenu}>
          {STATUS_ITEMS.map(i => (
            <button key={i.value} type="button"
              className={cx(styles.statusItem, i.value === value && styles.statusItemActive)}
              onClick={() => { setOpen(false); if (i.value !== value) onChange(i.value); }}>
              <span className={styles.statusDot} style={{ background: i.color }} />
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
/* ─── Main page ─────────────────────────────────────────── */
export default function ManagerTablePage({ view, onNavigate, onLogout }) {

  /* ── view mode state ── */
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("managerViewMode") || "month"
  );
  const [ym, setYm] = useState(
    () => localStorage.getItem("managerSelectedMonth") || currentYM()
  );
  // Week mode: selectedWeek = "YYYY-MM-DD" (monday)
  // Default: monday of current week, or stored value
  const [selectedWeek, setSelectedWeek] = useState(
    () => localStorage.getItem("managerSelectedWeek") || currentMondayLocal()
  );
  const [periodFrom, setPeriodFrom] = useState(
    () => localStorage.getItem("managerRangeFrom") || ""
  );
  const [periodTo, setPeriodTo] = useState(
    () => localStorage.getItem("managerRangeTo") || ""
  );

  /* ── data state ── */
  const [weeksRaw, setWeeksRaw]       = useState([]);
  const [data, setData]               = useState({});
  const [allStaff, setAllStaff]       = useState([]);
  const [positions, setPositions]     = useState({});
  const [sortOrders, setSortOrders]   = useState({});
  const [workplaces, setWorkplaces]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staffDepts, setStaffDepts]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [statusLoading, setStatusLoading] = useState({});
  const [savingCell, setSavingCell]       = useState(null);
  const [openCell, setOpenCell]           = useState(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [alertMsg, setAlertMsg]   = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [contextMenu, setContextMenu]   = useState(null);
  const [copiedPattern, setCopiedPattern] = useState(null);
  const cellAnchorRefs = useRef({});

  const [sortConfig, setSortConfig] = useState({ field:"sortOrder", dir:"asc" });
  const [colVisibility, setColVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem("mgrColVisibility");
      return raw ? JSON.parse(raw) : { number: true, position: true, department: true };
    } catch { return { number: true, position: true, department: true }; }
  });
  const [visibleWorkplaces, setVisibleWorkplaces]   = useState(() => loadFilterSet("mgrFilterWp")   || new Set());
  // 表示行 — какие строки смены показывать (хотя бы одна остаётся)
  const [visibleRows, setVisibleRows] = useState(
    () => loadFilterSet("mgrRowVisibility") || new Set(ROW_ITEMS.map(i => i.value))
  );
  const [visiblePositions, setVisiblePositions]     = useState(() => loadFilterSet("mgrFilterPos")  || new Set());
  const [visibleDepartments, setVisibleDepartments] = useState(() => loadFilterSet("mgrFilterDept") || new Set());
  const [attendanceMap, setAttendanceMap] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMap, setActiveMap]       = useState({});
  const [breakRules, setBreakRules] = useState([]);
  const [monthStatus1, setMonthStatus1] = useState("RECEIVING");
  const [monthStatus2, setMonthStatus2] = useState("RECEIVING");
  const [monthStatusLoading, setMonthStatusLoading] = useState(false);

  /* ── persist view mode state ── */
  useEffect(() => { localStorage.setItem("managerViewMode",    viewMode);     }, [viewMode]);
  useEffect(() => { localStorage.setItem("managerSelectedMonth", ym);         }, [ym]);
  useEffect(() => { localStorage.setItem("managerSelectedWeek", selectedWeek);}, [selectedWeek]);
  useEffect(() => { if (periodFrom) localStorage.setItem("managerRangeFrom", periodFrom); }, [periodFrom]);
  useEffect(() => { if (periodTo)   localStorage.setItem("managerRangeTo",   periodTo);   }, [periodTo]);

  /* ── displayDates: массив строк "YYYY-MM-DD" для отображения столбцов ── */
  const displayDates = useMemo(() => {
    if (viewMode === "week") {
      return Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
    }
    if (viewMode === "period") {
      const days = periodDays(periodFrom, periodTo);
      if (days < 7 || days > 50) return [];
      const dates = [];
      const cur = new Date(periodFrom);
      const end = new Date(periodTo);
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    }
    // month
    const total = daysInMonth(ym);
    return Array.from({ length: total }, (_, i) => dateStr(ym, i + 1));
  }, [viewMode, selectedWeek, periodFrom, periodTo, ym]);

  /* ── load: определяет какой запрос делать в зависимости от режима ── */
  const load = useCallback(async (silent = false, overrideMode, overrideWk, overridePF, overridePT, overrideYm) => {
    const mode  = overrideMode ?? viewMode;
    const wk    = overrideWk   ?? selectedWeek;
    const pFrom = overridePF   ?? periodFrom;
    const pTo   = overridePT   ?? periodTo;
    const ymVal = overrideYm   ?? ym;

    if (!silent) { setLoading(true); setOpenCell(null); }
    try {
      let weeksPromise;
      if (mode === "week") {
        const to = addDays(wk, 6);
        weeksPromise = api.managerRange(wk, to);
      } else if (mode === "period") {
        const days = periodDays(pFrom, pTo);
        if (!pFrom || !pTo || days < 7 || days > 50) {
          if (!silent) { setWeeksRaw([]); setData({}); setAllStaff([]); setLoading(false); }
          return;
        }
        weeksPromise = api.managerRange(pFrom, pTo);
      } else {
        weeksPromise = api.managerMonth(ymVal);
      }

      // вычисляем from/to для attendance
      let attFrom, attTo;
      if (mode === "week") {
        attFrom = wk;
        attTo   = addDays(wk, 6);
      } else if (mode === "period" && pFrom && pTo) {
        attFrom = pFrom;
        attTo   = pTo;
      } else {
        const total = daysInMonth(ymVal);
        attFrom = `${ymVal}-01`;
        attTo   = `${ymVal}-${String(total).padStart(2,"0")}`;
      }

      const [weeks, employees, wps, depts, attRecs, breakRules, monthStatusRes] = await Promise.all([
        weeksPromise,
        api.managerEmployeesList(),
        api.settingsWorkplacesList(),
        api.settingsDepartmentsList(),
        api.attendanceRecords(attFrom, attTo).catch(() => []),
        api.settingsBreakRulesList().catch(() => []),
        mode === "month" ? api.managerMonthStatus(ymVal).catch(() => ({ status: "RECEIVING" })) : Promise.resolve({ status: "RECEIVING" }),
      ]);

      // Строим attendanceMap: "userId_date" → "finished"|"working"|"break"
      const attMap = {};
      for (const r of (attRecs || [])) {
        const key = `${r.userId}_${r.workDate}`;
        if (!attMap[key]) attMap[key] = [];
        attMap[key].push(r.recordType);
      }
      const resolvedAttMap = {};
      for (const [key, types] of Object.entries(attMap)) {
        if (types.includes("CLOCK_OUT"))   resolvedAttMap[key] = "finished";
        else if (types.includes("BREAK_START") && !types.includes("BREAK_END")) resolvedAttMap[key] = "break";
        else if (types.includes("CLOCK_IN")) resolvedAttMap[key] = "working";
      }
      setAttendanceMap(resolvedAttMap);

      setBreakRules(Array.isArray(breakRules) ? breakRules : []);
      setMonthStatus1(monthStatusRes?.status1 || "RECEIVING");
      setMonthStatus2(monthStatusRes?.status2 || "RECEIVING");

      const posMap = {}, deptsMap = {}, sortOrderMap = {};
      employees.forEach(e => {
        posMap[e.id]       = e.position || "";
        deptsMap[e.id]     = (e.departments || []).map(d => d.name);
        activeMap[e.id]    = e.active;
        sortOrderMap[e.id] = e.sortOrder;
      });
      setActiveMap(activeMap);
      setPositions(posMap);
      setStaffDepts(deptsMap);
      setSortOrders(sortOrderMap);
      setWorkplaces(Array.isArray(wps)   ? wps   : []);
      setDepartments(Array.isArray(depts) ? depts : []);

      const allWpSet   = new Set([...(Array.isArray(wps) ? wps : []).map(w => w.name), "__none__", "__off__"]);
      const allPosSet  = new Set(Object.values(posMap).filter(Boolean));
      const allDeptSet = new Set(Object.values(deptsMap).flat());

      const savedWp   = loadFilterSet("mgrFilterWp");
      const savedPos  = loadFilterSet("mgrFilterPos");
      const savedDept = loadFilterSet("mgrFilterDept");

      setVisibleWorkplaces(savedWp   && savedWp.size   > 0 ? savedWp   : allWpSet);
      setVisiblePositions (savedPos  && savedPos.size  > 0 ? savedPos  : allPosSet);
      setVisibleDepartments(savedDept && savedDept.size > 0 ? savedDept : allDeptSet);

      applyWeeks(weeks);
    } catch {
      if (!silent) { setWeeksRaw([]); setData({}); setAllStaff([]); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [viewMode, selectedWeek, periodFrom, periodTo, ym]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── загрузка при изменении параметров ── */
  useEffect(() => {
    load(false);
  }, [viewMode, selectedWeek, periodFrom, periodTo, ym]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── переход из 勤怠管理 («シフト予定 ›»): открыть окно смены сотрудника на этот день ── */
  useEffect(() => {
    if (loading || allStaff.length === 0) return;
    let jump = null;
    try { jump = JSON.parse(sessionStorage.getItem("mgrJumpTo") || "null"); } catch { /* ignore */ }
    if (!jump) return;
    sessionStorage.removeItem("mgrJumpTo");
    if (allStaff.some(s => s.userId === jump.userId)) setOpenCell({ userId: jump.userId, date: jump.date });
  }, [loading, allStaff]);

  /* ── автообновление каждые 60 сек ── */
  useEffect(() => {
    const interval = setInterval(() => { if (!openCell) load(true); }, 60000);
    return () => clearInterval(interval);
  }, [openCell, load]);

  /* ── persist filters ── */
  useEffect(() => { saveFilterSet("mgrFilterPos",  visiblePositions);   }, [visiblePositions]);
  useEffect(() => { saveFilterSet("mgrFilterDept", visibleDepartments); }, [visibleDepartments]);
  useEffect(() => { saveFilterSet("mgrFilterWp",   visibleWorkplaces);  }, [visibleWorkplaces]);
  useEffect(() => {
    try { localStorage.setItem("mgrColVisibility", JSON.stringify(colVisibility)); } catch { /* ignore */ }
  }, [colVisibility]);
  useEffect(() => {
    saveFilterSet("mgrRowVisibility", visibleRows);
  }, [visibleRows]);

  /* ── close context menu on outside click ── */
  useEffect(() => {
    if (!contextMenu) return;
    function onDown() { setContextMenu(null); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  /* ── applyWeeks ── */
  function applyWeeks(weeks) {
    setWeeksRaw(weeks);
    const staffMap = {}, newData = {};
    weeks.forEach(w => {
      const staffById = {};
      (w.rows || []).forEach(row => {
        const dayMap = {};
        (row.days || []).forEach(d => { dayMap[d.date] = d; });
        staffById[row.userId] = { userName: row.userName, dayMap };
        if (!staffMap[row.userId]) staffMap[row.userId] = { userId: row.userId, userName: row.userName };
      });
      newData[w.weekStart] = { status: w.status || "RECEIVING", staffById };
    });
    setData(newData);
    setAllStaff(Object.values(staffMap).sort((a, b) => a.userName.localeCompare(b.userName, "ja")));
  }

  /* ── getDayData ── */
  function getDayData(userId, date) {
    const week = findWeekForDate(weeksRaw, date);
    if (!week) return { date, off: true, slots: [] };
    const row = data[week.weekStart]?.staffById?.[userId];
    return row?.dayMap?.[date] || { date, off: true, slots: [] };
  }

  /* ── maxSlotsForStaff — по displayDates ── */
  function maxSlotsForStaff(userId) {
    let max = 1;
    displayDates.forEach(date => {
      const cnt = (getDayData(userId, date).slots?.length) || 0;
      if (cnt > max) max = cnt;
    });
    return max;
  }

  /* ── countOffDays — по displayDates ── */
  function countOffDays(userId) {
    return displayDates.filter(date => {
      const day = getDayData(userId, date);
      return day.off || !day.slots || day.slots.length === 0;
    }).length;
  }

  function toMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }
  
  function calcWorkMinutes(userId) {
    let total = 0;
    displayDates.forEach(date => {
      const day = getDayData(userId, date);
      if (day.off || !day.slots) return;
  
      // Суммируем все слоты за день
      let dayMinutes = 0;
      day.slots.forEach(s => {
        if (!s.startTime || !s.endTime) return;
        let start = toMinutes(s.startTime);
        let end   = toMinutes(s.endTime);
        if (end <= start) end += 24 * 60; // ночная смена
        dayMinutes += end - start;
      });
  
      if (dayMinutes === 0) return;
  
      // Если у любого слота есть breakOverrideMinutes — используем его
      const overrideSlot = day.slots.find(s => s.breakOverrideMinutes !== null && s.breakOverrideMinutes !== undefined);
      let breakMin;
      if (overrideSlot) {
        breakMin = overrideSlot.breakOverrideMinutes;
      } else {
        const rule = [...breakRules]
          .filter(r => dayMinutes > r.thresholdMinutes)
          .sort((a, b) => b.thresholdMinutes - a.thresholdMinutes)[0];
        breakMin = rule ? rule.breakMinutes : 0;
      }

      total += dayMinutes - breakMin;
    });
    return total;
  }
  
  function fmtWorkHours(minutes) {
    if (minutes <= 0) return "0h";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }

  /* ── monthOptions для Year/Month селектов ── */
  const monthOptions = useMemo(() => {
    const opts = [], now = new Date();
    for (let delta = -12; delta <= 12; delta++) {
      const d   = new Date(now.getFullYear(), now.getMonth() + delta, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      opts.push({ val, label: `${d.getFullYear()}年 ${MONTHS_JA[d.getMonth()]}` });
    }
    return opts;
  }, []);

  // Уникальные годы из monthOptions
  const yearOptions = useMemo(() => [...new Set(monthOptions.map(o => o.val.split("-")[0]))], [monthOptions]);

  // Недели текущего месяца для Week-режима
  const weekOptions = useMemo(() => weeksInMonth(ym), [ym]);

  /* ── cascade filter ── */
  const positionOptions = [...new Set(allStaff.map(s => positions[s.userId] || "").filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));

  const staffByPosition = visiblePositions.size === 0
    ? []
    : allStaff.filter(s => visiblePositions.has(positions[s.userId] || ""));

  const availableDeptNames = new Set(staffByPosition.flatMap(s => staffDepts[s.userId] || []));
  const allDepartmentItems = departments
    .filter(d => availableDeptNames.has(d.name))
    .map(d => ({ value: d.name, label: d.name }));

  const staffByDept = (() => {
    if (visiblePositions.size === 0) return [];
    if (allDepartmentItems.length > 0) {
      if (visibleDepartments.size === 0) return [];
      return staffByPosition.filter(s =>
        (staffDepts[s.userId] || []).some(d => visibleDepartments.has(d))
      );
    }
    return [...staffByPosition];
  })();

  const availableWorkplaceNames = (() => {
    const names = new Set();
    staffByDept.forEach(s => {
      displayDates.forEach(date => {
        const day = getDayData(s.userId, date);
        if (day.off || !day.slots || day.slots.length === 0) {
          names.add("__off__");
        } else {
          day.slots.forEach(sl => names.add(sl.workplace ? sl.workplace : "__none__"));
        }
      });
    });
    return names;
  })();

  const workplaceItems = workplaces
    .filter(w => availableWorkplaceNames.has(w.name))
    .map(w => ({ value: w.name, label: w.name }));
  const wpExtraItems = [
    ...(availableWorkplaceNames.has("__none__") ? [{ value: "__none__", label: "場所なし" }] : []),
    ...(availableWorkplaceNames.has("__off__")  ? [{ value: "__off__",  label: "休み" }]    : []),
  ];

  function sortFn(a, b) {
    if (sortConfig.field === "sortOrder") {
      const va = sortOrders[a.userId] ?? 0;
      const vb = sortOrders[b.userId] ?? 0;
      return (sortConfig.dir === "asc" ? 1 : -1) * (va - vb);
    }
    let va = "", vb = "";
    if (sortConfig.field === "name")       { va = a.userName; vb = b.userName; }
    if (sortConfig.field === "position")   { va = positions[a.userId] || ""; vb = positions[b.userId] || ""; }
    if (sortConfig.field === "department") {
      va = (staffDepts[a.userId] || [])[0] || "";
      vb = (staffDepts[b.userId] || [])[0] || "";
    }
    return (sortConfig.dir === "asc" ? 1 : -1) * va.localeCompare(vb, "ja");
  }

  const filteredStaff = (() => {
    if (staffByDept.length === 0) return [];
    const byActive = staffByDept
      .filter(s => showInactive || activeMap[s.userId] !== false)
      .filter(s => {
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          return (s.userName || "").toLowerCase().includes(q);
        }
        return true;
      });
    const allWpKeys = [...workplaceItems.map(i => i.value), ...wpExtraItems.map(i => i.value)];
    if (allWpKeys.length > 0 && visibleWorkplaces.size === 0) return [];
    if (allWpKeys.length === 0) return [...byActive].sort(sortFn);
    return byActive.filter(s =>
      displayDates.some(date => {
        const day = getDayData(s.userId, date);
        if (day.off || !day.slots || day.slots.length === 0) return visibleWorkplaces.has("__off__");
        return day.slots.some(sl =>
          sl.workplace ? visibleWorkplaces.has(sl.workplace) : visibleWorkplaces.has("__none__")
        );
      })
    ).sort(sortFn);
  })();

  const positionItems  = positionOptions.map(p => ({ value: p, label: p }));
  const departmentItems = allDepartmentItems;

  const _f1 = positionOptions.some(p => !visiblePositions.has(p));
  const _f2 = allDepartmentItems.some(d => !visibleDepartments.has(d.value));
  const _f3 = workplaces.some(w => !visibleWorkplaces.has(w.name));
  const _f4 = workplaces.length > 0 && (!visibleWorkplaces.has("__none__") || !visibleWorkplaces.has("__off__"));
  const _f5 = COL_ITEMS.some(c => !colVisibility[c.value]);   // 表示列
  const isFiltered = _f1 || _f2 || _f3 || _f4 || _f5;

  /* ── handlers ── */
  async function changeStatus(weekStart, newStatus) {
    setStatusLoading(p => ({ ...p, [weekStart]: true }));
    try {
      await api.setWeekStatus(weekStart, newStatus);
      setData(p => ({ ...p, [weekStart]: { ...p[weekStart], status: newStatus } }));
    } catch { alert("ステータスの変更に失敗しました"); }
    finally { setStatusLoading(p => ({ ...p, [weekStart]: false })); }
  }

  async function changeMonthStatus(newStatus, half) {
    setMonthStatusLoading(true);
    try {
      const res = await api.managerMonthStatusSet(ym, newStatus, half);
      if (half === 1) setMonthStatus1(res.status);
      else setMonthStatus2(res.status);
    } catch (e) {
      setAlertMsg("ステータスの変更に失敗しました: " + e.message);
    } finally {
      setMonthStatusLoading(false);
    }
  }
  async function saveCell(userId, date, patch) {
    const week = findWeekForDate(weeksRaw, date);
    if (!week) return;
    setSavingCell(`${userId}_${date}`);
    try {
      await api.managerStaffDaySave(userId, { date, off: patch.off, slots: patch.slots });
      setData(prev => {
        const wk  = prev[week.weekStart];
        if (!wk) return prev;
        const row = wk.staffById[userId];
        if (!row) return prev;
        return {
          ...prev,
          [week.weekStart]: {
            ...wk,
            staffById: {
              ...wk.staffById,
              [userId]: {
                ...row,
                dayMap: { ...row.dayMap, [date]: { ...(row.dayMap[date] || { date }), off: patch.off, slots: patch.slots } },
              },
            },
          },
        };
      });
    } catch (e) {
      if (e.message && e.message.includes("他のユーザー")) {
        alert(e.message); await load(true);
      } else { alert("保存に失敗しました"); }
    } finally { setSavingCell(null); }
  }

  function handleWpToggle(name) {
    setVisibleWorkplaces(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function handleWpToggleAll(allKeys, allOn) {
    setVisibleWorkplaces(allOn ? new Set(allKeys) : new Set());
  }
  function recalcDepts(newVis) {
    const staffAfterPos = allStaff.filter(s => newVis.has(positions[s.userId] || ""));
    setVisibleDepartments(new Set(staffAfterPos.flatMap(s => staffDepts[s.userId] || [])));
  }
  function handlePosToggle(name) {
    const next = new Set(visiblePositions);
    next.has(name) ? next.delete(name) : next.add(name);
    setVisiblePositions(next); recalcDepts(next);
  }
  function handlePosToggleAll(allKeys, allOn) {
    const next = allOn ? new Set(allKeys) : new Set();
    setVisiblePositions(next); recalcDepts(next);
  }
  function handleDeptToggle(name) {
    setVisibleDepartments(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function handleDeptToggleAll(allKeys, allOn) {
    setVisibleDepartments(allOn ? new Set(allKeys) : new Set());
  }
  function handleReset() {
    localStorage.removeItem("mgrFilterPos");
    localStorage.removeItem("mgrFilterDept");
    localStorage.removeItem("mgrFilterWp");
    setVisiblePositions(new Set(positionOptions));
    setVisibleDepartments(new Set(departments.map(d => d.name)));
    setVisibleWorkplaces(new Set([...workplaces.map(w => w.name), "__none__", "__off__"]));
    setColVisibility({ number: true, position: true, department: true });   // 表示列 — тоже сбрасываем
  }

  // 表示行: хотя бы одна строка должна оставаться
  function handleRowToggle(key) {
    setVisibleRows(prev => {
      const n = new Set(prev);
      if (n.has(key)) {
        if (n.size === 1) return prev;
        n.delete(key);
      } else {
        n.add(key);
      }
      return n;
    });
  }
  function handleRowToggleAll(allKeys, turnOn) {
    if (!turnOn) return;
    setVisibleRows(new Set(allKeys));
  }

  function selectWholeMonth(userId) {
    setOpenCell(null);
    setSelectedCells(displayDates.map(date => ({ userId, date })));
  }

  function handleCellClick(e, userId, date, isOpen, isSaving) {
    if (isSaving) return;
    if (e.shiftKey) {
      e.preventDefault();
      setOpenCell(null);
      setSelectedCells(prev => {
        if (prev.length > 0 && prev[0].userId !== userId) return [{ userId, date }];
        const exists = prev.find(c => c.date === date);
        if (exists) return prev.filter(c => c.date !== date);
        return [...prev, { userId, date }];
      });
    } else {
      setSelectedCells([]);
      setOpenCell(isOpen ? null : { userId, date });
    }
  }

  function handleContextMenu(e, userId, date) {
    e.preventDefault();
    setOpenCell(null);
    setContextMenu({ x: e.clientX, y: e.clientY, userId, date });
  }

  async function saveBulkCells(patch) {
    setBulkSaving(true);
    try {
      await Promise.all(
        selectedCells.map(({ userId, date }) =>
          api.managerStaffDaySave(userId, { date, off: patch.off, slots: patch.slots })
        )
      );
      await load(true);
      setSelectedCells([]);
    } catch (e) {
      setAlertMsg("保存に失敗しました: " + e.message);
    } finally {
      setBulkSaving(false);
    }
  }

  // Excel = 選択中のシフト表: период и сотрудники — как на экране
  async function handleReport() {
    setReportLoading(true);
    try {
      if (displayDates.length === 0) {
        setAlertMsg("期間を正しく設定してください");
        return;
      }
      const from = displayDates[0];
      const to   = displayDates[displayDates.length - 1];
      await api.reportShiftScreen(from, to, {
        userIds:    filteredStaff.map(s => s.userId),                 // порядок — как на экране
        columns:    COL_ITEMS.map(c => c.value).filter(k => colVisibility[k]),
        workplaces: [...visibleWorkplaces],                           // места + __none__ + __off__
      });
    } catch (e) {
      setAlertMsg("レポートの生成に失敗しました: " + e.message);
    } finally {
      setReportLoading(false);
    }
  }

  /* ── period validation ── */
  const pDays      = periodDays(periodFrom, periodTo);
  const periodOk   = pDays >= 7 && pDays <= 35;
  const periodWarn = periodFrom && periodTo && !periodOk
    ? (pDays < 7 ? "7日以上を指定してください" : "50日以内を指定してください")
    : null;

  /* ── ‹ › : месяц ±1, неделя ±7 дней ── */
  function shiftPeriod(dir) {
    if (viewMode === "month") {
      const [y, m] = ym.split("-").map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    } else if (viewMode === "week") {
      const ws = addDays(selectedWeek, dir * 7);
      setSelectedWeek(ws);
      setYm(ws.slice(0, 7));
    }
  }
  const yearChoices = useMemo(() => {
    const set = new Set(yearOptions);
    set.add(ym.split("-")[0]);
    return [...set].sort();
  }, [yearOptions, ym]);

  /* ── флаги и наборы для новой панели ── */
  const todayStr      = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const weekStartSet  = new Set(weeksRaw.map(w => w.weekStart));
  const wpAllItems    = [...workplaceItems, ...wpExtraItems.map(i => ({ ...i, special: true }))];
  const wpFiltered    = _f3 || _f4;
  const colsFiltered  = COL_ITEMS.some(c => !colVisibility[c.value]);
  const colSet        = new Set(COL_ITEMS.map(c => c.value).filter(k => colVisibility[k]));
  const toggleCol     = k => setColVisibility(v => ({ ...v, [k]: !v[k] }));
  const toggleAllCols = (keys, on) => setColVisibility(v => ({ ...v, ...Object.fromEntries(keys.map(k => [k, on])) }));
  const sortChanged   = !(sortConfig.field === "sortOrder" && sortConfig.dir === "asc");
  const rowsFiltered  = ROW_ITEMS.some(i => !visibleRows.has(i.value));
  const shownRows     = ROW_ITEMS.filter(i => visibleRows.has(i.value));
  /* ── render ── */
  return (
    <ManagerLayout name={getName()} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>
        <div className={styles.card}>

          {/* ══ Шапка: статусы месяца + действия ══ */}
          <div className={styles.headRow}>
            <div className={styles.headLeft}>
              {viewMode === "month" ? (
                <>
                  <StatusSelect label="1〜15日" value={monthStatus1} disabled={monthStatusLoading}
                    onChange={v => changeMonthStatus(v, 1)} />
                  <StatusSelect label="16〜末日" value={monthStatus2} disabled={monthStatusLoading}
                    onChange={v => changeMonthStatus(v, 2)} />
                  {monthStatusLoading && <span className={styles.statusSpinner}>…</span>}
                </>
              ) : (
                <span className={styles.statusHint}>ステータスは「月」表示で変更できます</span>
              )}
            </div>

            <div className={styles.headActions}>
              <button type="button" className={styles.excelBtn}
                onClick={handleReport}
                disabled={loading || reportLoading || filteredStaff.length === 0}>
                <IcoDownload />{reportLoading ? "..." : "Excel"}
              </button>
              <span className={styles.headSep} />
              <button type="button" className={styles.iconBtn} data-tip="お知らせ（準備中）" aria-label="お知らせ" disabled>
                <IcoBell />
              </button>
              <button type="button" className={styles.iconBtn} data-tip="設定" aria-label="設定" onClick={() => onNavigate("SETTINGS")}>
                <IcoGear />
              </button>
              <button type="button" className={styles.iconBtn} data-tip="希望シフト" aria-label="希望シフト" onClick={() => onNavigate("PREFS")}>
                <IcoUser />
              </button>
              <button type="button" className={styles.iconBtn} data-tip="ログアウト" aria-label="ログアウト" onClick={onLogout}>
                <IcoLogout />
              </button>
            </div>
          </div>

          {/* ══ Строка инструментов ══ */}
          <div className={styles.filterRow}>
            <div className={styles.periodNav}>
              {viewMode !== "period" && (
                <button type="button" className={styles.navBtn} onClick={() => shiftPeriod(-1)} aria-label="前へ"><IcoPrev /></button>
              )}

              {viewMode === "month" && (
                <>
                  <select className={styles.monthSelect}
                    value={ym.split("-")[0]}
                    onChange={e => setYm(`${e.target.value}-${ym.split("-")[1]}`)}>
                    {yearChoices.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select className={styles.monthSelect}
                    value={ym.split("-")[1]}
                    onChange={e => setYm(`${ym.split("-")[0]}-${e.target.value}`)}>
                    {MONTHS_JA.map((label, i) => (
                      <option key={i} value={String(i + 1).padStart(2, "0")}>{label}</option>
                    ))}
                  </select>
                </>
              )}

              {viewMode === "week" && (
                <select className={styles.monthSelect} value={selectedWeek}
                  onChange={e => setSelectedWeek(e.target.value)}>
                  {!weekOptions.some(w => w.weekStart === selectedWeek) && (
                    <option value={selectedWeek}>
                      {selectedWeek.slice(5).replace("-","/")} 〜 {addDays(selectedWeek, 6).slice(5).replace("-","/")}
                    </option>
                  )}
                  {weekOptions.map(w => (
                    <option key={w.weekStart} value={w.weekStart}>
                      {w.weekStart.slice(5).replace("-","/")} 〜 {w.weekEnd.slice(5).replace("-","/")}
                    </option>
                  ))}
                </select>
              )}

              {viewMode === "period" && (
                <div className={styles.periodInputs}>
                  <input type="date" value={periodFrom}
                    className={cx(styles.dateInput, periodWarn && styles.dateInputWarn)}
                    onChange={e => setPeriodFrom(e.target.value)} />
                  <span className={styles.tilde}>〜</span>
                  <input type="date" value={periodTo} min={periodFrom || undefined}
                    className={cx(styles.dateInput, periodWarn && styles.dateInputWarn)}
                    onChange={e => setPeriodTo(e.target.value)} />
                  {periodFrom && periodTo && (
                    <span className={cx(styles.periodDays, !periodOk && styles.periodDaysWarn)}>{pDays}日</span>
                  )}
                </div>
              )}

              {viewMode !== "period" && (
                <button type="button" className={styles.navBtn} onClick={() => shiftPeriod(1)} aria-label="次へ"><IcoNext /></button>
              )}
            </div>

            <div className={styles.segment}>
              {VIEW_MODES.map(m => (
                <button key={m.value} type="button"
                  className={cx(styles.segBtn, styles.segBtnSm, viewMode === m.value && styles.segBtnGreen)}
                  onClick={() => setViewMode(m.value)}>
                  {m.label}
                </button>
              ))}
            </div>

            <label className={styles.search}>
              <IcoSearch />
              <input type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="氏名で検索..." />
              {/* ✕ — очистить поиск (место зарезервировано, поле не «прыгает») */}
              <button type="button"
                className={cx(styles.searchClear, !searchQuery && styles.searchClearHidden)}
                onClick={e => { e.preventDefault(); setSearchQuery(""); }}
                tabIndex={searchQuery ? 0 : -1}
                aria-label="検索をクリア">
                <IcoClear />
              </button>
            </label>

            {departmentItems.length > 0 && (
              <DropdownShell label="部署" filtered={_f2} width={220}>
                <CheckGroup items={departmentItems} set={visibleDepartments}
                  onToggle={handleDeptToggle} onToggleAll={handleDeptToggleAll} />
              </DropdownShell>
            )}
            {positionItems.length > 0 && (
              <DropdownShell label="職種・役職" filtered={_f1} width={220}>
                <CheckGroup items={positionItems} set={visiblePositions}
                  onToggle={handlePosToggle} onToggleAll={handlePosToggleAll} />
              </DropdownShell>
            )}
            {wpAllItems.length > 0 && (
              <DropdownShell label="勤務場所" filtered={wpFiltered} width={220}>
                <CheckGroup items={wpAllItems} set={visibleWorkplaces}
                  onToggle={handleWpToggle} onToggleAll={handleWpToggleAll} />
              </DropdownShell>
            )}

            {/* На широком экране — отдельными кнопками */}
            <DropdownShell label="表示列" filtered={colsFiltered} width={180} className={styles.wideOnly}>
              <CheckGroup items={COL_ITEMS} set={colSet} onToggle={toggleCol} onToggleAll={toggleAllCols} />
            </DropdownShell>
            <DropdownShell label="表示行" filtered={rowsFiltered} width={180} className={styles.wideOnly}>
              <CheckGroup items={ROW_ITEMS} set={visibleRows}
                onToggle={handleRowToggle} onToggleAll={handleRowToggleAll} hideAll />
            </DropdownShell>
            <DropdownShell label="並び替え" filtered={sortChanged} width={200} className={styles.wideOnly}>
              <SortList sortConfig={sortConfig} setSortConfig={setSortConfig} />
            </DropdownShell>

            {/* На узком экране — всё в «その他» */}
            <DropdownShell label="その他" filtered={sortChanged || colsFiltered || rowsFiltered} width={220} className={styles.narrowOnly}>
              <CheckGroup title="表示列" items={COL_ITEMS} set={colSet} onToggle={toggleCol} onToggleAll={toggleAllCols} />
              <div className={styles.wpDropdownDivider} />
              <CheckGroup title="表示行" items={ROW_ITEMS} set={visibleRows}
                onToggle={handleRowToggle} onToggleAll={handleRowToggleAll} hideAll />
              <div className={styles.wpDropdownDivider} />
              <SortList sortConfig={sortConfig} setSortConfig={setSortConfig} />
            </DropdownShell>

            {/* リセット — сразу за фильтрами, не в правом углу */}
            {isFiltered && (
              <button type="button" className={styles.resetBtn} onClick={handleReset}>リセット</button>
            )}
          </div>

          {viewMode === "period" && periodWarn && (
            <div className={styles.warnBar}>⚠️ {periodWarn}</div>
          )}

          {/* ══ Таблица ══ */}
          {loading ? (
            <div className={styles.loading}>読み込み中...</div>
          ) : displayDates.length === 0 ? (
            <div className={styles.loading}>
              {viewMode === "period" ? "期間を正しく設定してください（7〜35日）" : "データがありません"}
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table} style={colVisibility.number ? undefined : { "--w-no": "0px" }}>
                <thead>
                  <tr>
                    {colVisibility.number && <th className={cx(styles.th, styles.thNo, styles.stickyNo)}>№</th>}
                    <th className={cx(styles.th, styles.thName, styles.stickyName)}>
                      <span className={styles.thNameMain}>氏名</span>
                      {(colVisibility.position || colVisibility.department) && (
                        <span className={styles.thNameSub}>
                          {colVisibility.position && <span className={styles.thSubPos}>職種・役職</span>}
                          {colVisibility.position && colVisibility.department && " / "}
                          {colVisibility.department && <span className={styles.thSubDept}>部署</span>}
                        </span>
                      )}
                    </th>
                    <th className={cx(styles.th, styles.thLabels, styles.stickyLabels)} />
                    {displayDates.map(date => {
                      const wd = new Date(date).getDay();
                      const d  = parseInt(date.slice(8), 10);
                      const isToday = date === todayStr;
                      return (
                        <th key={date} className={cx(
                          styles.th, styles.thDay,
                          wd === 6 && styles.colSat, wd === 0 && styles.colSun,
                          weekStartSet.has(date) && styles.colMon,
                          isToday && styles.colToday, isToday && styles.thToday,
                        )}>
                          {isToday && <span className={styles.todayBadge}>今日</span>}
                          <span className={styles.thNum}>{d}</span>
                          <span className={styles.thWd}>{WD_JA[wd]}</span>
                        </th>
                      );
                    })}
                    <th className={cx(styles.th, styles.thOff, styles.stickyOff)}>
                      <span className={styles.thNum}>公休</span>
                      <span className={styles.thWd}>日数</span>
                    </th>
                    <th className={cx(styles.th, styles.thTotal, styles.stickyTotal)}>
                      <span className={styles.thNum}>勤務</span>
                      <span className={styles.thWd}>時間</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={displayDates.length + (colVisibility.number ? 5 : 4)} className={styles.empty}>
                        {allStaff.length === 0 ? "スタッフが登録されていません" : "該当するスタッフが見つかりません"}
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map(staff => {
                      const maxSlots = maxSlotsForStaff(staff.userId);
                      const workMin  = calcWorkMinutes(staff.userId);
                      return (
                        <tr key={staff.userId} className={styles.row} data-staff={staff.userId}>
                          {colVisibility.number && (
                            <td className={cx(styles.td, styles.tdNo, styles.stickyNo)}>{sortOrders[staff.userId] ?? "—"}</td>
                          )}

                          <td className={cx(styles.td, styles.tdName, styles.stickyName)}>
                            <div className={styles.nameWrap}>
                              <div className={styles.nameText}>
                                <div className={styles.staffName}>{staff.userName}</div>
                                {colVisibility.position && positions[staff.userId] && (
                                  <div className={styles.staffPos}>{positions[staff.userId]}</div>
                                )}
                                {colVisibility.department && (staffDepts[staff.userId] || []).length > 0 && (
                                  <div className={styles.staffDept}>{(staffDepts[staff.userId] || []).join("・")}</div>
                                )}
                              </div>
                              <button type="button" className={styles.selAllBtn}
                                title="表示中の全日を選択（一括でシフトを設定できます）"
                                aria-label="全日を選択"
                                onClick={() => selectWholeMonth(staff.userId)}>
                                <IcoSelectAll />
                              </button>
                            </div>
                          </td>

                          {/* Подписи строк — на каждую смену свой блок */}
                          <td className={cx(styles.td, styles.tdLabels, styles.stickyLabels)}>
                            {Array.from({ length: maxSlots }, (_, si) => (
                              <div key={si} className={cx(styles.slot, si < maxSlots - 1 && styles.slotSep)}>
                                {shownRows.map(r => (
                                  <div key={r.value} className={cx(styles.line, styles.lineLabel)}>{r.label}</div>
                                ))}
                              </div>
                            ))}
                          </td>

                          {displayDates.map(date => {
                            const day      = getDayData(staff.userId, date);
                            const slots    = day.slots || [];
                            const wd       = new Date(date).getDay();
                            const isToday  = date === todayStr;
                            const isSelected = selectedCells.some(c => c.userId === staff.userId && c.date === date);
                            const isSaving   = savingCell === `${staff.userId}_${date}`;
                            const isOpen     = openCell?.userId === staff.userId && openCell?.date === date;
                            const isOffDay   = day.off || slots.length === 0;

                            const key = `${staff.userId}_${date}`;
                            if (!cellAnchorRefs.current[key]) cellAnchorRefs.current[key] = { current: null };
                            const anchorRef = cellAnchorRefs.current[key];

                            const prevDate = addDays(date, -1);
                            const prevDayOvernightSlots = (getDayData(staff.userId, prevDate).slots || []).filter(s =>
                              s.nextDay || isNextDay(formatTime(s.startTime), formatTime(s.endTime))
                            );

                            const visibleSlots = slots.filter(s => s.workplace
                              ? visibleWorkplaces.has(s.workplace)
                              : visibleWorkplaces.has("__none__"));

                            return (
                              <td key={date}
                                className={cx(
                                  styles.td, styles.tdDay,
                                  wd === 6 && styles.colSat, wd === 0 && styles.colSun,
                                  weekStartSet.has(date) && styles.colMon,
                                  isToday && styles.colToday,
                                  (isOffDay || isSaving) && styles.tdMiddle,
                                  isOpen && styles.cellOpen,
                                  isSelected && styles.cellSelected,
                                )}
                                onClick={e => handleCellClick(e, staff.userId, date, isOpen, isSaving)}
                                onContextMenu={e => handleContextMenu(e, staff.userId, date)}>

                                {/* Фиолетовая полоска — ночная смена с предыдущего дня */}
                                {prevDayOvernightSlots.length > 0 && <div className={styles.nextDayStripe} />}

                                <div className={styles.cellAnchor} ref={el => { anchorRef.current = el; }}>
                                  {isSaving ? (
                                    <span className={styles.cellBusy}>…</span>
                                  ) : isOffDay ? (
                                    visibleWorkplaces.has("__off__") && <span className={styles.cellOff}>休</span>
                                  ) : (
                                    visibleSlots.map((s, si) => {
                                      const nd = s.nextDay || isNextDay(formatTime(s.startTime), formatTime(s.endTime));
                                      const workStr  = getWorkHint(s.startTime, s.endTime, s.breakOverrideMinutes, breakRules);
                                      const breakMin = (s.startTime && s.endTime)
                                        ? (s.breakOverrideMinutes !== null && s.breakOverrideMinutes !== undefined
                                            ? s.breakOverrideMinutes
                                            : getAutoBreakMinutes(s.startTime, s.endTime, breakRules))
                                        : null;
                                      const breakStr = fmtBreakMinutes(breakMin);
                                      return (
                                        <div key={si} className={cx(styles.slot, si < visibleSlots.length - 1 && styles.slotSep)}>
                                          {visibleRows.has("in") && (
                                            <div className={styles.line}><span className={styles.time}>{formatTime(s.startTime)}</span></div>
                                          )}
                                          {visibleRows.has("out") && (
                                            <div className={styles.line}>
                                              <span className={cx(styles.time, nd && styles.nextDayText)}>{formatTime(s.endTime)}</span>
                                              {s.last && <span className={styles.lastBadge}>L</span>}
                                            </div>
                                          )}
                                          {visibleRows.has("work") && (
                                            <div className={styles.line}><span className={styles.work}>{workStr || ""}</span></div>
                                          )}
                                          {visibleRows.has("break") && (
                                            <div className={styles.line}><span className={styles.dur}>{breakStr || ""}</span></div>
                                          )}
                                          {visibleRows.has("place") && (
                                            <div className={styles.line}>
                                              {s.workplace && <span className={styles.place} title={s.workplace}>{s.workplace}</span>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {isOpen && (
                                  <CellPopover
                                    day={day}
                                    currentDate={date}
                                    prevDaySlots={prevDayOvernightSlots}
                                    onGoToPrevDay={() => setOpenCell({ userId: staff.userId, date: prevDate })}
                                    staffName={staff.userName}
                                    staffPosition={positions[staff.userId] || ""}
                                    staffDepartments={staffDepts[staff.userId] || []}
                                    workplaces={workplaces}
                                    onClose={() => setOpenCell(null)}
                                    onSave={patch => { setOpenCell(null); saveCell(staff.userId, date, patch); }}
                                    breakRules={breakRules}
                                  />
                                )}
                              </td>
                            );
                          })}

                          <td className={cx(styles.td, styles.tdOff, styles.stickyOff)}>
                            {countOffDays(staff.userId)}
                          </td>
                          <td className={cx(styles.td, styles.tdTotal, styles.stickyTotal)}>
                            <span className={styles.totalH}>{Math.floor(workMin / 60)}時間</span>
                            <span className={styles.totalM}>{workMin % 60}分</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ Нижняя строка: легенда + счётчик ══ */}
          <div className={styles.legend}>
            {[
              { dot: "#1a8a5f", halo: "#eefaf4", label: "今日" },
              { dot: "#7c3aed", halo: "#ede9fe", label: "翌日退勤" },
            ].map(({ dot, halo, label }) => (
              <span key={label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: dot, boxShadow: `0 0 0 4px ${halo}` }} />{label}
              </span>
            ))}
            <span className={styles.legendItem}><span className={styles.lastBadge}>L</span>ラスト</span>
            <span className={styles.legendItem}><span className={styles.cellOff}>休</span>休み</span>
            <span className={styles.legendHint}>Shift＋クリックで複数選択・右クリックでメニュー</span>

            <div className={styles.legendRight}>
              <label className={styles.check}>
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                非アクティブを表示
              </label>
              {!loading && allStaff.length > 0 && (
                <span className={styles.countText}>
                  表示中 <b>{filteredStaff.length}</b> / {allStaff.length} 人
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Панель массового выделения ── */}
      {selectedCells.length > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}><b>{selectedCells.length}</b>日選択中</span>
          <button type="button" className={styles.bulkBtn}
            onClick={() => setBulkOpen(true)} disabled={bulkSaving}>
            <IcoEdit />一括編集
          </button>
          <button type="button" className={styles.bulkBtnGhost} onClick={() => setSelectedCells([])}>
            <IcoClose />選択解除
          </button>
        </div>
      )}

      {/* ── Overlays ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          selectedCount={selectedCells.length}
          copiedPattern={copiedPattern}
          onEdit={() => setOpenCell({ userId: contextMenu.userId, date: contextMenu.date })}
          onCopy={() => {
            const day = getDayData(contextMenu.userId, contextMenu.date);
            setCopiedPattern({ off: day.off, slots: day.slots || [] });
          }}
          onPaste={() => {
            if (selectedCells.length > 0) saveBulkCells(copiedPattern);
            else saveCell(contextMenu.userId, contextMenu.date, copiedPattern);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {bulkOpen && selectedCells.length > 0 && (() => {
        const uid = selectedCells[0].userId;
        const st  = allStaff.find(x => x.userId === uid);
        return (
          <CellPopover
            day={{ off: false, slots: [] }}
            bulkDates={selectedCells.map(c => c.date)}
            staffName={st?.userName || ""}
            staffPosition={positions[uid] || ""}
            staffDepartments={staffDepts[uid] || []}
            workplaces={workplaces}
            breakRules={breakRules}
            onClose={() => setBulkOpen(false)}
            onSave={patch => { setBulkOpen(false); saveBulkCells(patch); }}
          />
        );
      })()}

      {reportLoading && <ReportLoader />}
      {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
    </ManagerLayout>
  );
}