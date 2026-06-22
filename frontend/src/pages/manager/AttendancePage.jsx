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
function fmtTime(instant) {
  if (!instant) return "--:--";
  return new Date(instant).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo",
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
function CheckDropdown({ label, items, visibleSet, onToggle, onToggleAll, extraItems }) {
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
        <div className={styles.wpDropdownPanel}>
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
  const [sortConfig, setSortConfig] = useState({ field: "name", dir: "asc" });

  /* ── popup ── */
  const [detailPopup, setDetailPopup] = useState(null);
  const [editRecord,  setEditRecord]  = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr,     setEditErr]     = useState(null);
  const [photoPopup, setPhotoPopup] = useState(null);

  /* ── persist ── */
  useEffect(() => { localStorage.setItem("attViewMode",      viewMode);     }, [viewMode]);
  useEffect(() => { localStorage.setItem("attSelectedMonth", ym);           }, [ym]);
  useEffect(() => { localStorage.setItem("attSelectedWeek",  selectedWeek); }, [selectedWeek]);
  useEffect(() => { if (periodFrom) localStorage.setItem("attRangeFrom", periodFrom); }, [periodFrom]);
  useEffect(() => { if (periodTo)   localStorage.setItem("attRangeTo",   periodTo);   }, [periodTo]);
  useEffect(() => { saveFilterSet("attFilterPos",    visiblePositions);  }, [visiblePositions]);
  useEffect(() => { saveFilterSet("attFilterDept",   visibleDepartments);}, [visibleDepartments]);
  useEffect(() => { saveFilterSet("attFilterStatus", visibleStatuses);   }, [visibleStatuses]);
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

      const [recs, emps, depts] = await Promise.all([
        api.attendanceRecords(from, to),
        api.managerEmployeesList(),
        api.settingsDepartmentsList(),
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
        ? emps.filter(e => e.active && (e.role === "STAFF" || e.role === "MANAGER"))
        : [];
      setStaff(activeStaff);

      const allPosSet  = new Set(activeStaff.map(s => posMap[s.id] || "").filter(Boolean));
      const savedPos  = loadFilterSet("attFilterPos");
      const savedDept = loadFilterSet("attFilterDept");
      setVisiblePositions(savedPos  && savedPos.size  > 0 ? savedPos  : allPosSet);
      const allDeptSet = new Set(activeStaff.flatMap(s => deptsMap[s.id] || []));
      setVisibleDepartments(savedDept && savedDept.size > 0 ? savedDept : allDeptSet);

      setRecords(Array.isArray(recs) ? recs : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [displayDates]);

  useEffect(() => { load(false); }, [displayDates]);

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
    return filteredStaff.filter(s => {
      return displayDates.some(date => {
        const dayRecs = getRecordsForDay(s.id, date);
        const status  = getCellStatus(dayRecs);
        if (!status) return visibleStatuses.has("none");
        return visibleStatuses.has(status);
      });
    });
  }, [filteredStaff, displayDates, visibleStatuses, getRecordsForDay, getCellStatus]);

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
  function handleReset() {
    localStorage.removeItem("attFilterPos");
    localStorage.removeItem("attFilterDept");
    localStorage.removeItem("attFilterStatus");
    setVisiblePositions(new Set(positionOptions));
    setVisibleDepartments(new Set(departments.map(d => d.name)));
    setVisibleStatuses(new Set(STATUS_FILTER_ITEMS.map(i => i.value)));
  }

  const _f1 = positionOptions.some(p => !visiblePositions.has(p));
  const _f2 = allDepartmentItems.some(d => !visibleDepartments.has(d.value));
  const _f3 = STATUS_FILTER_ITEMS.some(i => !visibleStatuses.has(i.value));
  const isFiltered = _f1 || _f2 || _f3;

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

  function getCellContent(dayRecs) {
    const clockIn  = dayRecs.find(r => r.recordType === "CLOCK_IN");
    const clockOut = dayRecs.find(r => r.recordType === "CLOCK_OUT");
    if (!clockIn) return null;
    return {
      in:  fmtTime(clockIn.recordedAt),
      out: clockOut ? fmtTime(clockOut.recordedAt) : null,
    };
  }
  function getDotColor(status) {
    if (status === "finished") return "#16a34a";
    if (status === "working")  return "#2563eb";
    if (status === "break")    return "#d97706";
    return null;
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

        {/* ── TopBar ── */}
        <div className={styles.topBar}>
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

          <div className={styles.sortBarDivider} />

          {isFiltered && (
            <button type="button" className={styles.resetBtn} onClick={handleReset}>
              リセット
            </button>
          )}

          <div className={styles.sortBarDivider} />

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

                    {weekColSpans.map(({ week, count }) => (
                      <th key={week.weekStart} colSpan={count} className={styles.thWeek}>
                        <div className={styles.thWeekInner}>
                          <span className={styles.thWeekRange}>
                            {fmtWeekLabel(week.weekStart, addDays(week.weekStart, 6))}
                          </span>
                        </div>
                      </th>
                    ))}
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
                    <tr key={s.id} className={styles.staffRow} data-staff={s.id}>
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

                      {displayDates.map(date => {
                        const wd      = new Date(date).getDay();
                        const isWknd  = wd === 0 || wd === 6;
                        const isWeekStart = weekColSpans.some(({ week }) => week.weekStart === date);
                        const dayRecs = getRecordsForDay(s.id, date);
                        const status  = getCellStatus(dayRecs);
                        const content = getCellContent(dayRecs);
                        const dot     = getDotColor(status);

                        return (
                          <td key={date}
                            className={`${styles.cell} ${isWknd ? styles.cellWknd : ""} ${isWeekStart ? styles.cellWeekStart : ""}`}
                            style={{ padding:0, verticalAlign:"top", cursor: dayRecs.length > 0 ? "pointer" : "default" }}
                            onClick={() => dayRecs.length > 0 && setDetailPopup({
                              userId: s.id, userName: s.fullName, date, dayRecords: dayRecs,
                            })}
                          >
                            <div className={styles.cellAnchor} style={{ alignItems:"center", justifyContent:"center" }}>
                              {dot && (
                                <div style={{
                                  position:"absolute", top:3, right:3,
                                  width:6, height:6, borderRadius:"50%",
                                  background: dot, zIndex:1,
                                }} />
                              )}
                              {content && (
                                <div style={{ padding:"4px 2px", textAlign:"center" }}>
                                  <div style={{ fontSize:11, color:"#16a34a", fontWeight:600, fontFamily:"monospace" }}>
                                    {content.in}
                                  </div>
                                  <div style={{ fontSize:11, color: content.out ? "#dc2626" : "#94a3b8", fontFamily:"monospace" }}>
                                    {content.out || "--:--"}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
            minWidth:340, maxWidth:440,
            boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#1e293b", marginBottom:4 }}>
              {detailPopup.userName}
            </div>
            <div style={{ fontSize:13, color:"#94a3b8", marginBottom:16 }}>{detailPopup.date}</div>

            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              {detailPopup.dayRecords.map(r => (
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
                      <button onClick={() => setPhotoPopup(r.photoPath)}
                        style={{ fontSize:20, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                        📷
                    </button>
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