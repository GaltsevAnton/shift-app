import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx-js-style";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import styles from "./ManagerTablePage.module.css";

/* ─── constants ─────────────────────────────────────────── */
const WD_JA    = ["日","月","火","水","木","金","土"];
const MONTHS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const MAX_SLOTS = 5;

const STATUS_META = {
  RECEIVING: { label:"受付中", cls:"receiving" },
  DRAFTING:  { label:"作成中", cls:"drafting"  },
  CONFIRMED: { label:"確定",   cls:"confirmed" },
};

const TIME_OPTS = [];
for (let h = 6; h < 24; h++)
  for (let m of [0,30])
    TIME_OPTS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

const SORT_FIELDS = [
  { value: "name",       label: "氏名" },
  { value: "position",   label: "職種・役職" },
  { value: "department", label: "部署" },
];

/* ─── helpers ───────────────────────────────────────────── */
function currentYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}
function daysInMonth(ym) {
  const [y,m] = ym.split("-").map(Number);
  return new Date(y,m,0).getDate();
}
function dateStr(ym,day) {
  return `${ym}-${String(day).padStart(2,"0")}`;
}
function getDayOfWeek(ym,day) {
  return new Date(dateStr(ym,day)).getDay();
}
function getName() {
  try {
    const t = localStorage.getItem("accessToken");
    return t ? JSON.parse(atob(t.split(".")[1])).fullName||"" : "";
  } catch (_) { return ""; }
}
function findWeekForDate(weeks, date) {
  return weeks.find(w => {
    const ws = new Date(w.weekStart), we = new Date(w.weekStart);
    we.setDate(we.getDate()+6);
    const d = new Date(date);
    return d>=ws && d<=we;
  });
}
function monthDaysInWeek(ym, weekStart) {
  const [y,m] = ym.split("-").map(Number);
  const result = [];
  for (let i=0;i<7;i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate()+i);
    if (d.getFullYear()===y && d.getMonth()+1===m) result.push(d.getDate());
  }
  return result;
}
function formatTime(t) {
  if (!t) return "--";
  return typeof t === "string" ? t.slice(0,5) : t;
}
function emptySlot() {
  return { startTime:"", endTime:"", last:false, workplace:"" };
}

/* ─── localStorage helpers ──────────────────────────────── */
function saveFilterSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch (_) { /* ignore */ }
}
function loadFilterSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch (_) { return null; }
}

/* ─── CellPopover ───────────────────────────────────────── */
function CellPopover({ day, anchorRef, onClose, onSave, workplaces }) {
  const isOff = day.off && (!day.slots || day.slots.length === 0);
  const [off, setOff]     = useState(isOff);
  const [slots, setSlots] = useState(() => {
    if (isOff || !day.slots || day.slots.length === 0) return [emptySlot()];
    return day.slots.map(s => ({
      startTime: s.startTime ? formatTime(s.startTime) : "",
      endTime:   s.endTime   ? formatTime(s.endTime)   : "",
      last:      s.last || false,
      workplace: s.workplace || "",
    }));
  });
  const popRef = useRef();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current || !popRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const pop    = popRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, margin = 8;
    let top;
    const spaceBelow = vh - anchor.bottom, spaceAbove = anchor.top;
    if (spaceBelow >= pop.height + margin || spaceBelow >= spaceAbove) {
      top = anchor.bottom + margin;
    } else {
      top = anchor.top - pop.height - margin;
    }
    top = Math.max(margin, Math.min(top, vh - pop.height - margin));
    let left = anchor.left + anchor.width / 2 - pop.width / 2;
    left = Math.max(margin, Math.min(left, vw - pop.width - margin));
    setPos({ top, left });
  }, [slots, off, anchorRef]);

  useEffect(() => {
    function onDown(e) {
      if (
        popRef.current && !popRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, anchorRef]);

  function updateSlot(i, field, value) {
    setSlots(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "last" && value) next[i].endTime = "";
      return next;
    });
  }
  function addSlot() {
    if (slots.length >= MAX_SLOTS) return;
    setSlots(prev => [...prev, emptySlot()]);
  }
  function removeSlot(i) {
    if (slots.length <= 1) return;
    setSlots(prev => prev.filter((_,idx) => idx !== i));
  }
  function handleSave() {
    if (off) { onSave({ off: true, slots: [] }); return; }
    const validSlots = slots
      .filter(s => s.startTime)
      .map(s => ({
        startTime: s.startTime,
        endTime:   s.last ? null : (s.endTime || null),
        last:      s.last,
        workplace: s.workplace || null,
      }));
    onSave(validSlots.length === 0
      ? { off: true, slots: [] }
      : { off: false, slots: validSlots });
  }

  return (
    <div ref={popRef} className={styles.popover}
      style={{ position:"fixed", top:pos.top, left:pos.left, transform:"none" }}>
      <label className={styles.popRow}>
        <input type="checkbox" checked={off} onChange={e=>setOff(e.target.checked)} className={styles.popCheck}/>
        <span className={styles.popRowLabel}>休日</span>
      </label>
      {!off && (
        <>
          {slots.map((slot,i) => (
            <div key={i} className={styles.slotBlock}>
              <div className={styles.slotHeader}>
                <span className={styles.slotNum}>#{i+1}</span>
                {slots.length > 1 && (
                  <button type="button" className={styles.slotRemove} onClick={()=>removeSlot(i)}>✕</button>
                )}
              </div>
              <div className={styles.popRow}>
                <span className={styles.popLabel}>場所</span>
                <select className={styles.popSelect} value={slot.workplace} onChange={e=>updateSlot(i,"workplace",e.target.value)}>
                  <option value="">— 未選択 —</option>
                  {workplaces.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div className={styles.popRow}>
                <span className={styles.popLabel}>開始</span>
                <select className={styles.popSelect} value={slot.startTime} onChange={e=>updateSlot(i,"startTime",e.target.value)}>
                  <option value="">--</option>
                  {TIME_OPTS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.popRow}>
                <span className={styles.popLabel}>終了</span>
                {slot.last ? (
                  <span className={styles.popLastBadge}>L</span>
                ) : (
                  <select className={styles.popSelect} value={slot.endTime} onChange={e=>updateSlot(i,"endTime",e.target.value)}>
                    <option value="">--</option>
                    {TIME_OPTS.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <label className={styles.popRow}>
                <input type="checkbox" checked={slot.last} onChange={e=>updateSlot(i,"last",e.target.checked)} className={styles.popCheck}/>
                <span className={styles.popRowLabel}>
                  <span className={styles.popLastLabel}>L</span> ラスト（終了未定）
                </span>
              </label>
            </div>
          ))}
          {slots.length < MAX_SLOTS && (
            <button type="button" className={styles.slotAddBtn} onClick={addSlot}>
              ＋ 勤務場所を追加
            </button>
          )}
        </>
      )}
      <div className={styles.popActions}>
        <button className={styles.popCancel} onClick={onClose}>キャンセル</button>
        <button className={styles.popSave} onClick={handleSave}>保存</button>
      </div>
    </div>
  );
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
    { key: "position",   label: "職種・役職" },
    { key: "department", label: "部署" },
  ];
  const allOn = COL_TOGGLES.every(c => colVisibility[c.key]);

  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button
        type="button"
        className={`${styles.wpDropdownBtn} ${open ? styles.wpDropdownBtnActive : ""}`}
        onClick={() => setOpen(v => !v)}
      >
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
                onColVisibilityChange({ position: next, department: next });
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
  const allOn  = allKeys.length > 0 && allKeys.every(k => visibleSet.has(k));
  const someOn = allKeys.some(k => visibleSet.has(k));
  const isFiltered = !allOn;

  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button
        type="button"
        className={`${styles.wpDropdownBtn} ${open ? styles.wpDropdownBtnActive : ""} ${isFiltered ? styles.wpDropdownBtnFiltered : ""}`}
        onClick={() => setOpen(v => !v)}
      >
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

/* ─── SortBar ───────────────────────────────────────────── */
function SortBar({
  sortConfig, onSortChange,
  colVisibility, onColVisibilityChange,
  workplaceItems, wpExtraItems, visibleWorkplaces, onWpToggle, onWpToggleAll,
  positionItems, visiblePositions, onPosToggle, onPosToggleAll,
  departmentItems, visibleDepartments, onDeptToggle, onDeptToggleAll,
  onReset, isFiltered,
}) {
  return (
    <div className={styles.sortBar}>
      <ColToggleDropdown colVisibility={colVisibility} onColVisibilityChange={onColVisibilityChange} />

      {positionItems.length > 0 && (
        <CheckDropdown
          label="職種・役職"
          items={positionItems}
          visibleSet={visiblePositions}
          onToggle={onPosToggle}
          onToggleAll={onPosToggleAll}
        />
      )}

      {departmentItems.length > 0 && (
        <CheckDropdown
          label="部署"
          items={departmentItems}
          visibleSet={visibleDepartments}
          onToggle={onDeptToggle}
          onToggleAll={onDeptToggleAll}
        />
      )}

      {(workplaceItems.length > 0 || wpExtraItems.length > 0) && (
        <CheckDropdown
          label="表示フィルター"
          items={workplaceItems}
          visibleSet={visibleWorkplaces}
          onToggle={onWpToggle}
          onToggleAll={onWpToggleAll}
          extraItems={wpExtraItems}
        />
      )}

      <div className={styles.sortBarDivider} />

      {isFiltered && (
        <button type="button" className={styles.resetBtn} onClick={onReset}>
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
            onClick={() => onSortChange({
              field: f.value,
              dir: isActive ? (sortConfig.dir === "asc" ? "desc" : "asc") : "asc",
            })}
          >
            {f.label}
            <span className={styles.sortArrow}>
              {isActive ? (sortConfig.dir === "asc" ? "↑" : "↓") : "↕"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */
export default function ManagerTablePage({ view, onNavigate, onLogout }) {
  const [ym, setYm] = useState(() => localStorage.getItem("managerSelectedMonth") || currentYM());
  const [weeksRaw, setWeeksRaw]     = useState([]);
  const [data, setData]             = useState({});
  const [allStaff, setAllStaff]     = useState([]);
  const [positions, setPositions]   = useState({});
  const [workplaces, setWorkplaces] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staffDepts, setStaffDepts]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [statusLoading, setStatusLoading] = useState({});
  const [savingCell, setSavingCell]       = useState(null);
  const [openCell, setOpenCell]           = useState(null);
  const cellAnchorRefs = useRef({});

  const [sortConfig, setSortConfig] = useState({ field:"name", dir:"asc" });
  const [colVisibility, setColVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem("mgrColVisibility");
      return raw ? JSON.parse(raw) : { position: true, department: true };
    } catch (_) { return { position: true, department: true }; }
  });
  const [visibleWorkplaces, setVisibleWorkplaces]   = useState(() => loadFilterSet("mgrFilterWp")   || new Set());
  const [visiblePositions, setVisiblePositions]     = useState(() => loadFilterSet("mgrFilterPos")  || new Set());
  const [visibleDepartments, setVisibleDepartments] = useState(() => loadFilterSet("mgrFilterDept") || new Set());

  const totalDays = daysInMonth(ym);
  const dayNums   = Array.from({length:totalDays},(_,i)=>i+1);

  const load = useCallback(async (ymVal, silent = false) => {
    if (!silent) { setLoading(true); setOpenCell(null); }
    try {
      const [weeks, employees, wps, depts] = await Promise.all([
        api.managerMonth(ymVal),
        api.managerEmployeesList(),
        api.settingsWorkplacesList(),
        api.settingsDepartmentsList(),
      ]);
      const posMap = {}, deptsMap = {};
      employees.forEach(e => {
        posMap[e.id] = e.position || "";
        deptsMap[e.id] = (e.departments || []).map(d => d.name);
      });
      setPositions(posMap);
      setStaffDepts(deptsMap);
      setWorkplaces(Array.isArray(wps) ? wps : []);
      setDepartments(Array.isArray(depts) ? depts : []);

      const allWpSet  = new Set([...(Array.isArray(wps) ? wps : []).map(w => w.name), "__none__", "__off__"]);
      const allPosSet = new Set(Object.values(posMap).filter(Boolean));
      const allDeptSet = new Set(Object.values(deptsMap).flat());

      // Восстанавливаем из localStorage, но только если там что-то есть (не пустой массив)
      const savedWp   = loadFilterSet("mgrFilterWp");
      const savedPos  = loadFilterSet("mgrFilterPos");
      const savedDept = loadFilterSet("mgrFilterDept");

      setVisibleWorkplaces(savedWp   && savedWp.size   > 0 ? savedWp   : allWpSet);
      setVisiblePositions (savedPos  && savedPos.size  > 0 ? savedPos  : allPosSet);
      setVisibleDepartments(savedDept && savedDept.size > 0 ? savedDept : allDeptSet);
      applyWeeks(weeks);
    } catch (_) {
      if (!silent) { setWeeksRaw([]); setData({}); setAllStaff([]); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(ym, false); }, [ym, load]);
  useEffect(() => {
    const interval = setInterval(() => { if (!openCell) load(ym, true); }, 60000);
    return () => clearInterval(interval);
  }, [ym, openCell, load]);

  useEffect(() => { saveFilterSet("mgrFilterPos",  visiblePositions);   }, [visiblePositions]);
  useEffect(() => { saveFilterSet("mgrFilterDept", visibleDepartments); }, [visibleDepartments]);
  useEffect(() => { saveFilterSet("mgrFilterWp",   visibleWorkplaces);  }, [visibleWorkplaces]);
  useEffect(() => {
    try { localStorage.setItem("mgrColVisibility", JSON.stringify(colVisibility)); } catch (_) { /* ignore */ }
  }, [colVisibility]);

  function applyWeeks(weeks) {
    setWeeksRaw(weeks);
    const staffMap = {}, newData = {};
    weeks.forEach(w => {
      const staffById = {};
      (w.rows||[]).forEach(row => {
        const dayMap = {};
        (row.days||[]).forEach(d => { dayMap[d.date] = d; });
        staffById[row.userId] = { userName:row.userName, dayMap };
        if (!staffMap[row.userId]) staffMap[row.userId] = { userId:row.userId, userName:row.userName };
      });
      newData[w.weekStart] = { status:w.status||"RECEIVING", staffById };
    });
    setData(newData);
    setAllStaff(Object.values(staffMap).sort((a,b) => a.userName.localeCompare(b.userName,"ja")));
  }

  function getDayData(userId, date) {
    const week = findWeekForDate(weeksRaw, date);
    if (!week) return { date, off:true, slots:[] };
    const row = data[week.weekStart]?.staffById?.[userId];
    return row?.dayMap?.[date] || { date, off:true, slots:[] };
  }

  function maxSlotsForStaff(userId) {
    let max = 1;
    dayNums.forEach(d => {
      const day = getDayData(userId, dateStr(ym,d));
      const cnt = (day.slots&&day.slots.length)||0;
      if (cnt > max) max = cnt;
    });
    return max;
  }

  /* ── каскадный фильтр ── */

  // Все уникальные 職種 в системе (для дропдауна верхнего уровня)
  const positionOptions = [...new Set(allStaff.map(s => positions[s.userId]||"").filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"ja"));

  // Шаг 1: фильтр по 職種
  const staffByPosition = visiblePositions.size === 0
    ? []
    : allStaff.filter(s => visiblePositions.has(positions[s.userId]||""));

  // Шаг 2: доступные 部署 после 職種
  const availableDeptNames = new Set(staffByPosition.flatMap(s => staffDepts[s.userId]||[]));
  const allDepartmentItems = departments
    .filter(d => availableDeptNames.has(d.name))
    .map(d => ({ value: d.name, label: d.name }));

  // Шаг 3: фильтр по 部署
  const staffByDept = (() => {
    if (visiblePositions.size === 0) return [];
    if (allDepartmentItems.length > 0) {
      if (visibleDepartments.size === 0) return [];
      return staffByPosition.filter(s =>
        (staffDepts[s.userId]||[]).some(d => visibleDepartments.has(d))
      );
    }
    return [...staffByPosition];
  })();

  // Шаг 4: доступные 場所 после 部署
  const availableWorkplaceNames = (() => {
    const names = new Set();
    staffByDept.forEach(s => {
      dayNums.forEach(d => {
        const day = getDayData(s.userId, dateStr(ym, d));
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
    let va = "", vb = "";
    if (sortConfig.field === "name")       { va = a.userName; vb = b.userName; }
    if (sortConfig.field === "position")   { va = positions[a.userId]||""; vb = positions[b.userId]||""; }
    if (sortConfig.field === "department") {
      va = (staffDepts[a.userId]||[])[0]||"";
      vb = (staffDepts[b.userId]||[])[0]||"";
    }
    return (sortConfig.dir === "asc" ? 1 : -1) * va.localeCompare(vb, "ja");
  }

  // Шаг 5: итоговый список после фильтра 場所
  const filteredStaff = (() => {
    if (staffByDept.length === 0) return [];
    const allWpKeys = [...workplaceItems.map(i => i.value), ...wpExtraItems.map(i => i.value)];
    if (allWpKeys.length > 0 && visibleWorkplaces.size === 0) return [];
    if (allWpKeys.length === 0) return [...staffByDept].sort(sortFn);
    return staffByDept.filter(s =>
      dayNums.some(d => {
        const day = getDayData(s.userId, dateStr(ym, d));
        if (day.off || !day.slots || day.slots.length === 0) return visibleWorkplaces.has("__off__");
        return day.slots.some(sl =>
          sl.workplace ? visibleWorkplaces.has(sl.workplace) : visibleWorkplaces.has("__none__")
        );
      })
    ).sort(sortFn);
  })();

  // Шаг 6: items для дропдаунов — всегда все доступные значения, независимо от своего фильтра
  const positionItems = positionOptions.map(p => ({ value: p, label: p }));
  const departmentItems = allDepartmentItems;

  const _f1 = positionOptions.some(p => !visiblePositions.has(p));
  const _f2 = allDepartmentItems.some(d => !visibleDepartments.has(d.value));
  const _f3 = workplaces.some(w => !visibleWorkplaces.has(w.name));
  const _f4 = workplaces.length > 0 && (!visibleWorkplaces.has("__none__") || !visibleWorkplaces.has("__off__"));
  const isFiltered = _f1 || _f2 || _f3 || _f4;

  async function changeStatus(weekStart, newStatus) {
    setStatusLoading(p => ({...p,[weekStart]:true}));
    try {
      await api.setWeekStatus(weekStart, newStatus);
      setData(p => ({...p,[weekStart]:{...p[weekStart],status:newStatus}}));
    } catch (_) { alert("ステータスの変更に失敗しました"); }
    finally { setStatusLoading(p => ({...p,[weekStart]:false})); }
  }

  async function saveCell(userId, date, patch) {
    const week = findWeekForDate(weeksRaw, date);
    if (!week) return;
    const days = [];
    for (let i=0;i<7;i++) {
      const d = new Date(week.weekStart);
      d.setDate(d.getDate()+i);
      const ds = d.toISOString().slice(0,10);
      const existing = data[week.weekStart]?.staffById?.[userId]?.dayMap?.[ds]
        || { date:ds, off:true, slots:[] };
      days.push(ds===date ? { date:ds, off:patch.off, slots:patch.slots } : {
        date:ds, off:existing.off,
        slots:(existing.slots||[]).map(s=>({
          startTime:s.startTime, endTime:s.endTime, last:s.last, workplace:s.workplace,
        })),
      });
    }
    setSavingCell(`${userId}_${date}`);
    try {
      await api.managerStaffWeekSave(userId, week.weekStart, days);
      setData(prev => {
        const wk = prev[week.weekStart];
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
                dayMap: { ...row.dayMap, [date]:{ ...(row.dayMap[date]||{date}), off:patch.off, slots:patch.slots } },
              },
            },
          },
        };
      });
    } catch (e) {
      if (e.message && e.message.includes("他のユーザー")) {
        alert(e.message); await load(ym, true);
      } else { alert("保存に失敗しました"); }
    } finally { setSavingCell(null); }
  }

  const monthOptions = (() => {
    const opts=[], now=new Date();
    for (let delta=-3;delta<=6;delta++) {
      const d = new Date(now.getFullYear(), now.getMonth()+delta, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      opts.push({ val, label:`${d.getFullYear()}年 ${MONTHS_JA[d.getMonth()]}` });
    }
    return opts;
  })();

  function handleWpToggle(name) {
    setVisibleWorkplaces(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }
  function handleWpToggleAll(allKeys, allOn) {
    setVisibleWorkplaces(allOn ? new Set(allKeys) : new Set());
  }

  function recalcDepts(newVisiblePositions) {
    const staffAfterPos = allStaff.filter(s => newVisiblePositions.has(positions[s.userId]||""));
    const available = new Set(staffAfterPos.flatMap(s => staffDepts[s.userId]||[]));
    setVisibleDepartments(new Set(available));
  }
  function handlePosToggle(name) {
    const next = new Set(visiblePositions);
    next.has(name) ? next.delete(name) : next.add(name);
    setVisiblePositions(next);
    recalcDepts(next);
  }
  function handlePosToggleAll(allKeys, allOn) {
    const next = allOn ? new Set(allKeys) : new Set();
    setVisiblePositions(next);
    recalcDepts(next);
  }

  function handleDeptToggle(name) {
    setVisibleDepartments(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
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
  }

  function exportToExcel() {
    const [y, m] = ym.split("-").map(Number);
    const days = Array.from({ length: daysInMonth(ym) }, (_, i) => i + 1);
  
    // ── Стили ──
    const S = {
      headerMain: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
        fill: { fgColor: { rgb: "2F5496" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "AAAAAA" } },
          bottom: { style: "thin", color: { rgb: "AAAAAA" } },
          left:   { style: "thin", color: { rgb: "AAAAAA" } },
          right:  { style: "thin", color: { rgb: "AAAAAA" } },
        },
      },
      headerSat: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "AAAAAA" } },
          bottom: { style: "thin", color: { rgb: "AAAAAA" } },
          left:   { style: "thin", color: { rgb: "AAAAAA" } },
          right:  { style: "thin", color: { rgb: "AAAAAA" } },
        },
      },
      headerSun: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
        fill: { fgColor: { rgb: "C0504D" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "AAAAAA" } },
          bottom: { style: "thin", color: { rgb: "AAAAAA" } },
          left:   { style: "thin", color: { rgb: "AAAAAA" } },
          right:  { style: "thin", color: { rgb: "AAAAAA" } },
        },
      },
      cellNormal: {
        font: { sz: 9 },
        alignment: { vertical: "top", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left:   { style: "thin", color: { rgb: "DDDDDD" } },
          right:  { style: "thin", color: { rgb: "DDDDDD" } },
        },
      },
      cellSat: {
        font: { sz: 9 },
        fill: { fgColor: { rgb: "EEF3FF" } },
        alignment: { vertical: "top", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left:   { style: "thin", color: { rgb: "DDDDDD" } },
          right:  { style: "thin", color: { rgb: "DDDDDD" } },
        },
      },
      cellSun: {
        font: { sz: 9 },
        fill: { fgColor: { rgb: "FFEEED" } },
        alignment: { vertical: "top", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left:   { style: "thin", color: { rgb: "DDDDDD" } },
          right:  { style: "thin", color: { rgb: "DDDDDD" } },
        },
      },
      cellOff: {
        font: { sz: 9, color: { rgb: "CC0000" } },
        fill: { fgColor: { rgb: "FFE0E0" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left:   { style: "thin", color: { rgb: "DDDDDD" } },
          right:  { style: "thin", color: { rgb: "DDDDDD" } },
        },
      },
      cellName: {
        font: { bold: true, sz: 9 },
        fill: { fgColor: { rgb: "F5F5F5" } },
        alignment: { vertical: "center", wrapText: false },
        border: {
          top:    { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left:   { style: "thin", color: { rgb: "DDDDDD" } },
          right:  { style: "thin", color: { rgb: "DDDDDD" } },
        },
      },
      cellMeta: {
        font: { sz: 9, color: { rgb: "555555" } },
        fill: { fgColor: { rgb: "F5F5F5" } },
        alignment: { vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin", color: { rgb: "DDDDDD" } },
          bottom: { style: "thin", color: { rgb: "DDDDDD" } },
          left:   { style: "thin", color: { rgb: "DDDDDD" } },
          right:  { style: "thin", color: { rgb: "DDDDDD" } },
        },
      },
    };
  
    // ── Заголовок ──
    const headerRow = [
      { v: "職種・役職", s: S.headerMain },
      { v: "部署",       s: S.headerMain },
      { v: "氏名",       s: S.headerMain },
    ];
    days.forEach(d => {
      const wd = getDayOfWeek(ym, d);
      const label = `${d}\n${WD_JA[wd]}`;
      headerRow.push({
        v: label,
        s: wd === 6 ? S.headerSat : wd === 0 ? S.headerSun : S.headerMain,
      });
    });
  
    // ── Строки данных ──
    const dataRows = filteredStaff.map(staff => {
      const row = [
        { v: positions[staff.userId] || "",                         s: S.cellMeta },
        { v: (staffDepts[staff.userId] || []).join("、"),           s: S.cellMeta },
        { v: staff.userName,                                        s: S.cellName },
      ];
  
      days.forEach(d => {
        const wd  = getDayOfWeek(ym, d);
        const day = getDayData(staff.userId, dateStr(ym, d));
  
        if (day.off || !day.slots || day.slots.length === 0) {
          row.push({ v: "休", s: S.cellOff });
          return;
        }
  
        const visibleSlots = day.slots.filter(s =>
          s.workplace ? visibleWorkplaces.has(s.workplace) : visibleWorkplaces.has("__none__")
        );
  
        if (visibleSlots.length === 0) {
          const base = wd === 6 ? S.cellSat : wd === 0 ? S.cellSun : S.cellNormal;
          row.push({ v: "", s: base });
          return;
        }
  
        const text = visibleSlots.map(s => {
          const start = formatTime(s.startTime);
          const end   = s.last ? "L" : formatTime(s.endTime);
          const place = s.workplace ? ` ${s.workplace}` : "";
          return `${start}〜${end}${place}`;
        }).join("\n");
  
        const base = wd === 6 ? S.cellSat : wd === 0 ? S.cellSun : S.cellNormal;
        row.push({ v: text, s: base });
      });
  
      return row;
    });
  
    // ── Сборка листа ──
    const wsData = [headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData, { cellStyles: true });
  
    // ── Ширина колонок ──
    ws["!cols"] = [
      { wch: 14 }, // 職種・役職
      { wch: 14 }, // 部署
      { wch: 14 }, // 氏名
      ...days.map(() => ({ wch: 13 })),
    ];
  
    // ── Высота строк ──
    ws["!rows"] = [
      { hpt: 30 }, // заголовок
      ...dataRows.map(() => ({ hpt: 40 })),
    ];
  
    // ── Freeze: первые 3 колонки + 1 строка заголовка ──
    ws["!freeze"] = { xSplit: 3, ySplit: 1 };
  
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${y}年${m}月`);
    XLSX.writeFile(wb, `シフト_${ym}.xlsx`);
  }
  return (
    <ManagerLayout name={getName()} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        <div className={styles.topBar}>
          <select className={styles.monthSelect} value={ym}
            onChange={e => { localStorage.setItem("managerSelectedMonth",e.target.value); setYm(e.target.value); }}>
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <button type="button" className={styles.exportBtn} onClick={exportToExcel} disabled={loading || filteredStaff.length === 0}>
            📥 Excel
          </button>
          <span className={styles.topHint}>📅 シフト管理</span>
        </div>

        <SortBar sortConfig={sortConfig} onSortChange={setSortConfig}
          colVisibility={colVisibility} onColVisibilityChange={setColVisibility}
          workplaceItems={workplaceItems} wpExtraItems={wpExtraItems}
          visibleWorkplaces={visibleWorkplaces}
          onWpToggle={handleWpToggle} onWpToggleAll={handleWpToggleAll}
          positionItems={positionItems} visiblePositions={visiblePositions}
          onPosToggle={handlePosToggle} onPosToggleAll={handlePosToggleAll}
          departmentItems={departmentItems} visibleDepartments={visibleDepartments}
          onDeptToggle={handleDeptToggle} onDeptToggleAll={handleDeptToggleAll}
          onReset={handleReset} isFiltered={isFiltered} />

        {loading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thPosition} style={!colVisibility.position ? {display:"none"} : {}}>職種・役職</th>
                  <th className={styles.thDepartment}
                    style={{ ...(!colVisibility.department ? {display:"none"} : {}), ...(!colVisibility.position ? {left:0} : {}) }}>部署</th>
                  <th className={styles.thName}
                    style={{ left: !colVisibility.position && !colVisibility.department ? 0 : !colVisibility.position ? 90 : !colVisibility.department ? 70 : 160 }}>氏名</th>
                  {dayNums.map(d => {
                    const wd = getDayOfWeek(ym,d);
                    return (
                      <th key={d} className={`${styles.thDay} ${wd===6?styles.thSat:""} ${wd===0?styles.thSun:""}`}>
                        <span className={styles.thNum}>{d}</span>
                        <span className={styles.thWd}>{WD_JA[wd]}</span>
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className={styles.thNameSub} style={!colVisibility.position ? {display:"none"} : {}}></th>
                  <th className={`${styles.thNameSub} ${styles.thNameSubPos}`}
                    style={{ ...(!colVisibility.department ? {display:"none"} : {}), ...(!colVisibility.position ? {left:0} : {}) }}></th>
                  <th className={`${styles.thNameSub} ${styles.thNameSubPos}`}
                    style={{ left: !colVisibility.position && !colVisibility.department ? 0 : !colVisibility.position ? 90 : !colVisibility.department ? 70 : 160 }}></th>
                  {weeksRaw.map(week => {
                    const wkDays = monthDaysInWeek(ym, week.weekStart);
                    if (wkDays.length===0) return null;
                    const wkData = data[week.weekStart]||{status:"RECEIVING"};
                    const sm     = STATUS_META[wkData.status]||STATUS_META.RECEIVING;
                    const isLoad = !!statusLoading[week.weekStart];
                    return (
                      <th key={week.weekStart} colSpan={wkDays.length} className={styles.thWeek}>
                        <div className={styles.thWeekInner}>
                          <span className={styles.thWeekRange}>
                            {(() => {
                              const ws=new Date(week.weekStart), we=new Date(week.weekStart);
                              we.setDate(we.getDate()+6);
                              const [y,m]=ym.split("-").map(Number);
                              const fmt=d=>{
                                const same=d.getFullYear()===y&&d.getMonth()+1===m;
                                return same?`${d.getDate()}日`:`${d.getMonth()+1}/${d.getDate()}`;
                              };
                              return `${fmt(ws)}〜${fmt(we)}`;
                            })()}
                          </span>
                          <select
                            className={`${styles.statusSelect} ${styles[`s_${sm.cls}`]}`}
                            value={wkData.status} disabled={isLoad}
                            onChange={e=>changeStatus(week.weekStart,e.target.value)}
                          >
                            <option value="RECEIVING">受付中</option>
                            <option value="DRAFTING">作成中</option>
                            <option value="CONFIRMED">確定</option>
                          </select>
                          {isLoad && <span className={styles.statusSpinner}>…</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={totalDays+3} className={styles.empty}>
                      {allStaff.length === 0 ? "スタッフが登録されていません" : "該当するスタッフが見つかりません"}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map(staff => {
                    const maxSlots = maxSlotsForStaff(staff.userId);
                    return Array.from({length:maxSlots},(_,subIdx) => (
                      <tr key={`${staff.userId}_${subIdx}`} className={styles.staffRow} data-staff={staff.userId}>
                        {subIdx===0 && (
                          <>
                            <td className={styles.tdPosition} rowSpan={maxSlots}
                              style={!colVisibility.position ? {display:"none"} : {}}>
                              {positions[staff.userId]||""}
                            </td>
                            <td className={styles.tdDepartment} rowSpan={maxSlots}
                              style={{ ...(!colVisibility.department ? {display:"none"} : {}), ...(!colVisibility.position ? {left:0} : {}) }}>
                              {(staffDepts[staff.userId]||[]).join("、")}
                            </td>
                            <td className={styles.tdName} rowSpan={maxSlots}
                              style={{ left: !colVisibility.position && !colVisibility.department ? 0 : !colVisibility.position ? 90 : !colVisibility.department ? 70 : 160 }}>
                              {staff.userName}
                            </td>
                          </>
                        )}
                        {dayNums.map(d => {
                          const date  = dateStr(ym,d);
                          const day   = getDayData(staff.userId, date);
                          const slots = day.slots || [];
                          const isWeekStart = weeksRaw.some(w=>monthDaysInWeek(ym,w.weekStart)[0]===d);
                          const wd    = getDayOfWeek(ym,d);
                          const isWknd = wd===0||wd===6;
                          const cellCls = [
                            styles.cell,
                            isWknd?styles.cellWknd:"",
                            openCell?.userId===staff.userId&&openCell?.date===date?styles.cellOpen:"",
                            isWeekStart?styles.cellWeekStart:"",
                          ].join(" ");

                          if (subIdx===0) {
                            const key = `${staff.userId}_${date}`;
                            if (!cellAnchorRefs.current[key]) cellAnchorRefs.current[key]={current:null};
                            const anchorRef = cellAnchorRefs.current[key];
                            const isSaving  = savingCell===key;
                            const isOpen    = openCell?.userId===staff.userId&&openCell?.date===date;

                            return (
                              <td key={d} className={cellCls} rowSpan={maxSlots}
                                style={{padding:0,verticalAlign:"top",position:"relative"}}>
                                <div className={styles.cellAnchor}
                                  ref={el=>{anchorRef.current=el;}}
                                  onClick={()=>!isSaving&&setOpenCell(isOpen?null:{userId:staff.userId,date})}>
                                  {isSaving ? (
                                    <div className={styles.slotRow}><span className={styles.cellBusy}>…</span></div>
                                  ) : day.off || slots.length === 0 ? (
                                    visibleWorkplaces.has("__off__") && (
                                      <div className={styles.slotRow}><span className={styles.cellOff}>休</span></div>
                                    )
                                  ) : (
                                    slots
                                      .filter(s => s.workplace
                                        ? visibleWorkplaces.has(s.workplace)
                                        : visibleWorkplaces.has("__none__")
                                      )
                                      .map((s, si) => (
                                        <div key={si} className={styles.slotRow}>
                                          {s.last
                                            ? <span className={styles.cellTime}>{formatTime(s.startTime)}<br/><span className={styles.cellLast}>L</span></span>
                                            : <span className={styles.cellTime}>{formatTime(s.startTime)}<br/>{formatTime(s.endTime)}</span>
                                          }
                                          {s.workplace && (
                                            <span className={styles.cellWorkplace}>{s.workplace}</span>
                                          )}
                                        </div>
                                      ))
                                  )}
                                </div>
                                {isOpen && (
                                  <CellPopover
                                    day={day} anchorRef={anchorRef} workplaces={workplaces}
                                    onClose={()=>setOpenCell(null)}
                                    onSave={patch=>{setOpenCell(null);saveCell(staff.userId,date,patch);}}
                                  />
                                )}
                              </td>
                            );
                          }
                          return null;
                        })}
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}