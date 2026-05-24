import { useState, useEffect, useRef, useCallback } from "react";
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
  } catch { return ""; }
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
  }, [slots, off]);

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

/* ─── FilterPanel ───────────────────────────────────────── */
function FilterPanel({ open, onClose, filters, onFiltersChange, positionOptions, departmentOptions }) {
  const panelRef = useRef();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      function onDown(e) {
        if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
      }
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, 50);
    return () => clearTimeout(t);
  }, [open, onClose]);

  const activeCount = [filters.name, filters.position, filters.department].filter(Boolean).length;

  return (
    <>
      <div className={`${styles.filterBackdrop} ${open ? styles.filterBackdropOpen : ""}`} onClick={onClose}/>
      <div ref={panelRef} className={`${styles.filterPanel} ${open ? styles.filterPanelOpen : ""}`}>

        <div className={styles.filterHeader}>
          <span className={styles.filterTitle}>
            🔍 絞り込み
            {activeCount > 0 && <span className={styles.filterBadge}>{activeCount}</span>}
          </span>
          <div className={styles.filterHeaderActions}>
            {activeCount > 0 && (
              <button className={styles.filterClearBtn} type="button"
                onClick={() => onFiltersChange({ name:"", position:"", department:"" })}>
                クリア
              </button>
            )}
            <button className={styles.filterCloseBtn} type="button" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.filterBody}>
          <div className={styles.filterGrid}>

            <div className={styles.filterField}>
              <label className={styles.filterLabel}>氏名</label>
              <input className={styles.filterInput} type="text" placeholder="名前で検索…"
                value={filters.name}
                onChange={e => onFiltersChange({ ...filters, name: e.target.value })}/>
            </div>

            <div className={styles.filterField}>
              <label className={styles.filterLabel}>職種・役職</label>
              <select className={styles.filterSelect} value={filters.position}
                onChange={e => onFiltersChange({ ...filters, position: e.target.value })}>
                <option value="">すべて</option>
                {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className={styles.filterField}>
              <label className={styles.filterLabel}>部署</label>
              <select className={styles.filterSelect} value={filters.department}
                onChange={e => onFiltersChange({ ...filters, department: e.target.value })}>
                <option value="">すべて</option>
                {departmentOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

/* ─── WorkplaceDropdown ─────────────────────────────────── */
function WorkplaceDropdown({ workplaces, visibleWorkplaces, onToggle, onToggleAll }) {
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

  // すべて = все named workplaces + __none__ + __off__
  const allKeys = [...workplaces.map(w => w.name), "__none__", "__off__"];
  const allOn  = allKeys.every(k => visibleWorkplaces.has(k));
  const someOn = allKeys.some(k => visibleWorkplaces.has(k));

  const isFiltered = !allOn;

  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button
        type="button"
        className={`${styles.wpDropdownBtn} ${open ? styles.wpDropdownBtnActive : ""} ${isFiltered ? styles.wpDropdownBtnFiltered : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        表示フィルター
        <span className={styles.sortArrow}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className={styles.wpDropdownPanel}>
          {/* すべて */}
          <label className={styles.wpDropdownAll}>
            <input
              type="checkbox"
              className={styles.colToggleCheck}
              checked={allOn}
              ref={el => { if (el) el.indeterminate = !allOn && someOn; }}
              onChange={() => onToggleAll(allKeys, !allOn)}
            />
            <span>すべて</span>
          </label>
          <div className={styles.wpDropdownDivider} />

          {/* 場所ごと */}
          {workplaces.map(w => (
            <label key={w.id} className={styles.wpDropdownItem}>
              <input
                type="checkbox"
                className={styles.colToggleCheck}
                checked={visibleWorkplaces.has(w.name)}
                onChange={() => onToggle(w.name)}
              />
              <span>{w.name}</span>
            </label>
          ))}

          <div className={styles.wpDropdownDivider} />

          {/* 場所なし */}
          <label className={styles.wpDropdownItem}>
            <input
              type="checkbox"
              className={styles.colToggleCheck}
              checked={visibleWorkplaces.has("__none__")}
              onChange={() => onToggle("__none__")}
            />
            <span className={styles.wpSpecialLabel}>場所なし</span>
          </label>

          {/* 休み */}
          <label className={styles.wpDropdownItem}>
            <input
              type="checkbox"
              className={styles.colToggleCheck}
              checked={visibleWorkplaces.has("__off__")}
              onChange={() => onToggle("__off__")}
            />
            <span className={styles.wpSpecialLabel}>休み</span>
          </label>
        </div>
      )}
    </div>
  );
}

/* ─── SortBar ───────────────────────────────────────────── */
function SortBar({ sortConfig, onSortChange, colVisibility, onColVisibilityChange, workplaces, visibleWorkplaces, onWpToggle, onWpToggleAll }) {
  const COL_TOGGLES = [
    { key: "position",   label: "職種・役職" },
    { key: "department", label: "部署" },
  ];

  return (
    <div className={styles.sortBar}>
      <span className={styles.colToggleLabel}>表示列：</span>
      {COL_TOGGLES.map(c => {
        const isOn = colVisibility[c.key];
        return (
          <label
            key={c.key}
            className={`${styles.colToggleItem} ${isOn ? styles.colToggleItemOn : ""}`}
          >
            <input
              type="checkbox"
              className={styles.colToggleCheck}
              checked={isOn}
              onChange={() => onColVisibilityChange({ ...colVisibility, [c.key]: !isOn })}
            />
            {c.label}
          </label>
        );
      })}

      {workplaces.length > 0 && (
        <WorkplaceDropdown
          workplaces={workplaces}
          visibleWorkplaces={visibleWorkplaces}
          onToggle={onWpToggle}
          onToggleAll={onWpToggleAll}
        />
      )}

      <div className={styles.sortBarDivider} />

      <span className={styles.sortBarLabel}>並び替え：</span>
      {SORT_FIELDS.map(f => {
        const isActive = sortConfig.field === f.value;
        return (
          <button
            key={f.value}
            type="button"
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

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters]       = useState({ name:"", position:"", department:"" });
  const [sortConfig, setSortConfig] = useState({ field:"name", dir:"asc" });
  const [colVisibility, setColVisibility] = useState({ position: true, department: true });
  const [visibleWorkplaces, setVisibleWorkplaces] = useState(() => new Set());

  const totalDays = daysInMonth(ym);
  const dayNums   = Array.from({length:totalDays},(_,i)=>i+1);

  useEffect(() => { load(ym, false); }, [ym]);
  useEffect(() => {
    const interval = setInterval(() => { if (!openCell) load(ym, true); }, 60000);
    return () => clearInterval(interval);
  }, [ym, openCell]);

  async function load(ymVal, silent = false) {
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
      // Инициализируем visibleWorkplaces все включены (только при первой загрузке)
      setVisibleWorkplaces(prev =>
        prev.size === 0
          ? new Set([...(Array.isArray(wps) ? wps : []).map(w => w.name), "__none__", "__off__"])
          : prev
      );
      applyWeeks(weeks);
    } catch {
      if (!silent) { setWeeksRaw([]); setData({}); setAllStaff([]); }
    } finally {
      if (!silent) setLoading(false);
    }
  }

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

  /* ── фильтр + сортировка ── */
  const filteredStaff = (() => {
    let list = [...allStaff];
    if (filters.name.trim()) {
      const q = filters.name.trim().toLowerCase();
      list = list.filter(s => s.userName.toLowerCase().includes(q));
    }
    if (filters.position) {
      list = list.filter(s => (positions[s.userId]||"") === filters.position);
    }
    if (filters.department) {
      list = list.filter(s => (staffDepts[s.userId]||[]).includes(filters.department));
    }
    list.sort((a,b) => {
      let va = "", vb = "";
      if (sortConfig.field === "name")       { va = a.userName; vb = b.userName; }
      if (sortConfig.field === "position")   { va = positions[a.userId]||""; vb = positions[b.userId]||""; }
      if (sortConfig.field === "department") {
        va = (staffDepts[a.userId]||[])[0]||"";
        vb = (staffDepts[b.userId]||[])[0]||"";
      }
      const cmp = va.localeCompare(vb,"ja");
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
    return list;
  })();

  const positionOptions = [...new Set(allStaff.map(s => positions[s.userId]||"").filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"ja"));
  const activeFilterCount = [filters.name, filters.position, filters.department].filter(Boolean).length;

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

  async function changeStatus(weekStart, newStatus) {
    setStatusLoading(p => ({...p,[weekStart]:true}));
    try {
      await api.setWeekStatus(weekStart, newStatus);
      setData(p => ({...p,[weekStart]:{...p[weekStart],status:newStatus}}));
    } catch { alert("ステータスの変更に失敗しました"); }
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

  const handleCloseFilter = useCallback(() => setFilterOpen(false), []);

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

  /* ── render ── */
  return (
    <ManagerLayout name={getName()} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        {/* ── TopBar ── */}
        <div className={styles.topBar}>
          <select className={styles.monthSelect} value={ym}
            onChange={e => { localStorage.setItem("managerSelectedMonth",e.target.value); setYm(e.target.value); }}>
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>

          <button
            type="button"
            className={`${styles.filterToggleBtn} ${filterOpen ? styles.filterToggleBtnActive : ""} ${activeFilterCount>0 ? styles.filterToggleBtnFiltered : ""}`}
            onClick={() => setFilterOpen(v => !v)}
          >
            <span className={styles.filterToggleIcon}>🔍</span>
            <span className={styles.filterToggleLabel}>
              {activeFilterCount > 0 ? `絞り込み中 (${activeFilterCount})` : "フィルター"}
            </span>
          </button>

          <span className={styles.topHint}>📅 シフト管理</span>
        </div>

        {/* ── SortBar — всегда видна ── */}
        <SortBar sortConfig={sortConfig} onSortChange={setSortConfig}
          colVisibility={colVisibility} onColVisibilityChange={setColVisibility}
          workplaces={workplaces} visibleWorkplaces={visibleWorkplaces}
          onWpToggle={handleWpToggle} onWpToggleAll={handleWpToggleAll} />

        {/* ── Filter Panel ── */}
        <FilterPanel
          open={filterOpen}
          onClose={handleCloseFilter}
          filters={filters}
          onFiltersChange={setFilters}
          positionOptions={positionOptions}
          departmentOptions={departments}
        />

        {loading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : (
          <>
            {activeFilterCount > 0 && (
              <div className={styles.filterResultBar}>
                <span>{filteredStaff.length} / {allStaff.length} 件表示中</span>
                <button type="button" className={styles.filterResultClear}
                  onClick={() => setFilters({ name:"", position:"", department:"" })}>
                  フィルターを解除
                </button>
              </div>
            )}

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thPosition} style={!colVisibility.position ? {display:"none"} : {}}>職種<br/>・役職</th>
                    <th className={styles.thDepartment}
                      style={{
                        ...(!colVisibility.department ? {display:"none"} : {}),
                        ...(!colVisibility.position ? {left:0} : {}),
                      }}>部署</th>
                    <th className={styles.thName}
                      style={{ left: !colVisibility.position && !colVisibility.department ? 0
                                   : !colVisibility.position ? 90
                                   : !colVisibility.department ? 70
                                   : 160 }}>氏名</th>
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
                      style={{
                        ...(!colVisibility.department ? {display:"none"} : {}),
                        ...(!colVisibility.position ? {left:0} : {}),
                      }}></th>
                    <th className={`${styles.thNameSub} ${styles.thNameSubPos}`}
                      style={{ left: !colVisibility.position && !colVisibility.department ? 0
                                   : !colVisibility.position ? 90
                                   : !colVisibility.department ? 70
                                   : 160 }}></th>
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
                      <td colSpan={totalDays+2} className={styles.empty}>
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
                                style={{
                                  ...(!colVisibility.department ? {display:"none"} : {}),
                                  ...(!colVisibility.position ? {left:0} : {}),
                                }}>
                                {(staffDepts[staff.userId]||[]).join("、")}
                              </td>
                              <td className={styles.tdName} rowSpan={maxSlots}
                                style={{ left: !colVisibility.position && !colVisibility.department ? 0
                                             : !colVisibility.position ? 90
                                             : !colVisibility.department ? 70
                                             : 160 }}>
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
          </>
        )}
      </div>
    </ManagerLayout>
  );
}