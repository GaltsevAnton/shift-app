import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import styles from "./ManagerTablePage.module.css";

const WD_JA     = ["日","月","火","水","木","金","土"];
const MONTHS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const VIEW_MODES = [
  { value: "month",  label: "月" },
  { value: "week",   label: "週" },
  { value: "period", label: "期間" },
];

const SORT_FIELDS = [
  { value: "name",       label: "氏名" },
  { value: "position",   label: "職種・役職" },
  { value: "department", label: "部署" },
];

const STATUS_FILTER_ITEMS = [
  { value: "working",  label: "出勤中" },
  { value: "break",    label: "休憩中" },
  { value: "finished", label: "退勤済み" },
  { value: "none",     label: "未出勤" },
];

const COLOR_FILTER_ITEMS = [
  { value: "green",   label: "🟢 時間通り" },
  { value: "red",     label: "🔴 遅刻（出勤）" },
  { value: "yellow",  label: "🟡 早退（退勤）" },
  { value: "blue",    label: "🔵 シフト予定あり" },
  { value: "gray",    label: "⚪ シフトなし・出勤あり" },
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
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function currentMondayLocal() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - diff);
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
function weeksInMonth(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  const first  = new Date(y, m - 1, 1);
  const last   = new Date(y, m, 0);
  const start  = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const end    = new Date(last);
  end.setDate(last.getDate() - ((last.getDay() + 6) % 7));
  const weeks  = [];
  let cur = new Date(start);
  while (cur <= end) {
    const ws = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
    const we = new Date(cur); we.setDate(we.getDate() + 6);
    const weStr = `${we.getFullYear()}-${String(we.getMonth()+1).padStart(2,"0")}-${String(we.getDate()).padStart(2,"0")}`;
    weeks.push({ weekStart: ws, weekEnd: weStr });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}
function periodDays(from, to) {
  if (!from || !to) return 0;
  return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
}
function isNextDayJst(recordedAt, cellDate) {
  if (!recordedAt) return false;
  const d = new Date(recordedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  return d !== cellDate;
}

// Группируем плоские пробивки в сессии (CLOCK_IN → BREAK_* → CLOCK_OUT) по пользователю и дню
function buildSessionsFromRecords(records) {
  const byUser = {};
  records.forEach(r => {
    if (!byUser[r.userId]) byUser[r.userId] = [];
    byUser[r.userId].push(r);
  });
  const result = {};
  Object.entries(byUser).forEach(([uid, recs]) => {
    const sorted = [...recs].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    let cur = null;
    const sessions = [];
    for (const r of sorted) {
      if (r.recordType === "CLOCK_IN") {
        if (cur) sessions.push(cur);
        cur = { workDate: r.workDate, clockIn: r.recordedAt, clockOut: null, breakStart: null, breakEnd: null };
      } else if (cur) {
        if (r.recordType === "BREAK_START") cur.breakStart = r.recordedAt;
        if (r.recordType === "BREAK_END")   cur.breakEnd   = r.recordedAt;
        if (r.recordType === "CLOCK_OUT") { cur.clockOut = r.recordedAt; sessions.push(cur); cur = null; }
      }
    }
    if (cur) sessions.push(cur);
    result[uid] = {};
    sessions.forEach(s => {
      if (!result[uid][s.workDate]) result[uid][s.workDate] = [];
      result[uid][s.workDate].push(s);
    });
  });
  return result;
}

const HALF_HOUR_MS = 30 * 60 * 1000;

// 出勤/休憩開始: строго вверх к получасу (даже если ровно на отметке — сдвигаем на следующую)
function roundUpHalfHour(dateLike) {
  const ms = new Date(dateLike).getTime();
  const bucket = Math.floor(ms / HALF_HOUR_MS) + 1;
  return new Date(bucket * HALF_HOUR_MS);
}

// 退勤/休憩終了: строго вниз к получасу (даже если ровно на отметке — сдвигаем на предыдущую)
function roundDownHalfHour(dateLike) {
  const ms = new Date(dateLike).getTime();
  const bucket = Math.floor((ms - 1) / HALF_HOUR_MS);
  return new Date(bucket * HALF_HOUR_MS);
}

// Округление ДЛИТЕЛЬНОСТИ (не меток) к ближайшим 30 мин — используется для перерыва
function roundNearestHalfHourMinutes(mins) {
  return Math.round(mins / 30) * 30;
}

function toMinutesOfDay(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// Плановое время (HH:MM) + дата (YYYY-MM-DD) → реальный Date в JST
function planTimeToDate(workDate, hhmm) {
  if (!workDate || !hhmm) return null;
  const t = hhmm.slice(0, 5);
  return new Date(`${workDate}T${t}:00+09:00`);
}

// Плановая длительность перерыва слота: ручной override, иначе авто по 休憩ルール от ПЛАНОВОЙ длительности
function plannedSlotBreakMinutes(slot, breakRules = []) {
  if (!slot) return 0;
  if (slot.breakOverrideMinutes !== null && slot.breakOverrideMinutes !== undefined) {
    return slot.breakOverrideMinutes;
  }
  const start = toMinutesOfDay(slot.startTime);
  let end = toMinutesOfDay(slot.endTime);
  if (start === null || end === null) return 0;
  if (end <= start) end += 24 * 60; // смена через полночь
  const duration = end - start;
  const rule = [...breakRules]
    .filter(r => duration > r.thresholdMinutes)
    .sort((a, b) => b.thresholdMinutes - a.thresholdMinutes)[0];
  return rule ? rule.breakMinutes : 0;
}

// Авторасчёт перерыва по ФАКТИЧЕСКОЙ длительности (старая логика, для дней без плана)
function autoBreakMinutesByGross(grossMin, breakRules = []) {
  const rule = [...breakRules]
    .filter(r => grossMin > r.thresholdMinutes)
    .sort((a, b) => b.thresholdMinutes - a.thresholdMinutes)[0];
  return rule ? rule.breakMinutes : 0;
}

// Сопоставление фактических смен с плановыми слотами: по порядку (сортировка по времени начала)
function matchSessionsToSlots(sessions, slots) {
  const sortedSessions = [...sessions].sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn));
  const sortedSlots = [...(slots || [])]
    .filter(sl => sl.startTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return sortedSessions.map((session, i) => ({ session, slot: sortedSlots[i] || null }));
}

// Основной расчёт официального 出勤/退勤/休憩/実働 для одной смены
function computeSessionOfficial(session, slot, workDate, breakRules = []) {
  const hasPlan = !!slot;
  const clockInDate  = session.clockIn  ? new Date(session.clockIn)  : null;
  const clockOutDate = session.clockOut ? new Date(session.clockOut) : null;

  let officialIn = clockInDate, lateIn = false;
  let officialOut = clockOutDate, earlyOut = false;
  let planStart = null, planEnd = null;

  if (hasPlan) {
    planStart = planTimeToDate(workDate, slot.startTime);
    planEnd   = planTimeToDate(workDate, slot.endTime);
    if (planStart && planEnd && (slot.nextDay || planEnd <= planStart)) {
      planEnd = new Date(planEnd.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  if (clockInDate) {
    if (hasPlan && planStart) {
      if (clockInDate < planStart) {
        officialIn = planStart; // строго раньше плана — вовремя
      } else {
        officialIn = roundUpHalfHour(clockInDate); // >= план — опоздание
        lateIn = true;
      }
    } else {
      officialIn = roundUpHalfHour(clockInDate); // нет плана — просто округляем
    }
  }

  if (clockOutDate) {
    if (hasPlan && planEnd) {
      if (clockOutDate > planEnd) {
        officialOut = planEnd; // строго позже плана — вовремя
      } else {
        officialOut = roundDownHalfHour(clockOutDate); // <= план — ушёл рано
        earlyOut = true;
      }
    } else {
      officialOut = roundDownHalfHour(clockOutDate);
    }
  }

  // 休憩
  let officialBreakMinutes = 0;
  if (hasPlan) {
    const planBreakMin = plannedSlotBreakMinutes(slot, breakRules);
    if (session.breakStart && session.breakEnd) {
      const rawMin = Math.round((new Date(session.breakEnd) - new Date(session.breakStart)) / 60000);
      const roundedMin = roundNearestHalfHourMinutes(Math.max(rawMin, 0));
      officialBreakMinutes = roundedMin <= planBreakMin ? planBreakMin : roundedMin;
    } else {
      officialBreakMinutes = planBreakMin; // не пробивал — берём план как есть
    }
  } else {
    if (session.breakStart && session.breakEnd) {
      const rawMin = Math.round((new Date(session.breakEnd) - new Date(session.breakStart)) / 60000);
      officialBreakMinutes = rawMin > 0 ? rawMin : 0; // старая логика: точный факт, без округления
    } else if (officialIn && officialOut) {
      const grossMin = Math.round((officialOut - officialIn) / 60000);
      officialBreakMinutes = autoBreakMinutesByGross(grossMin, breakRules);
    }
  }

  let workMin = null;
  if (officialIn && officialOut) {
    const grossMin = Math.round((officialOut - officialIn) / 60000);
    workMin = Math.max(grossMin - officialBreakMinutes, 0);
  }

  const inColor  = !clockInDate  ? null : (!hasPlan ? "#f1f5f9" : (lateIn   ? "#fee2e2" : "#dcfce7"));
  const outColor = !clockOutDate ? null : (!hasPlan ? "#f1f5f9" : (earlyOut ? "#fef9c3" : "#dcfce7"));

  return { officialIn, officialOut, officialBreakMinutes, workMin, hasPlan, lateIn, earlyOut, inColor, outColor };
}

function fmtHM(mins) {
  if (mins === null || mins === undefined) return "0時間0分";
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}時間${m}分`;
}

function fmtTime(instant) {
  if (!instant) return "--:--";
  return new Date(instant).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  });
}
function saveFilterSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* ignore */ }
}
function loadFilterSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch { return null; }
}
function getName() {
  return localStorage.getItem("staffName") || "";
}
function pagerBtnStyle(disabled) {
  return {
    padding: "5px 10px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6,
    background: disabled ? "#f1f5f9" : "#fff",
    color: disabled ? "#cbd5e1" : "#334155",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
function fmtWeekLabel(ws, we) {
  const wsD = new Date(ws), weD = new Date(we);
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  return `${fmt(wsD)}〜${fmt(weD)}`;
}

/* ─── ColToggleDropdown ─────────────────────────────────── */
function ColToggleDropdown({ colVisibility, onColVisibilityChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      function onDown(e) {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  const COL_TOGGLES = [
    { key: "number",     label: "№" },
    { key: "position",   label: "職種・役職" },
    { key: "department", label: "部署" },
  ];
  const allOn = COL_TOGGLES.every(c => colVisibility[c.key]);

  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button type="button"
        className={`${styles.wpDropdownBtn} ${open ? styles.wpDropdownBtnActive : ""}`}
        onClick={() => setOpen(v => !v)}>
        表示列
        <span className={styles.sortArrow}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className={styles.wpDropdownPanel}>
          <label className={styles.wpDropdownAll}>
            <input type="checkbox" className={styles.colToggleCheck}
              checked={allOn}
              onChange={() => {
                const next = !allOn;
                onColVisibilityChange({ number: next, position: next, department: next });
              }}
            />
            <span>すべて</span>
          </label>
          <div className={styles.wpDropdownDivider} />
          {COL_TOGGLES.map(c => (
            <label key={c.key} className={styles.wpDropdownItem}>
              <input type="checkbox" className={styles.colToggleCheck}
                checked={colVisibility[c.key]}
                onChange={() => onColVisibilityChange({ ...colVisibility, [c.key]: !colVisibility[c.key] })}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── CheckDropdown ─────────────────────────────────────── */
function CheckDropdown({ label, items, visibleSet, onToggle, onToggleAll, extraItems, panelMaxHeight }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      function onDown(e) {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  const allKeys = [...items.map(i => i.value), ...(extraItems||[]).map(i => i.value)];
  const allOn   = allKeys.length > 0 && allKeys.every(k => visibleSet.has(k));
  const someOn  = allKeys.some(k => visibleSet.has(k));
  const isFiltered = !allOn;

  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button type="button"
        className={`${styles.wpDropdownBtn} ${open ? styles.wpDropdownBtnActive : ""} ${isFiltered ? styles.wpDropdownBtnFiltered : ""}`}
        onClick={() => setOpen(v => !v)}>
        {label}
        <span className={styles.sortArrow}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className={styles.wpDropdownPanel}
          style={panelMaxHeight ? { maxHeight: panelMaxHeight, overflowY: "auto" } : undefined}>
          <label className={styles.wpDropdownAll}>
            <input type="checkbox" className={styles.colToggleCheck}
              checked={allOn}
              ref={el => { if (el) el.indeterminate = !allOn && someOn; }}
              onChange={() => onToggleAll(allKeys, !allOn)}
            />
            <span>すべて</span>
          </label>
          <div className={styles.wpDropdownDivider} />
          {items.map(item => (
            <label key={item.value} className={styles.wpDropdownItem}>
              <input type="checkbox" className={styles.colToggleCheck}
                checked={visibleSet.has(item.value)}
                onChange={() => onToggle(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
          {extraItems && extraItems.length > 0 && (
            <>
              <div className={styles.wpDropdownDivider} />
              {extraItems.map(item => (
                <label key={item.value} className={styles.wpDropdownItem}>
                  <input type="checkbox" className={styles.colToggleCheck}
                    checked={visibleSet.has(item.value)}
                    onChange={() => onToggle(item.value)}
                  />
                  <span className={styles.wpSpecialLabel}>{item.label}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── AttendancePage ────────────────────────────────────── */
export default function AttendancePage({ view, onNavigate, onLogout }) {

  /* ── view mode ── */
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("attViewMode") || "month"
  );
  const [ym, setYm] = useState(
    () => localStorage.getItem("attSelectedMonth") || currentYM()
  );
  const [selectedWeek, setSelectedWeek] = useState(
    () => localStorage.getItem("attSelectedWeek") || currentMondayLocal()
  );
  const [periodFrom, setPeriodFrom] = useState(
    () => localStorage.getItem("attRangeFrom") || ""
  );
  const [periodTo, setPeriodTo] = useState(
    () => localStorage.getItem("attRangeTo") || ""
  );

  /* ── data ── */
  const [records,     setRecords]     = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [positions,   setPositions]   = useState({});
  const [staffDepts,  setStaffDepts]  = useState({});
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState(null);

  /* ── filters ── */
  const [colVisibility, setColVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem("attColVisibility");
      return raw ? JSON.parse(raw) : { number: true, position: true, department: true };
    } catch { return { number: true, position: true, department: true }; }
  });
  const [visiblePositions,   setVisiblePositions]   = useState(() => loadFilterSet("attFilterPos")    || new Set());
  const [visibleDepartments, setVisibleDepartments] = useState(() => loadFilterSet("attFilterDept")   || new Set());
  const [visibleStatuses,    setVisibleStatuses]    = useState(() => loadFilterSet("attFilterStatus") || new Set(STATUS_FILTER_ITEMS.map(i => i.value)));
  const [visibleColors, setVisibleColors] = useState(() => loadFilterSet("attFilterColor") || new Set(COLOR_FILTER_ITEMS.map(i => i.value)));
  const [sortConfig, setSortConfig] = useState({ field: "name", dir: "asc" });
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftMap, setShiftMap] = useState({});
  const [breakRules, setBreakRules] = useState([]);

  /* ── popup ── */
  const [detailPopup, setDetailPopup] = useState(null);
  const [editRecord,  setEditRecord]  = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr,     setEditErr]     = useState(null);
  const [photoPopup, setPhotoPopup] = useState(null);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [reportLoading, setReportLoading]   = useState(false);
  const [alertMsg, setAlertMsg]             = useState(null);
  const reportMenuRef = useRef();
  const [pageMode, setPageMode]     = useState(() => localStorage.getItem("attPageMode") || "calendar");
  const [listMode, setListMode]     = useState(() => localStorage.getItem("attListMode") || "month");
  const [listYm, setListYm]         = useState(() => localStorage.getItem("attListYm") || currentYM());
  const [listWeek, setListWeek]     = useState(() => localStorage.getItem("attListWeek") || currentMondayLocal());
  const [listPeriodFrom, setListPeriodFrom] = useState(() => localStorage.getItem("attListPeriodFrom") || "");
  const [listPeriodTo, setListPeriodTo]     = useState(() => localStorage.getItem("attListPeriodTo") || "");
  const [listSelectedStaff, setListSelectedStaff] = useState(() => new Set());
  const [listRecords, setListRecords] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr]         = useState(null);
  const [listSearched, setListSearched] = useState(false);
  const [listSortConfig, setListSortConfig] = useState({ field: "date", dir: "desc" });
  const [listPageSize, setListPageSize] = useState(20);
  const [listPage, setListPage]         = useState(1);
  const [listShiftMap, setListShiftMap] = useState({});
  const LIST_COLUMNS = [
    { key: "scheduledIn",    value: "scheduledIn",    label: "出勤予定" },
    { key: "actualIn",       value: "actualIn",       label: "出勤時刻" },
    { key: "scheduledOut",   value: "scheduledOut",   label: "退勤予定" },
    { key: "actualOut",      value: "actualOut",      label: "退勤時刻" },
    { key: "breakStart",     value: "breakStart",     label: "休憩開始" },
    { key: "breakEnd",       value: "breakEnd",       label: "休憩終了" },
    { key: "scheduledBreak", value: "scheduledBreak", label: "予定休憩" },
    { key: "actualBreakTime", value: "actualBreakTime", label: "休憩時刻" },
    { key: "workTime",       value: "workTime",       label: "勤務時間" },
    { key: "actualWorkTime", value: "actualWorkTime", label: "実際に働いた時間" },
    { key: "shiftPlan",      value: "shiftPlan",      label: "シフト予定" },
  ];
  const [visibleListCols, setVisibleListCols] = useState(
    () => loadFilterSet("attListCols") || new Set(LIST_COLUMNS.map(c => c.key))
  );

  /* ── persist ── */
  useEffect(() => { localStorage.setItem("attPageMode", pageMode); }, [pageMode]);
  useEffect(() => { localStorage.setItem("attListMode", listMode); }, [listMode]);
  useEffect(() => { localStorage.setItem("attListYm",   listYm);   }, [listYm]);
  useEffect(() => { localStorage.setItem("attListWeek", listWeek); }, [listWeek]);
  useEffect(() => { if (listPeriodFrom) localStorage.setItem("attListPeriodFrom", listPeriodFrom); }, [listPeriodFrom]);
  useEffect(() => { if (listPeriodTo)   localStorage.setItem("attListPeriodTo",   listPeriodTo);   }, [listPeriodTo]);
  useEffect(() => { saveFilterSet("attListCols", visibleListCols); }, [visibleListCols]);

  function handleListColToggle(key) {
    setVisibleListCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function handleListColToggleAll(allKeys, allOn) {
    setVisibleListCols(allOn ? new Set(allKeys) : new Set());
  }
  useEffect(() => { localStorage.setItem("attViewMode",      viewMode);     }, [viewMode]);
  useEffect(() => { localStorage.setItem("attSelectedMonth", ym);           }, [ym]);
  useEffect(() => { localStorage.setItem("attSelectedWeek",  selectedWeek); }, [selectedWeek]);
  useEffect(() => { if (periodFrom) localStorage.setItem("attRangeFrom", periodFrom); }, [periodFrom]);
  useEffect(() => { if (periodTo)   localStorage.setItem("attRangeTo",   periodTo);   }, [periodTo]);
  useEffect(() => { saveFilterSet("attFilterPos",    visiblePositions);  }, [visiblePositions]);
  useEffect(() => { saveFilterSet("attFilterDept",   visibleDepartments);}, [visibleDepartments]);
  useEffect(() => { saveFilterSet("attFilterStatus", visibleStatuses);   }, [visibleStatuses]);
  useEffect(() => { saveFilterSet("attFilterColor", visibleColors); }, [visibleColors]);
  useEffect(() => {
    try { localStorage.setItem("attColVisibility", JSON.stringify(colVisibility)); } catch { /* ignore */ }
  }, [colVisibility]);

  /* ── displayDates ── */
  const displayDates = useMemo(() => {
    if (viewMode === "week") {
      return Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
    }
    if (viewMode === "period") {
      const days = periodDays(periodFrom, periodTo);
      if (days < 7 || days > 35) return [];
      const dates = [];
      const cur = new Date(periodFrom);
      const end = new Date(periodTo);
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    }
    const total = daysInMonth(ym);
    return Array.from({ length: total }, (_, i) => dateStr(ym, i + 1));
  }, [viewMode, selectedWeek, periodFrom, periodTo, ym]);

  /* ── load ── */
  const load = useCallback(async (silent = false) => {
    if (displayDates.length === 0) return;
    if (!silent) { setLoading(true); setErr(null); }
    try {
      const from = displayDates[0];
      const to   = displayDates[displayDates.length - 1];

      const [recs, emps, depts, shiftData, brRules] = await Promise.all([
        api.attendanceRecords(from, to),
        api.managerEmployeesList(),
        api.settingsDepartmentsList(),
        api.managerRange(from, to),
        api.settingsBreakRulesList().catch(() => []),
      ]);

      const posMap = {}, deptsMap = {};
      emps.forEach(e => {
        posMap[e.id]   = e.position || "";
        deptsMap[e.id] = (e.departments || []).map(d => d.name);
      });
      setPositions(posMap);
      setStaffDepts(deptsMap);
      setDepartments(Array.isArray(depts) ? depts : []);

      const activeStaff = Array.isArray(emps)
        ? emps.filter(e => e.role === "STAFF" || e.role === "MANAGER")
        : [];
      setStaff(activeStaff);

      const allPosSet  = new Set(activeStaff.map(s => posMap[s.id] || "").filter(Boolean));
      const savedPos  = loadFilterSet("attFilterPos");
      const savedDept = loadFilterSet("attFilterDept");
      setVisiblePositions(savedPos  && savedPos.size  > 0 ? savedPos  : allPosSet);
      const allDeptSet = new Set(activeStaff.flatMap(s => deptsMap[s.id] || []));
      setVisibleDepartments(savedDept && savedDept.size > 0 ? savedDept : allDeptSet);

      setRecords(Array.isArray(recs) ? recs : []);
      setBreakRules(Array.isArray(brRules) ? brRules : []);
      const sm = {};
      for (const week of (shiftData || [])) {
        for (const row of (week.rows || [])) {
          for (const day of (row.days || [])) {
            if (!day.off && day.slots && day.slots.length > 0) {
              const starts = day.slots.map(s => s.startTime).filter(Boolean).sort();
              const ends   = day.slots.map(s => s.endTime).filter(Boolean).sort();
              sm[`${row.userId}_${day.date}`] = {
                startTime: starts[0],
                endTime:   ends[ends.length - 1],
                slots:     day.slots,
              };
            }
          }
        }
      }
      setShiftMap(sm);
    } catch (e) {
      setErr(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [displayDates]);

  useEffect(() => { load(false); }, [displayDates]);

  /* ── リスト表示: デフォルトで全スタッフ選択 ── */
  useEffect(() => {
    if (staff.length > 0 && listSelectedStaff.size === 0 && !listSearched) {
      setListSelectedStaff(new Set(staff.map(s => s.id)));
    }
  }, [staff]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleListStaffToggle(id) {
    setListSelectedStaff(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function handleListStaffToggleAll(allKeys, allOn) {
    setListSelectedStaff(allOn ? new Set(allKeys) : new Set());
  }

  /* ── リスト表示の期間（月/週/期間） ── */
  const listWeekOptions = useMemo(() => weeksInMonth(listYm), [listYm]);
  const listPDays  = periodDays(listPeriodFrom, listPeriodTo);
  const listPOk    = listPDays >= 1 && listPDays <= 90;
  const listPWarn  = listPeriodFrom && listPeriodTo && !listPOk
    ? (listPDays < 1 ? "期間を正しく指定してください" : "90日以内を指定してください")
    : null;

  const listRange = useMemo(() => {
    if (listMode === "week") {
      return { from: listWeek, to: addDays(listWeek, 6) };
    }
    if (listMode === "period") {
      if (!listPeriodFrom || !listPeriodTo || !listPOk) return { from: "", to: "" };
      return { from: listPeriodFrom, to: listPeriodTo };
    }
    const total = daysInMonth(listYm);
    return { from: dateStr(listYm, 1), to: dateStr(listYm, total) };
  }, [listMode, listYm, listWeek, listPeriodFrom, listPeriodTo, listPOk]);

  async function loadListData() {
    if (!listRange.from || !listRange.to) return;
    setListLoading(true); setListErr(null); setListSearched(true);
    try {
      const [recs, shiftData] = await Promise.all([
        api.attendanceRecords(listRange.from, listRange.to),
        api.managerRange(listRange.from, listRange.to).catch(() => []),
      ]);
      setListRecords(Array.isArray(recs) ? recs : []);

      const sm = {};
      for (const week of (shiftData || [])) {
        for (const row of (week.rows || [])) {
          for (const day of (row.days || [])) {
            if (!day.off && day.slots && day.slots.length > 0) {
              const starts = day.slots.map(s => s.startTime).filter(Boolean).sort();
              const ends   = day.slots.map(s => s.endTime).filter(Boolean).sort();
              sm[`${row.userId}_${day.date}`] = {
                startTime: starts[0],
                endTime:   ends[ends.length - 1],
                slots:     day.slots,
              };
            }
          }
        }
      }
      setListShiftMap(sm);
    } catch (e) {
      setListErr(e.message);
    } finally {
      setListLoading(false);
    }
  }

  // Автозагрузка при выборе месяца/недели (диапазон всегда валиден);
  // для 期間 — только по кнопке「表示」, т.к. диапазон может быть невалиден
  useEffect(() => {
    if (pageMode !== "list") return;
    if (listMode === "period") return;
    loadListData();
  }, [pageMode, listMode, listYm, listWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  function listSortFn(a, b) {
    let va, vb;
    if (listSortConfig.field === "date") { va = a.workDate; vb = b.workDate; }
    else                                 { va = a.userName; vb = b.userName; }
    const cmp = va.localeCompare(vb, "ja");
    return listSortConfig.dir === "asc" ? cmp : -cmp;
  }

  const listSessions = useMemo(() => {
    const byUser = {};
    listRecords.forEach(r => {
      if (!byUser[r.userId]) byUser[r.userId] = [];
      byUser[r.userId].push(r);
    });

    const out = [];
    Object.entries(byUser).forEach(([uid, recs]) => {
      const sorted = [...recs].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      let cur = null;
      const rawSessions = [];
      for (const r of sorted) {
        if (r.recordType === "CLOCK_IN") {
          if (cur) rawSessions.push(cur);
          cur = { userId: Number(uid), userName: r.userName, workDate: r.workDate, clockIn: r.recordedAt, clockOut: null, breakStart: null, breakEnd: null };
        } else if (cur) {
          if (r.recordType === "BREAK_START") cur.breakStart = r.recordedAt;
          if (r.recordType === "BREAK_END")   cur.breakEnd   = r.recordedAt;
          if (r.recordType === "CLOCK_OUT") { cur.clockOut = r.recordedAt; rawSessions.push(cur); cur = null; }
        }
      }
      if (cur) rawSessions.push(cur);

      // Группируем по дню — плановые слоты сопоставляются в рамках одного дня
      const byDate = {};
      rawSessions.forEach(s => {
        if (!byDate[s.workDate]) byDate[s.workDate] = [];
        byDate[s.workDate].push(s);
      });

      Object.entries(byDate).forEach(([wd, daySessions]) => {
        const shift = listShiftMap[`${uid}_${wd}`];
        const matched = matchSessionsToSlots(daySessions, shift?.slots || []);
        matched.forEach(({ session, slot }) => {
          const info = computeSessionOfficial(session, slot, wd, breakRules);
          out.push({ ...session, slot, info });
        });
      });
    });

    return out
      .filter(s => listSelectedStaff.size === 0 || listSelectedStaff.has(s.userId))
      .sort(listSortFn);
  }, [listRecords, listSelectedStaff, listSortConfig, listShiftMap, breakRules]);

  useEffect(() => { setListPage(1); }, [listSessions.length, listPageSize, listSortConfig, listSelectedStaff]);

  const listTotalPages = Math.max(1, Math.ceil(listSessions.length / listPageSize));
  const listPageClamped = Math.min(listPage, listTotalPages);
  const listPagedSessions = useMemo(() => {
    const start = (listPageClamped - 1) * listPageSize;
    return listSessions.slice(start, start + listPageSize);
  }, [listSessions, listPageClamped, listPageSize]);

  function calcSessionMinutes(s) {
    if (!s.clockIn || !s.clockOut) return null;
    let mins = Math.round((new Date(s.clockOut) - new Date(s.clockIn)) / 60000);
    if (s.breakStart && s.breakEnd) {
      mins -= Math.round((new Date(s.breakEnd) - new Date(s.breakStart)) / 60000);
    }
    return mins > 0 ? mins : 0;
  }
  function fmtWorkMinutes(mins) {
    if (mins === null) return "―";
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h}時間${m}分`;
  }
  function fmtTimeOnly(instant) {
    if (!instant) return "--:--";
    return new Date(instant).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
  }
  function rawBreakMinutes(session) {
    if (!session.breakStart || !session.breakEnd) return null;
    const mins = Math.round((new Date(session.breakEnd) - new Date(session.breakStart)) / 60000);
    return mins > 0 ? mins : 0;
  }
  function rawActualWorkedMinutes(session) {
    if (!session.clockIn || !session.clockOut) return null;
    let mins = Math.round((new Date(session.clockOut) - new Date(session.clockIn)) / 60000);
    if (session.breakStart && session.breakEnd) {
      const brk = Math.round((new Date(session.breakEnd) - new Date(session.breakStart)) / 60000);
      mins -= Math.max(brk, 0);
    }
    return mins > 0 ? mins : 0;
  }
  function formatShiftTime(t) {
    if (!t) return "--:--";
    return typeof t === "string" ? t.slice(0, 5) : t;
  }
  function fmtDateWithWd(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const wd = WD_JA[new Date(y, m - 1, d).getDay()];
    return `${dateStr}（${wd}）`;
  }

  async function handleListExport() {
    if (!listRange.from || !listRange.to) return;
    setReportLoading(true);
    try {
      await api.reportAttendanceSessions(listRange.from, listRange.to, [...listSelectedStaff]);
    } catch (e) {
      setAlertMsg("レポートの生成に失敗しました: " + e.message);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    if (!reportMenuOpen) return;
    function onDown(e) {
      if (reportMenuRef.current && !reportMenuRef.current.contains(e.target))
        setReportMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [reportMenuOpen]);

  /* ── options ── */
  const monthOptions = useMemo(() => {
    const opts = [], now = new Date();
    for (let delta = -12; delta <= 12; delta++) {
      const d   = new Date(now.getFullYear(), now.getMonth() + delta, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      opts.push({ val, label: `${d.getFullYear()}年 ${MONTHS_JA[d.getMonth()]}` });
    }
    return opts;
  }, []);
  const yearOptions = useMemo(() => [...new Set(monthOptions.map(o => o.val.split("-")[0]))], [monthOptions]);
  const weekOptions = useMemo(() => weeksInMonth(ym), [ym]);

  /* ── filter logic ── */
  const positionOptions = useMemo(() =>
    [...new Set(staff.map(s => positions[s.id] || "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")),
    [staff, positions]
  );
  const staffByPosition = useMemo(() =>
    visiblePositions.size === 0 ? [] : staff.filter(s => visiblePositions.has(positions[s.id] || "")),
    [staff, positions, visiblePositions]
  );
  const availableDeptNames = useMemo(() =>
    new Set(staffByPosition.flatMap(s => staffDepts[s.id] || [])),
    [staffByPosition, staffDepts]
  );
  const allDepartmentItems = useMemo(() =>
    departments.filter(d => availableDeptNames.has(d.name)).map(d => ({ value: d.name, label: d.name })),
    [departments, availableDeptNames]
  );
  const staffByDept = useMemo(() => {
    if (visiblePositions.size === 0) return [];
    if (allDepartmentItems.length > 0) {
      if (visibleDepartments.size === 0) return [];
      return staffByPosition.filter(s =>
        (staffDepts[s.id] || []).some(d => visibleDepartments.has(d))
      );
    }
    return [...staffByPosition];
  }, [staffByPosition, staffDepts, visibleDepartments, allDepartmentItems, visiblePositions]);

  /* ── records helpers ── */
  const getRecordsForDay = useCallback((userId, date) => {
    return records.filter(r => r.userId === userId && r.workDate === date)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  }, [records]);

  const getCellStatus = useCallback((dayRecs) => {
    if (dayRecs.length === 0) return null;
    const types = dayRecs.map(r => r.recordType);
    if (types.includes("CLOCK_OUT")) return "finished";
    if (types.includes("BREAK_START") && !types.includes("BREAK_END")) return "break";
    if (types.includes("CLOCK_IN")) return "working";
    return null;
  }, []);

  const sessionsByUserDate = useMemo(() => buildSessionsFromRecords(records), [records]);

  function getSessionsForDay(userId, date) {
    return sessionsByUserDate[userId]?.[date] || [];
  }

  function maxSessionsForStaff(userId) {
    let max = 1;
    displayDates.forEach(date => {
      const cnt = getSessionsForDay(userId, date).length;
      if (cnt > max) max = cnt;
    });
    return max;
  }

  function calcActualWorkMinutes(userId) {
    let total = 0;
    displayDates.forEach(date => {
      const sessions = getSessionsForDay(userId, date);
      if (sessions.length === 0) return;
      const shift = shiftMap[`${userId}_${date}`];
      const matched = matchSessionsToSlots(sessions, shift?.slots || []);
      matched.forEach(({ session, slot }) => {
        if (!session.clockOut) return;
        const info = computeSessionOfficial(session, slot, date, breakRules);
        if (info.workMin) total += info.workMin;
      });
    });
    return total;
  }

  function sortFn(a, b) {
    let va = "", vb = "";
    if (sortConfig.field === "name")       { va = a.fullName; vb = b.fullName; }
    if (sortConfig.field === "position")   { va = positions[a.id] || ""; vb = positions[b.id] || ""; }
    if (sortConfig.field === "department") {
      va = (staffDepts[a.id] || [])[0] || "";
      vb = (staffDepts[b.id] || [])[0] || "";
    }
    return (sortConfig.dir === "asc" ? 1 : -1) * va.localeCompare(vb, "ja");
  }

  const filteredStaff = useMemo(() => [...staffByDept].sort(sortFn), [staffByDept, sortConfig]);

  const filteredStaffByStatus = useMemo(() => {
    return filteredStaff
      .filter(s => showInactive || s.active)
      .filter(s => {
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          return (s.fullName || "").toLowerCase().includes(q) ||
                 (s.fullNameKana || "").toLowerCase().includes(q);
        }
        return true;
      })
      .filter(s => {
        // фильтр по статусу (出勤中 etc)
        const statusMatch = displayDates.some(date => {
          const dayRecs = getRecordsForDay(s.id, date);
          const status  = getCellStatus(dayRecs);
          if (!status) return visibleStatuses.has("none");
          return visibleStatuses.has(status);
        });
        if (!statusMatch) return false;
  
        // фильтр по цвету
        const allColors = new Set(COLOR_FILTER_ITEMS.map(i => i.value));
        const isAllColors = allColors.size === visibleColors.size && [...allColors].every(c => visibleColors.has(c));
        if (isAllColors) return true;
  
        return displayDates.some(date => {
          const colorStatus = getRowColorStatus(s.id, date);
          if (!colorStatus) return visibleColors.has("blue") &&
            !!shiftMap[`${s.id}_${date}`] &&
            !getRecordsForDay(s.id, date).find(r => r.recordType === "CLOCK_IN");
          return visibleColors.has(colorStatus);
        });
      });
  }, [filteredStaff, displayDates, visibleStatuses, visibleColors, getRecordsForDay, getCellStatus, showInactive, searchQuery, shiftMap]);

  /* ── filter handlers ── */
  function recalcDepts(newVis) {
    const staffAfterPos = staff.filter(s => newVis.has(positions[s.id] || ""));
    setVisibleDepartments(new Set(staffAfterPos.flatMap(s => staffDepts[s.id] || [])));
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
  function handleStatusToggle(name) {
    setVisibleStatuses(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function handleStatusToggleAll(allKeys, allOn) {
    setVisibleStatuses(allOn ? new Set(allKeys) : new Set());
  }
  function handleColorToggle(name) {
    setVisibleColors(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function handleColorToggleAll(allKeys, allOn) {
    setVisibleColors(allOn ? new Set(allKeys) : new Set());
  }
  function handleReset() {
    localStorage.removeItem("attFilterPos");
    localStorage.removeItem("attFilterDept");
    localStorage.removeItem("attFilterStatus");
    localStorage.removeItem("attFilterColor");
    setVisiblePositions(new Set(positionOptions));
    setVisibleDepartments(new Set(departments.map(d => d.name)));
    setVisibleStatuses(new Set(STATUS_FILTER_ITEMS.map(i => i.value)));
    setVisibleColors(new Set(COLOR_FILTER_ITEMS.map(i => i.value)));
  }

  const _f1 = positionOptions.some(p => !visiblePositions.has(p));
  const _f2 = allDepartmentItems.some(d => !visibleDepartments.has(d.value));
  const _f3 = STATUS_FILTER_ITEMS.some(i => !visibleStatuses.has(i.value));
  const _f4 = COLOR_FILTER_ITEMS.some(i => !visibleColors.has(i.value));
  const isFiltered = _f1 || _f2 || _f3 || _f4;

  /* ── period validation ── */
  const pDays    = periodDays(periodFrom, periodTo);
  const periodOk = pDays >= 7 && pDays <= 35;
  const periodWarn = periodFrom && periodTo && !periodOk
    ? (pDays < 7 ? "7日以上を指定してください" : "35日以内を指定してください")
    : null;

  /* ── sticky col left ── */
  function nameLeft() {
    if (!colVisibility.position && !colVisibility.department) return 0;
    if (!colVisibility.position) return 90;
    if (!colVisibility.department) return 70;
    return 160;
  }

  function toMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }

  // function getInColor(userId, date) {
  //   const dayRecs = getRecordsForDay(userId, date);
  //   const shift   = shiftMap[`${userId}_${date}`];
  //   const clockIn = dayRecs.find(r => r.recordType === "CLOCK_IN");
  
  //   if (!clockIn) return null;
  //   if (!shift)   return "#f1f5f9"; // серый — пришёл без смены
  
  //   const shiftStart = toMinutes(shift.startTime);
  //   const t = new Date(clockIn.recordedAt);
  //   const inMin = t.getHours() * 60 + t.getMinutes();
  
  //   return inMin >= shiftStart ? "#fee2e2" : "#dcfce7"; // красный / зелёный
  // }
  
  // function getOutColor(userId, date) {
  //   const dayRecs  = getRecordsForDay(userId, date);
  //   const shift    = shiftMap[`${userId}_${date}`];
  //   const clockOut = dayRecs.find(r => r.recordType === "CLOCK_OUT");
  
  //   if (!clockOut) return null; // нет退勤 — null
  //   if (!shift)    return "#f1f5f9"; // серый
  
  //   const shiftEnd = toMinutes(shift.endTime);
  //   const t = new Date(clockOut.recordedAt);
  //   const outMin = t.getHours() * 60 + t.getMinutes();
  
  //   return outMin >= shiftEnd ? "#dcfce7" : "#fef9c3"; // зелёный / жёлтый
  // }

  function getRowColorStatus(userId, date) {
    const shift    = shiftMap[`${userId}_${date}`];
    const sessions = getSessionsForDay(userId, date);

    if (shift && sessions.length === 0) return "blue"; // запланировано, но ещё не пришёл
    if (!shift && sessions.length > 0)  return "gray";  // пришёл без плана
    if (sessions.length === 0) return null;

    const matched = matchSessionsToSlots(sessions, shift?.slots || []);
    const first = matched[0];
    if (!first) return null;

    const info = computeSessionOfficial(first.session, first.slot, date, breakRules);
    if (!info.hasPlan) return "gray";
    if (info.lateIn) return "red";
    if (first.session.clockOut && info.earlyOut) return "yellow";
    return "green";
  }

  async function handleReport(type) {
    setReportMenuOpen(false);
    setReportLoading(true);
    try {
      if (type === "timesheet") {
        await api.reportAttendanceTimesheet(ym);
      } else if (type === "list") {
        await api.reportAttendanceList(ym);
      } else if (type === "timesheet_filtered") {
        if (displayDates.length === 0) {
          setAlertMsg("期間を正しく設定してください");
          return;
        }
        await api.reportAttendanceTimesheetFiltered(
          displayDates[0],
          displayDates[displayDates.length - 1],
          filteredStaffByStatus.map(s => s.id)
        );
      }
    } catch (e) {
      setAlertMsg("レポートの生成に失敗しました: " + e.message);
    } finally {
      setReportLoading(false);
    }
  }

  /* ── edit ── */
  async function handleEditSave() {
    if (!editRecord) return;
    setEditLoading(true); setEditErr(null);
    try {
      await api.attendanceEdit(editRecord.id, {
        recordedAt: new Date(editRecord.recordedAt).toISOString(),
        note:       editRecord.note || null,
      });
      await load(true);
      setEditRecord(null);
    } catch (e) {
      setEditErr(e.message);
    } finally {
      setEditLoading(false);
    }
  }

  const weekColSpans = useMemo(() => {
    const weeks = weeksInMonth(ym);
    return weeks.map(week => {
      const count = displayDates.filter(date => {
        const ws = new Date(week.weekStart);
        const we = new Date(week.weekStart); we.setDate(we.getDate() + 6);
        const d  = new Date(date);
        return d >= ws && d <= we;
      }).length;
      return { week, count };
    }).filter(x => x.count > 0);
  }, [displayDates, ym]);

  /* ── render ── */
  return (
    <ManagerLayout name={getName()} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        {/* ── Mode toggle: カレンダー / リスト ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "10px 20px 0" }}>
          {[
            { value: "calendar", label: "📅 カレンダー" },
            { value: "list",     label: "📋 リスト" },
          ].map((m, idx) => (
            <button key={m.value} type="button"
              onClick={() => setPageMode(m.value)}
              style={{
                padding: "7px 18px", fontSize: 13, cursor: "pointer",
                border: "1px solid #ccc",
                borderRight: idx === 0 ? "none" : "1px solid #ccc",
                borderRadius: idx === 0 ? "6px 0 0 6px" : "0 6px 6px 0",
                background: pageMode === m.value ? "#2F5496" : "#fff",
                color:      pageMode === m.value ? "#fff"    : "#333",
                fontWeight: pageMode === m.value ? "600" : "normal",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {pageMode === "calendar" && (
        <>
        {/* ── TopBar ── */}
        <div className={styles.topBar}>
          <div style={{ display:"flex", borderRadius:6, overflow:"hidden", border:"1px solid #ccc", flexShrink:0 }}>
            {VIEW_MODES.map((m, idx) => (
              <button key={m.value} type="button"
                onClick={() => setViewMode(m.value)}
                style={{
                  padding:"5px 14px", fontSize:13, border:"none", cursor:"pointer",
                  background: viewMode === m.value ? "#2F5496" : "#fff",
                  color:      viewMode === m.value ? "#fff"    : "#333",
                  borderRight: idx < VIEW_MODES.length - 1 ? "1px solid #ccc" : "none",
                  fontWeight:  viewMode === m.value ? "600" : "normal",
                  transition: "background 0.15s",
                }}>
                {m.label}
              </button>
            ))}
          </div>

          {viewMode === "month" && (
            <>
              <select className={styles.monthSelect}
                value={ym.split("-")[0]}
                onChange={e => setYm(`${e.target.value}-${ym.split("-")[1]}`)}>
                {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>

              <select className={styles.monthSelect}
                value={ym.split("-")[1]}
                onChange={e => setYm(`${ym.split("-")[0]}-${e.target.value}`)}>
                {MONTHS_JA.map((label, i) => (
                  <option key={i} value={String(i+1).padStart(2,"0")}>{label}</option>
                ))}
              </select>
            </>
          )}

          {viewMode === "week" && (
            <select className={styles.monthSelect} value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}>
              {weekOptions.map(w => (
                <option key={w.weekStart} value={w.weekStart}>
                  {w.weekStart.slice(5).replace("-","/")} 〜 {w.weekEnd.slice(5).replace("-","/")}
                </option>
              ))}
            </select>
          )}

          {viewMode === "period" && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input type="date" value={periodFrom}
                onChange={e => setPeriodFrom(e.target.value)}
                style={{ padding:"4px 8px", fontSize:13, border:"1px solid", borderColor: periodWarn ? "#cc0000" : "#ccc", borderRadius:4, cursor:"pointer" }}
              />
              <span style={{ fontSize:13, color:"#666" }}>〜</span>
              <input type="date" value={periodTo} min={periodFrom || undefined}
                onChange={e => setPeriodTo(e.target.value)}
                style={{ padding:"4px 8px", fontSize:13, border:"1px solid", borderColor: periodWarn ? "#cc0000" : "#ccc", borderRadius:4, cursor:"pointer" }}
              />
              {periodFrom && periodTo && (
                <span style={{ fontSize:12, color: periodOk ? "#5a8a5a" : "#cc0000", whiteSpace:"nowrap" }}>
                  {pDays}日{periodWarn ? `（${periodWarn}）` : ""}
                </span>
              )}
            </div>
          )}

          <div ref={reportMenuRef} style={{ position: "relative" }}>
            <button type="button" className={styles.exportBtn}
              onClick={() => setReportMenuOpen(v => !v)}
              disabled={loading || reportLoading}>
              {reportLoading ? "..." : "📊 レポート▼"}
            </button>
            {reportMenuOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 1000,
                background: "#fff", border: "1px solid #ccc", borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)", minWidth: 220, marginTop: 4,
              }}>
                {[
                  { key: "timesheet", icon: "🕐", label: "勤怠集計表（実績）" },
                  { key: "list",      icon: "📋", label: "打刻一覧" },
                  { key: "timesheet_filtered", icon: "🔍", label: "表示中の勤怠集計表" },
                ].map(item => (
                  <button key={item.key} type="button"
                    onClick={() => handleReport(item.key)}
                    style={{ display: "block", width: "100%", padding: "10px 16px",
                      textAlign: "left", border: "none", background: "none",
                      cursor: "pointer", fontSize: 13 }}
                    onMouseEnter={e => e.target.style.background = "#f5f5f5"}
                    onMouseLeave={e => e.target.style.background = "none"}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className={styles.topHint}>🕐 勤怠管理</span>
        </div>

        {/* ── SortBar ── */}
        <div className={styles.sortBar}>
          <ColToggleDropdown colVisibility={colVisibility} onColVisibilityChange={setColVisibility} />

          {positionOptions.length > 0 && (
            <CheckDropdown
              label="職種・役職"
              items={positionOptions.map(p => ({ value: p, label: p }))}
              visibleSet={visiblePositions}
              onToggle={handlePosToggle}
              onToggleAll={handlePosToggleAll}
            />
          )}

          {allDepartmentItems.length > 0 && (
            <CheckDropdown
              label="部署"
              items={allDepartmentItems}
              visibleSet={visibleDepartments}
              onToggle={handleDeptToggle}
              onToggleAll={handleDeptToggleAll}
            />
          )}

          <CheckDropdown
            label="表示フィルター"
            items={STATUS_FILTER_ITEMS}
            visibleSet={visibleStatuses}
            onToggle={handleStatusToggle}
            onToggleAll={handleStatusToggleAll}
          />

          <CheckDropdown
            label="状態フィルター"
            items={COLOR_FILTER_ITEMS}
            visibleSet={visibleColors}
            onToggle={handleColorToggle}
            onToggleAll={handleColorToggleAll}
          />

          <div className={styles.sortBarDivider} />

          {isFiltered && (
            <button type="button" className={styles.resetBtn} onClick={handleReset}>
              リセット
            </button>
          )}

          <div className={styles.sortBarDivider} />

          <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="氏名で検索..."
              style={{
                padding: "4px 10px", fontSize: 13,
                border: "1.5px solid #e2e8f0", borderRadius: 6,
                outline: "none", background: "#fff",
                width: 140,
              }}
          />

          <div className={styles.sortBarDivider} />

          <label style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 13, cursor: "pointer", color: "#666",
            whiteSpace: "nowrap",
          }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            非アクティブを表示
          </label>

          <span className={styles.sortBarLabel}>並び替え：</span>
          {SORT_FIELDS.map(f => {
            const isActive = sortConfig.field === f.value;
            return (
              <button key={f.value} type="button"
                className={`${styles.sortBtn} ${isActive ? styles.sortBtnActive : ""}`}
                onClick={() => setSortConfig({
                  field: f.value,
                  dir: isActive ? (sortConfig.dir === "asc" ? "desc" : "asc") : "asc",
                })}>
                {f.label}
                <span className={styles.sortArrow}>
                  {isActive ? (sortConfig.dir === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </button>
            );
          })}

          {!loading && staff.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
              表示中: {filteredStaffByStatus.length} / {staff.length} 人
            </span>
          )}
        </div>

        {viewMode === "period" && periodWarn && (
          <div style={{ padding:"8px 16px", background:"#FFF3CD", borderBottom:"1px solid #FFEAA7", fontSize:13, color:"#856404" }}>
            ⚠️ {periodWarn}
          </div>
        )}

        {err && (
          <div style={{ padding:"12px 20px", background:"#fee2e2", color:"#dc2626", fontSize:13 }}>{err}</div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : displayDates.length === 0 ? (
          <div className={styles.loading} style={{ color:"#999" }}>
            {viewMode === "period" ? "期間を正しく設定してください（7〜35日）" : "データがありません"}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                    <th className={styles.thNameSub} style={!colVisibility.number     ? { display:"none" } : {}}></th>
                    <th className={styles.thNameSub} style={!colVisibility.position   ? { display:"none" } : {}}></th>
                    <th className={`${styles.thNameSub} ${styles.thNameSubPos}`}
                      style={{ ...(!colVisibility.department ? { display:"none" } : {}), ...(!colVisibility.position ? { left:0 } : {}) }}></th>
                    <th className={`${styles.thNameSub} ${styles.thNameSubPos}`} style={{ left: nameLeft() }}></th>
                    <th className={styles.thNameSub}></th>

                    {weekColSpans.map(({ week, count }) => (
                      <th key={week.weekStart} colSpan={count} className={styles.thWeek}>
                        <div className={styles.thWeekInner}>
                          <span className={styles.thWeekRange}>
                            {fmtWeekLabel(week.weekStart, addDays(week.weekStart, 6))}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className={styles.thNameSub} style={{ background: "#f0f4ff" }}></th>
                  </tr>
                <tr>
                  <th className={styles.thNumber}
                    style={!colVisibility.number ? { display:"none" } : {}}>№</th>
                  <th className={styles.thPosition}
                    style={!colVisibility.position ? { display:"none" } : {}}>職種・役職</th>
                  <th className={styles.thDepartment}
                    style={{ ...(!colVisibility.department ? { display:"none" } : {}), ...(!colVisibility.position ? { left:0 } : {}) }}>
                    部署
                  </th>
                  <th className={styles.thName} style={{ left: nameLeft() }}>氏名</th>
                  <th className={styles.thDay} style={{ minWidth: 50 }}></th>
                  {displayDates.map(date => {
                    const wd = new Date(date).getDay();
                    const d  = parseInt(date.slice(8), 10);
                    return (
                      <th key={date} className={`${styles.thDay} ${wd===6?styles.thSat:""} ${wd===0?styles.thSun:""}`}>
                        <span className={styles.thNum}>{d}</span>
                        <span className={styles.thWd}>{WD_JA[wd]}</span>
                      </th>
                    );
                  })}
                  <th className={styles.thDay} style={{ minWidth: 60, background: "#f0f4ff" }}>
                    <span className={styles.thNum}>勤務</span>
                    <span className={styles.thWd}>時間</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffByStatus.length === 0 ? (
                  <tr>
                    <td colSpan={displayDates.length + 4} className={styles.empty}>
                      {staff.length === 0 ? "スタッフが登録されていません" : "該当するスタッフが見つかりません"}
                    </td>
                  </tr>
                ) : (
                  filteredStaffByStatus.map((s, idx) => (
                    <tr key={s.id} className={`${styles.staffRow} ${styles.attRow}`} data-staff={s.id}>
                      <td className={styles.tdNumber}
                        style={!colVisibility.number ? { display:"none" } : {}}>
                        {idx + 1}
                      </td>
                      <td className={styles.tdPosition}
                        style={!colVisibility.position ? { display:"none" } : {}}>
                        {positions[s.id] || ""}
                      </td>
                      <td className={styles.tdDepartment}
                        style={{ ...(!colVisibility.department ? { display:"none" } : {}), ...(!colVisibility.position ? { left:0 } : {}) }}>
                        {(staffDepts[s.id] || []).map((d, i) => <div key={i}>{d}</div>)}
                      </td>
                      <td className={styles.tdName} style={{ left: nameLeft() }}>{s.fullName}</td>

                      {(() => {
                        const sessionRows = maxSessionsForStaff(s.id);
                        return (
                          <td className={styles.cell} style={{ padding: 0, verticalAlign: "top" }}>
                            {Array.from({ length: sessionRows }, (_, si) => (
                              <div key={si} style={{ borderBottom: si < sessionRows - 1 ? "2px solid #cbd5e1" : "none" }}>
                                {["出勤", "退勤", "実働", "休憩"].map(label => (
                                  <div key={label} style={{
                                    minHeight: 22, padding: "2px 6px",
                                    display: "flex", alignItems: "center",
                                    fontSize: 11, color: "#64748b", fontWeight: 600,
                                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                                  }}>
                                    {label}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </td>
                        );
                      })()}

                      {displayDates.map(date => {
                        const wd          = new Date(date).getDay();
                        const isWeekStart = weekColSpans.some(({ week }) => week.weekStart === date);
                        const dayRecs     = getRecordsForDay(s.id, date);
                        const shift       = shiftMap[`${s.id}_${date}`];
                        const daySessions = getSessionsForDay(s.id, date);
                        const hasShift    = !!shift;
                        const hasPunch    = daySessions.length > 0;
                        const sessionRows = maxSessionsForStaff(s.id);
                        const matched     = matchSessionsToSlots(daySessions, shift?.slots || []);

                        let cellBg = "#fff";
                        if (hasShift && !hasPunch) cellBg = "#e0f2fe";
                        if (!hasShift && hasPunch) cellBg = "#f1f5f9";

                        return (
                          <td key={date}
                            className={`${styles.cell} ${isWeekStart ? styles.cellWeekStart : ""}`}
                            style={{ padding: 0, verticalAlign: "top", background: cellBg, cursor: "pointer", position: "relative" }}
                            onClick={() => {
                              if (dayRecs.length > 0 || hasShift) {
                                setDetailPopup({ userId: s.id, userName: s.fullName, date, dayRecords: dayRecs });
                              }
                            }}
                          >
                            {Array.from({ length: sessionRows }, (_, si) => {
                              const pair       = matched[si];
                              const session    = pair?.session || null;
                              const slot       = pair?.slot || null;
                              const info       = session ? computeSessionOfficial(session, slot, date, breakRules) : null;
                              const outNextDay = session?.clockOut && isNextDayJst(session.clockOut, date);

                              return (
                                <div key={si} style={{
                                  position: "relative",
                                  borderBottom: si < sessionRows - 1 ? "2px solid #cbd5e1" : "none",
                                }}>
                                  {outNextDay && (
                                    <div style={{
                                      position: "absolute", top: 0, left: 0, right: 0,
                                      height: 3, background: "#7c3aed", zIndex: 1, pointerEvents: "none",
                                    }} />
                                  )}

                                  {/* 出勤 */}
                                  <div style={{
                                    minHeight: 22, padding: "2px 6px",
                                    background: info?.inColor || "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                                  }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: info?.officialIn ? "#1e293b" : "#cbd5e1" }}>
                                      {info?.officialIn ? fmtTime(info.officialIn) : "--:--"}
                                    </span>
                                  </div>

                                  {/* 退勤 */}
                                  <div style={{
                                    minHeight: 22, padding: "2px 6px",
                                    background: info?.outColor || "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                                  }}>
                                    <span style={{
                                      fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                                      color: !info?.officialOut ? "#cbd5e1" : (outNextDay ? "#7c3aed" : "#1e293b"),
                                    }}>
                                      {info?.officialOut ? fmtTime(info.officialOut) : "--:--"}
                                    </span>
                                    {outNextDay && (
                                      <span style={{
                                        fontSize: 9, fontWeight: 700, color: "#fff",
                                        background: "#7c3aed", borderRadius: 3, padding: "1px 3px", lineHeight: 1.4,
                                      }}>翌日</span>
                                    )}
                                  </div>

                                  {/* 実働 */}
                                  <div style={{
                                    minHeight: 22, padding: "2px 6px",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                                  }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: session ? "#0369a1" : "#cbd5e1" }}>
                                      {!session ? "--:--" : (info?.workMin === null ? "―" : fmtHM(info.workMin))}
                                    </span>
                                  </div>

                                  {/* 休憩 */}
                                  <div style={{
                                    minHeight: 22, padding: "2px 6px",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}>
                                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>
                                      {session ? fmtHM(info?.officialBreakMinutes) : "--:--"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}

                      <td style={{ textAlign: "center", verticalAlign: "middle", background: "#f8faff", fontWeight: 700, color: "#2F5496" }}>
                        {fmtHM(calcActualWorkMinutes(s.id))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}

        {pageMode === "list" && (
          <div style={{ padding: "16px 20px" }}>

            {/* ── フィルターバー ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #ccc", flexShrink: 0 }}>
                {VIEW_MODES.map((m, idx) => (
                  <button key={m.value} type="button"
                    onClick={() => setListMode(m.value)}
                    style={{
                      padding: "5px 14px", fontSize: 13, border: "none", cursor: "pointer",
                      background: listMode === m.value ? "#2F5496" : "#fff",
                      color:      listMode === m.value ? "#fff"    : "#333",
                      borderRight: idx < VIEW_MODES.length - 1 ? "1px solid #ccc" : "none",
                      fontWeight:  listMode === m.value ? "600" : "normal",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {listMode === "month" && (
                <>
                  <select className={styles.monthSelect}
                    value={listYm.split("-")[0]}
                    onChange={e => setListYm(`${e.target.value}-${listYm.split("-")[1]}`)}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select className={styles.monthSelect}
                    value={listYm.split("-")[1]}
                    onChange={e => setListYm(`${listYm.split("-")[0]}-${e.target.value}`)}>
                    {MONTHS_JA.map((label, i) => (
                      <option key={i} value={String(i+1).padStart(2,"0")}>{label}</option>
                    ))}
                  </select>
                </>
              )}

              {listMode === "week" && (
                <select className={styles.monthSelect} value={listWeek}
                  onChange={e => setListWeek(e.target.value)}>
                  {listWeekOptions.map(w => (
                    <option key={w.weekStart} value={w.weekStart}>
                      {w.weekStart.slice(5).replace("-","/")} 〜 {w.weekEnd.slice(5).replace("-","/")}
                    </option>
                  ))}
                </select>
              )}

              {listMode === "period" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="date" value={listPeriodFrom}
                    onChange={e => setListPeriodFrom(e.target.value)}
                    style={{ padding: "6px 10px", fontSize: 13, border: "1px solid", borderColor: listPWarn ? "#cc0000" : "#ccc", borderRadius: 6 }}
                  />
                  <span style={{ fontSize: 13, color: "#666" }}>〜</span>
                  <input type="date" value={listPeriodTo} min={listPeriodFrom || undefined}
                    onChange={e => setListPeriodTo(e.target.value)}
                    style={{ padding: "6px 10px", fontSize: 13, border: "1px solid", borderColor: listPWarn ? "#cc0000" : "#ccc", borderRadius: 6 }}
                  />
                  {listPeriodFrom && listPeriodTo && (
                    <span style={{ fontSize: 12, color: listPOk ? "#5a8a5a" : "#cc0000", whiteSpace: "nowrap" }}>
                      {listPDays}日{listPWarn ? `（${listPWarn}）` : ""}
                    </span>
                  )}
                </div>
              )}

              {staff.length > 0 && (
                <CheckDropdown
                  label="申請者"
                  items={staff
                    .slice()
                    .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ja"))
                    .map(s => ({ value: s.id, label: s.fullName }))}
                  visibleSet={listSelectedStaff}
                  onToggle={handleListStaffToggle}
                  onToggleAll={handleListStaffToggleAll}
                  panelMaxHeight={240}
                />
              )}

              <CheckDropdown
                label="表示列"
                items={LIST_COLUMNS}
                visibleSet={visibleListCols}
                onToggle={handleListColToggle}
                onToggleAll={handleListColToggleAll}
              />

              <button type="button" className={styles.exportBtn}
                onClick={loadListData}
                disabled={!listRange.from || !listRange.to || listLoading}>
                {listLoading ? "..." : "🔍 表示"}
              </button>

              <button type="button" className={styles.exportBtn}
                onClick={handleListExport}
                disabled={!listRange.from || !listRange.to || reportLoading || listSessions.length === 0}>
                {reportLoading ? "..." : "📥 Excel"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span className={styles.sortBarLabel}>並び替え：</span>
              {SORT_FIELDS.map(f => {
                const isActive = sortConfig.field === f.value;
                return (
                  <button key={f.value} type="button"
                    className={`${styles.sortBtn} ${isActive ? styles.sortBtnActive : ""}`}
                    onClick={() => setSortConfig({
                      field: f.value,
                      dir: isActive ? (sortConfig.dir === "asc" ? "desc" : "asc") : "asc",
                    })}>
                    {f.label}
                    <span className={styles.sortArrow}>
                      {isActive ? (sortConfig.dir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                );
              })}
            </div>

            {listSearched && !listLoading && listSessions.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  全 {listSessions.length} 件
                </span>
              </div>
            )}

            {listErr && (
              <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#dc2626", fontSize: 13, borderRadius: 8, marginBottom: 12 }}>
                {listErr}
              </div>
            )}

              {!listRange.from || !listRange.to ? (
              <div className={styles.loading} style={{ color: "#999" }}>
                {listMode === "period" ? "期間を正しく設定してください（1〜90日）" : "期間を選択してください"}
              </div>
            ) : listLoading ? (
              <div className={styles.loading}>読み込み中...</div>
            ) : !listSearched ? (
              <div className={styles.loading} style={{ color: "#999" }}>「表示」を押してください</div>
            ) : listSessions.length === 0 ? (
              <div className={styles.loading} style={{ color: "#999" }}>該当するデータがありません</div>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                      <tr style={{ background: "#f0f4ff" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", borderBottom: "2px solid #dbe4f5", color: "#334155", fontWeight: 700, whiteSpace: "nowrap" }}>申請者</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", borderBottom: "2px solid #dbe4f5", color: "#334155", fontWeight: 700, whiteSpace: "nowrap" }}>日付</th>
                        {LIST_COLUMNS.filter(c => visibleListCols.has(c.key)).map(c => (
                          <th key={c.key} style={{ padding: "10px 14px", textAlign: "left", borderBottom: "2px solid #dbe4f5", color: "#334155", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  <tbody>
                    {listPagedSessions.map((s, i) => {
                      const cellStyle = { padding: "8px 14px", whiteSpace: "nowrap" };
                      const renderCell = (key) => {
                        switch (key) {
                          case "scheduledIn":
                            return s.slot ? formatShiftTime(s.slot.startTime) : "―";
                          case "actualIn":
                            return fmtTimeOnly(s.clockIn);
                          case "scheduledOut":
                            return s.slot ? formatShiftTime(s.slot.endTime) : "―";
                          case "actualOut":
                            return fmtTimeOnly(s.clockOut);
                          case "breakStart":
                            return s.breakStart ? fmtTimeOnly(s.breakStart) : "―";
                          case "breakEnd":
                            return s.breakEnd ? fmtTimeOnly(s.breakEnd) : "―";
                          case "scheduledBreak":
                            return s.slot ? fmtWorkMinutes(plannedSlotBreakMinutes(s.slot, breakRules)) : "―";
                          case "actualBreakTime": {
                            const raw = rawBreakMinutes(s);
                            return fmtWorkMinutes(raw !== null ? raw : (s.info?.officialBreakMinutes ?? null));
                          }
                          case "workTime":
                            return fmtWorkMinutes(s.info?.workMin ?? null);
                          case "actualWorkTime":
                            return fmtWorkMinutes(rawActualWorkedMinutes(s));
                          case "shiftPlan":
                            return s.slot ? `${formatShiftTime(s.slot.startTime)}〜${formatShiftTime(s.slot.endTime)}` : "―";
                          default:
                            return "";
                        }
                      };
                      return (
                        <tr key={`${s.userId}_${s.workDate}_${s.clockIn}`}
                          style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                          <td style={cellStyle}>👤 {s.userName}</td>
                          <td style={{ ...cellStyle, color: "#2563eb" }}>{fmtDateWithWd(s.workDate)}</td>
                          {LIST_COLUMNS.filter(c => visibleListCols.has(c.key)).map(c => (
                            <td key={c.key} style={{
                              ...cellStyle,
                              fontFamily: ["actualIn","actualOut","breakStart","breakEnd","scheduledIn","scheduledOut"].includes(c.key) ? "monospace" : undefined,
                              color:
                                c.key === "breakStart" || c.key === "breakEnd" ? "#94a3b8" :
                                c.key === "workTime" ? "#0f172a" :
                                c.key === "actualWorkTime" ? "#0369a1" :
                                c.key === "shiftPlan" ? "#0369a1" :
                                c.key === "scheduledIn" || c.key === "scheduledOut" || c.key === "scheduledBreak" ? "#64748b" :
                                c.key === "actualBreakTime" ? "#94a3b8" :
                                undefined,
                              fontWeight: c.key === "workTime" ? 700 : undefined,
                            }}>
                              {renderCell(c.key)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {listSearched && !listLoading && listSessions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>表示件数：</span>
                  <select
                    value={listPageSize}
                    onChange={e => setListPageSize(Number(e.target.value))}
                    style={{ padding: "5px 8px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6 }}
                  >
                    {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}件</option>)}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button type="button" onClick={() => setListPage(1)}
                    disabled={listPageClamped === 1}
                    style={pagerBtnStyle(listPageClamped === 1)}>
                    ≪
                  </button>
                  <button type="button" onClick={() => setListPage(p => Math.max(1, p - 1))}
                    disabled={listPageClamped === 1}
                    style={pagerBtnStyle(listPageClamped === 1)}>
                    ＜
                  </button>
                  <span style={{ fontSize: 13, color: "#334155", padding: "0 8px", whiteSpace: "nowrap" }}>
                    {listPageClamped} / {listTotalPages} ページ
                  </span>
                  <button type="button" onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))}
                    disabled={listPageClamped === listTotalPages}
                    style={pagerBtnStyle(listPageClamped === listTotalPages)}>
                    ＞
                  </button>
                  <button type="button" onClick={() => setListPage(listTotalPages)}
                    disabled={listPageClamped === listTotalPages}
                    style={pagerBtnStyle(listPageClamped === listTotalPages)}>
                    ≫
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail popup ── */}
      {detailPopup && (
        <div style={{
          position:"fixed", inset:0, zIndex:2000,
          background:"rgba(0,0,0,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
          onClick={e => { if (e.target === e.currentTarget) { setDetailPopup(null); setEditRecord(null); } }}
        >
          <div style={{
            background:"#fff", borderRadius:16, padding:24,
            minWidth:400, maxWidth:480,
            boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
          }}>
            {(() => {
              const shift = shiftMap[`${detailPopup.userId}_${detailPopup.date}`];
              if (!shift) return null;
              return (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "#f0f7ff", border: "1px solid #bfdbfe",
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 12, color: "#1e40af", fontWeight: 700, marginBottom: 6 }}>
                    📅 シフト予定
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                    {shift.startTime?.slice(0,5)} 〜 {shift.endTime?.slice(0,5)}
                  </div>
                  {shift.slots.map((sl, i) => sl.workplace && (
                    <div key={i} style={{ fontSize: 12, color: "#64748b" }}>{sl.workplace}</div>
                  ))}
                  <button
                    onClick={() => onNavigate("SHIFTS")}
                    style={{
                      marginTop: 8, fontSize: 12, color: "#2563eb",
                      background: "none", border: "none", cursor: "pointer",
                      padding: 0, textDecoration: "underline",
                    }}
                  >
                    シフト管理で確認 →
                  </button>
                </div>
              );
            })()}
            <div style={{ fontSize:16, fontWeight:800, color:"#1e293b", marginBottom:4 }}>
              {detailPopup.userName}
            </div>
            <div style={{ fontSize:13, color:"#94a3b8", marginBottom:16 }}>{detailPopup.date}</div>

            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              {(() => {
                // Группируем по фактической дате записи
                const groups = [];
                let currentDate = null;
                for (const r of detailPopup.dayRecords) {
                  const recDate = new Date(r.recordedAt).toLocaleDateString("ja-JP", {
                    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo",
                  });
                  if (recDate !== currentDate) {
                    currentDate = recDate;
                    groups.push({ date: recDate, records: [] });
                  }
                  groups[groups.length - 1].records.push(r);
                }

                return groups.map((group, gi) => (
                  <div key={gi}>
                    {/* Показываем дату только если она отличается от даты попапа или группа не первая */}
                    {(() => {
                      const popupDateStr = new Date(detailPopup.date + "T00:00:00").toLocaleDateString("ja-JP", {
                        year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo",
                      });
                      return group.date !== popupDateStr || gi > 0 ? (
                        <div style={{
                          fontSize: 12, color: "#94a3b8", fontWeight: 600,
                          marginBottom: 6, marginTop: gi > 0 ? 8 : 0,
                          paddingBottom: 4, borderBottom: "1px solid #f1f5f9",
                        }}>
                          {group.date}
                        </div>
                      ) : null;
                    })()}

                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {group.records.map(r => (
                        <div key={r.id} style={{
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"10px 14px", borderRadius:10,
                          background:"#f8fafc", border:"1px solid #e2e8f0",
                        }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:getTypeColor(r.recordType) }}>
                              {getTypeLabel(r.recordType)}
                            </div>
                            <div style={{ fontSize:15, fontWeight:700, fontFamily:"monospace", color:"#1e293b" }}>
                              {fmtTime(r.recordedAt)}
                            </div>
                            {r.note   && <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>📝 {r.note}</div>}
                            {r.edited && <div style={{ fontSize:11, color:"#f59e0b", marginTop:2 }}>✏️ 編集済み</div>}
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            {r.photoPath && (
                              <img
                              src={r.photoPath}
                              alt=""
                              onClick={() => setPhotoPopup(r.photoPath)}
                              style={{
                                width: 130, height: 100,
                                objectFit: "cover",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            />
                            )}
                            <button onClick={() => setEditRecord({
                              id: r.id,
                              recordedAt: new Date(r.recordedAt).toISOString().slice(0, 16),
                              note: r.note || "",
                            })} style={{ padding:"4px 10px", fontSize:12, background:"#f1f5f9", border:"none", borderRadius:6, cursor:"pointer", color:"#475569" }}>
                              編集
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {editRecord && (
              <div style={{ padding:14, borderRadius:10, background:"#fffbeb", border:"1px solid #fcd34d", marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#92400e", marginBottom:10 }}>✏️ 時刻を修正</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>
                    時刻
                    <input type="datetime-local" value={editRecord.recordedAt}
                      onChange={e => setEditRecord({ ...editRecord, recordedAt: e.target.value })}
                      style={{ display:"block", width:"100%", marginTop:4, padding:"6px 10px", borderRadius:6, border:"1px solid #e2e8f0", fontSize:13, boxSizing:"border-box" }}
                    />
                  </label>
                  <label style={{ fontSize:12, fontWeight:600, color:"#555" }}>
                    コメント
                    <input type="text" value={editRecord.note}
                      onChange={e => setEditRecord({ ...editRecord, note: e.target.value })}
                      placeholder="修正理由など"
                      style={{ display:"block", width:"100%", marginTop:4, padding:"6px 10px", borderRadius:6, border:"1px solid #e2e8f0", fontSize:13, boxSizing:"border-box" }}
                    />
                  </label>
                  {editErr && <div style={{ color:"#dc2626", fontSize:12 }}>{editErr}</div>}
                  <div style={{ display:"flex", gap:8, marginTop:4 }}>
                    <button onClick={handleEditSave} disabled={editLoading}
                      style={{ padding:"7px 16px", background:"#2F5496", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                      {editLoading ? "..." : "保存"}
                    </button>
                    <button onClick={() => { setEditRecord(null); setEditErr(null); }}
                      style={{ padding:"7px 16px", background:"#f1f5f9", color:"#475569", border:"none", borderRadius:7, fontSize:13, cursor:"pointer" }}>
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => { setDetailPopup(null); setEditRecord(null); }}
              style={{ width:"100%", padding:10, background:"#f1f5f9", border:"none", borderRadius:10, fontSize:14, cursor:"pointer", color:"#475569" }}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {photoPopup && (
        <div style={{
          position:"fixed", inset:0, zIndex:3000,
          background:"rgba(0,0,0,0.85)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
          onClick={() => setPhotoPopup(null)}
        >
          <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
            <img
              src={photoPopup}
              alt="photo"
              style={{
                maxWidth:"90vw", maxHeight:"90vh",
                borderRadius:12,
                boxShadow:"0 8px 40px rgba(0,0,0,0.5)",
              }}
            />
            <button
              onClick={() => setPhotoPopup(null)}
              style={{
                position:"absolute", top:-16, right:-16,
                width:32, height:32, borderRadius:"50%",
                background:"#fff", border:"none",
                fontSize:18, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Легенда внизу ── */}
      {pageMode === "calendar" && (
        <div style={{
          position: "fixed", bottom: 0, left: 56, right: 0,
          height: 36, zIndex: 100,
          background: "linear-gradient(45deg, #d8d8d8 0%, #ffffff 100%)",
          justifyContent: "flex-end",
          borderTop: "1px solid #e2e8f0",
          display: "flex", alignItems: "center",
          gap: 20, padding: "0 20px",
          fontSize: 12, color: "#475569",
          flexShrink: 0,
        }}>
          {[
            { color: "#dcfce7", border: "#86efac", label: "緑：時間通り（1分以上前）" },
            { color: "#fee2e2", border: "#fca5a5", label: "赤：遅刻（出勤）" },
            { color: "#fef9c3", border: "#fde047", label: "黄：早退（退勤）" },
            { color: "#e0f2fe", border: "#7dd3fc", label: "青：シフト予定あり" },
            { color: "#f1f5f9", border: "#cbd5e1", label: "グレー：シフトなし・出勤あり" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <div style={{
                width: 32, height: 16, borderRadius: 1,
                background: color, border: `1px solid #000`,
                flexShrink: 0,
              }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
      {reportLoading && (
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
              animation: "att-spin 0.8s linear infinite",
            }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 }}>
                レポートを生成中...
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>しばらくお待ちください</div>
            </div>
            <style>{`@keyframes att-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
      {alertMsg && (
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
              {alertMsg}
            </div>
            <button onClick={() => setAlertMsg(null)} style={{
              background: "#2F5496", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 28px", fontSize: 14, cursor: "pointer",
            }}>
              OK
            </button>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

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