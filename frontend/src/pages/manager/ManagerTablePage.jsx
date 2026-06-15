import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
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

const TIME_OPTS = [];
for (let h = 6; h < 24; h++)
  for (let m of [0, 30])
    TIME_OPTS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

const SORT_FIELDS = [
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
  try {
    const t = localStorage.getItem("accessToken");
    return t ? JSON.parse(atob(t.split(".")[1])).fullName || "" : "";
  } catch { return ""; }
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
  return { startTime:"", endTime:"", last:false, workplace:"" };
}
function periodDays(from, to) {
  if (!from || !to) return 0;
  return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
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
// Форматировать дату для заголовка недели в шапке таблицы
function fmtWeekLabel(ws, we) {
  const wsD = new Date(ws), weD = new Date(we);
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  return `${fmt(wsD)}〜${fmt(weD)}`;
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

/* ─── BulkPopover ───────────────────────────────────────── */
function BulkPopover({ onClose, onSave, workplaces }) {
  const [off, setOff]     = useState(false);
  const [slots, setSlots] = useState([emptySlot()]);

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
    setSlots(prev => prev.filter((_, idx) => idx !== i));
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
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.popover} style={{ position: "relative", top: "auto", left: "auto" }}>
        <label className={styles.popRow}>
          <input type="checkbox" checked={off} onChange={e => setOff(e.target.checked)} className={styles.popCheck} />
          <span className={styles.popRowLabel}>公休</span>
        </label>
        {!off && (
          <>
            {slots.map((slot, i) => (
              <div key={i} className={styles.slotBlock}>
                <div className={styles.slotHeader}>
                  <span className={styles.slotNum}>#{i + 1}</span>
                  {slots.length > 1 && (
                    <button type="button" className={styles.slotRemove} onClick={() => removeSlot(i)}>✕</button>
                  )}
                </div>
                <div className={styles.popRow}>
                  <span className={styles.popLabel}>場所</span>
                  <select className={styles.popSelect} value={slot.workplace} onChange={e => updateSlot(i, "workplace", e.target.value)}>
                    <option value="">— 未選択 —</option>
                    {workplaces.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                  </select>
                </div>
                <div className={styles.popRow}>
                  <span className={styles.popLabel}>開始</span>
                  <select className={styles.popSelect} value={slot.startTime} onChange={e => updateSlot(i, "startTime", e.target.value)}>
                    <option value="">--</option>
                    {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className={styles.popRow}>
                  <span className={styles.popLabel}>終了</span>
                  {slot.last ? (
                    <span className={styles.popLastBadge}>L</span>
                  ) : (
                    <select className={styles.popSelect} value={slot.endTime} onChange={e => updateSlot(i, "endTime", e.target.value)}>
                      <option value="">--</option>
                      {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                </div>
                <label className={styles.popRow}>
                  <input type="checkbox" checked={slot.last} onChange={e => updateSlot(i, "last", e.target.checked)} className={styles.popCheck} />
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
    setSlots(prev => prev.filter((_, idx) => idx !== i));
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
        <input type="checkbox" checked={off} onChange={e => setOff(e.target.checked)} className={styles.popCheck}/>
        <span className={styles.popRowLabel}>公休</span>
      </label>
      {!off && (
        <>
          {slots.map((slot, i) => (
            <div key={i} className={styles.slotBlock}>
              <div className={styles.slotHeader}>
                <span className={styles.slotNum}>#{i+1}</span>
                {slots.length > 1 && (
                  <button type="button" className={styles.slotRemove} onClick={() => removeSlot(i)}>✕</button>
                )}
              </div>
              <div className={styles.popRow}>
                <span className={styles.popLabel}>場所</span>
                <select className={styles.popSelect} value={slot.workplace} onChange={e => updateSlot(i,"workplace",e.target.value)}>
                  <option value="">— 未選択 —</option>
                  {workplaces.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div className={styles.popRow}>
                <span className={styles.popLabel}>開始</span>
                <select className={styles.popSelect} value={slot.startTime} onChange={e => updateSlot(i,"startTime",e.target.value)}>
                  <option value="">--</option>
                  {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.popRow}>
                <span className={styles.popLabel}>終了</span>
                {slot.last ? (
                  <span className={styles.popLastBadge}>L</span>
                ) : (
                  <select className={styles.popSelect} value={slot.endTime} onChange={e => updateSlot(i,"endTime",e.target.value)}>
                    <option value="">--</option>
                    {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <label className={styles.popRow}>
                <input type="checkbox" checked={slot.last} onChange={e => updateSlot(i,"last",e.target.checked)} className={styles.popCheck}/>
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
    { key: "number",     label: "№" },
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
  const [workplaces, setWorkplaces]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staffDepts, setStaffDepts]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [statusLoading, setStatusLoading] = useState({});
  const [savingCell, setSavingCell]       = useState(null);
  const [openCell, setOpenCell]           = useState(null);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [reportLoading, setReportLoading]   = useState(false);
  const [alertMsg, setAlertMsg]   = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [contextMenu, setContextMenu]   = useState(null);
  const [copiedPattern, setCopiedPattern] = useState(null);
  const reportMenuRef  = useRef();
  const cellAnchorRefs = useRef({});

  const [sortConfig, setSortConfig] = useState({ field:"name", dir:"asc" });
  const [colVisibility, setColVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem("mgrColVisibility");
      return raw ? JSON.parse(raw) : { number: true, position: true, department: true };
    } catch { return { number: true, position: true, department: true }; }
  });
  const [visibleWorkplaces, setVisibleWorkplaces]   = useState(() => loadFilterSet("mgrFilterWp")   || new Set());
  const [visiblePositions, setVisiblePositions]     = useState(() => loadFilterSet("mgrFilterPos")  || new Set());
  const [visibleDepartments, setVisibleDepartments] = useState(() => loadFilterSet("mgrFilterDept") || new Set());
  const [attendanceMap, setAttendanceMap] = useState({}); // "userId_date" → status

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
        if (!pFrom || !pTo || days < 7 || days > 35) {
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

      const [weeks, employees, wps, depts, attRecs] = await Promise.all([
        weeksPromise,
        api.managerEmployeesList(),
        api.settingsWorkplacesList(),
        api.settingsDepartmentsList(),
        api.attendanceRecords(attFrom, attTo).catch(() => []),
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

      const posMap = {}, deptsMap = {};
      employees.forEach(e => {
        posMap[e.id]    = e.position || "";
        deptsMap[e.id]  = (e.departments || []).map(d => d.name);
      });
      setPositions(posMap);
      setStaffDepts(deptsMap);
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

  /* ── close report menu on outside click ── */
  useEffect(() => {
    if (!reportMenuOpen) return;
    function onDown(e) {
      if (reportMenuRef.current && !reportMenuRef.current.contains(e.target))
        setReportMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [reportMenuOpen]);

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
    const allWpKeys = [...workplaceItems.map(i => i.value), ...wpExtraItems.map(i => i.value)];
    if (allWpKeys.length > 0 && visibleWorkplaces.size === 0) return [];
    if (allWpKeys.length === 0) return [...staffByDept].sort(sortFn);
    return staffByDept.filter(s =>
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
  const isFiltered = _f1 || _f2 || _f3 || _f4;

  /* ── handlers ── */
  async function changeStatus(weekStart, newStatus) {
    setStatusLoading(p => ({ ...p, [weekStart]: true }));
    try {
      await api.setWeekStatus(weekStart, newStatus);
      setData(p => ({ ...p, [weekStart]: { ...p[weekStart], status: newStatus } }));
    } catch { alert("ステータスの変更に失敗しました"); }
    finally { setStatusLoading(p => ({ ...p, [weekStart]: false })); }
  }

  async function saveCell(userId, date, patch) {
    const week = findWeekForDate(weeksRaw, date);
    if (!week) return;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d  = new Date(week.weekStart);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const existing = data[week.weekStart]?.staffById?.[userId]?.dayMap?.[ds]
        || { date: ds, off: true, slots: [] };
      days.push(ds === date
        ? { date: ds, off: patch.off, slots: patch.slots }
        : {
            date: ds, off: existing.off,
            slots: (existing.slots || []).map(s => ({
              startTime: s.startTime, endTime: s.endTime, last: s.last, workplace: s.workplace,
            })),
          });
    }
    setSavingCell(`${userId}_${date}`);
    try {
      await api.managerStaffWeekSave(userId, week.weekStart, days);
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
      const byWeek = new Map();
      for (const { userId, date } of selectedCells) {
        const week = findWeekForDate(weeksRaw, date);
        if (!week) continue;
        const key = `${userId}_${week.weekStart}`;
        if (!byWeek.has(key)) byWeek.set(key, { userId, weekStart: week.weekStart, dates: [] });
        byWeek.get(key).dates.push(date);
      }
      for (const { userId, weekStart, dates } of byWeek.values()) {
        const days = [];
        for (let i = 0; i < 7; i++) {
          const d  = new Date(weekStart);
          d.setDate(d.getDate() + i);
          const ds = d.toISOString().slice(0, 10);
          if (dates.includes(ds)) {
            days.push({ date: ds, off: patch.off, slots: patch.slots });
          } else {
            const existing = data[weekStart]?.staffById?.[userId]?.dayMap?.[ds]
              || { date: ds, off: true, slots: [] };
            days.push({
              date: ds, off: existing.off,
              slots: (existing.slots || []).map(s => ({
                startTime: s.startTime, endTime: s.endTime, last: s.last, workplace: s.workplace,
              })),
            });
          }
        }
        await api.managerStaffWeekSave(userId, weekStart, days);
      }
      await load(true);
      setSelectedCells([]);
    } catch (e) {
      setAlertMsg("保存に失敗しました: " + e.message);
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleReport(type) {
    setReportMenuOpen(false);
    setReportLoading(true);
    try {
      if (type === "all") {
        await api.reportShiftAll(ym);
      } else if (type === "timesheet") {
        await api.reportTimesheet(ym);
      } else if (type === "filtered") {
        await api.reportShiftFiltered(ym, filteredStaff.map(s => s.userId));
      } else if (type === "dept") {
        const selectedDepts = [...visibleDepartments];
        if (selectedDepts.length === 0) {
          setAlertMsg("部署を選択してください。");
          setReportLoading(false); return;
        }
        if (selectedDepts.length > 1) {
          setAlertMsg("部署別シフト表は1つの部署のみ選択してください。");
          setReportLoading(false); return;
        }
        await api.reportShiftDept(ym, selectedDepts[0]);
      }
    } catch (e) {
      setAlertMsg("レポートの生成に失敗しました: " + e.message);
    } finally {
      setReportLoading(false);
    }
  }

  /* ── Excel export (по displayDates) ── */
  function exportToExcel() {
    const S = {
      headerMain: { font:{bold:true,color:{rgb:"FFFFFF"},sz:10}, fill:{fgColor:{rgb:"2F5496"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"AAAAAA"}},bottom:{style:"thin",color:{rgb:"AAAAAA"}},left:{style:"thin",color:{rgb:"AAAAAA"}},right:{style:"thin",color:{rgb:"AAAAAA"}}} },
      headerSat:  { font:{bold:true,color:{rgb:"FFFFFF"},sz:10}, fill:{fgColor:{rgb:"4472C4"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"AAAAAA"}},bottom:{style:"thin",color:{rgb:"AAAAAA"}},left:{style:"thin",color:{rgb:"AAAAAA"}},right:{style:"thin",color:{rgb:"AAAAAA"}}} },
      headerSun:  { font:{bold:true,color:{rgb:"FFFFFF"},sz:10}, fill:{fgColor:{rgb:"C0504D"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"AAAAAA"}},bottom:{style:"thin",color:{rgb:"AAAAAA"}},left:{style:"thin",color:{rgb:"AAAAAA"}},right:{style:"thin",color:{rgb:"AAAAAA"}}} },
      cellNormal: { font:{sz:9}, alignment:{vertical:"top",wrapText:true}, border:{top:{style:"thin",color:{rgb:"DDDDDD"}},bottom:{style:"thin",color:{rgb:"DDDDDD"}},left:{style:"thin",color:{rgb:"DDDDDD"}},right:{style:"thin",color:{rgb:"DDDDDD"}}} },
      cellSat:    { font:{sz:9}, fill:{fgColor:{rgb:"EEF3FF"}}, alignment:{vertical:"top",wrapText:true}, border:{top:{style:"thin",color:{rgb:"DDDDDD"}},bottom:{style:"thin",color:{rgb:"DDDDDD"}},left:{style:"thin",color:{rgb:"DDDDDD"}},right:{style:"thin",color:{rgb:"DDDDDD"}}} },
      cellSun:    { font:{sz:9}, fill:{fgColor:{rgb:"FFEEED"}}, alignment:{vertical:"top",wrapText:true}, border:{top:{style:"thin",color:{rgb:"DDDDDD"}},bottom:{style:"thin",color:{rgb:"DDDDDD"}},left:{style:"thin",color:{rgb:"DDDDDD"}},right:{style:"thin",color:{rgb:"DDDDDD"}}} },
      cellOff:    { font:{sz:9,color:{rgb:"CC0000"}}, fill:{fgColor:{rgb:"FFE0E0"}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"DDDDDD"}},bottom:{style:"thin",color:{rgb:"DDDDDD"}},left:{style:"thin",color:{rgb:"DDDDDD"}},right:{style:"thin",color:{rgb:"DDDDDD"}}} },
      cellName:   { font:{bold:true,sz:9}, fill:{fgColor:{rgb:"F5F5F5"}}, alignment:{vertical:"center",wrapText:false}, border:{top:{style:"thin",color:{rgb:"DDDDDD"}},bottom:{style:"thin",color:{rgb:"DDDDDD"}},left:{style:"thin",color:{rgb:"DDDDDD"}},right:{style:"thin",color:{rgb:"DDDDDD"}}} },
      cellMeta:   { font:{sz:9,color:{rgb:"555555"}}, fill:{fgColor:{rgb:"F5F5F5"}}, alignment:{vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"DDDDDD"}},bottom:{style:"thin",color:{rgb:"DDDDDD"}},left:{style:"thin",color:{rgb:"DDDDDD"}},right:{style:"thin",color:{rgb:"DDDDDD"}}} },
    };

    const headerRow = [
      { v: "職種・役職", s: S.headerMain },
      { v: "部署",       s: S.headerMain },
      { v: "氏名",       s: S.headerMain },
    ];
    displayDates.forEach(date => {
      const wd    = new Date(date).getDay();
      const d     = parseInt(date.slice(8), 10);
      const label = `${d}\n${WD_JA[wd]}`;
      headerRow.push({ v: label, s: wd === 6 ? S.headerSat : wd === 0 ? S.headerSun : S.headerMain });
    });

    const dataRows = filteredStaff.map(staff => {
      const row = [
        { v: positions[staff.userId] || "",               s: S.cellMeta },
        { v: (staffDepts[staff.userId] || []).join("、"), s: S.cellMeta },
        { v: staff.userName,                              s: S.cellName },
      ];
      displayDates.forEach(date => {
        const wd  = new Date(date).getDay();
        const day = getDayData(staff.userId, date);
        if (day.off || !day.slots || day.slots.length === 0) {
          row.push({ v: "休", s: S.cellOff }); return;
        }
        const visibleSlots = day.slots.filter(s =>
          s.workplace ? visibleWorkplaces.has(s.workplace) : visibleWorkplaces.has("__none__")
        );
        if (visibleSlots.length === 0) {
          row.push({ v: "", s: wd === 6 ? S.cellSat : wd === 0 ? S.cellSun : S.cellNormal }); return;
        }
        const text = visibleSlots.map(s => {
          const start = formatTime(s.startTime);
          const end   = s.last ? "L" : formatTime(s.endTime);
          const place = s.workplace ? ` ${s.workplace}` : "";
          return `${start}〜${end}${place}`;
        }).join("\n");
        row.push({ v: text, s: wd === 6 ? S.cellSat : wd === 0 ? S.cellSun : S.cellNormal });
      });
      return row;
    });

    const wsData = [headerRow, ...dataRows];
    const ws     = XLSX.utils.aoa_to_sheet(wsData, { cellStyles: true });
    ws["!cols"]  = [{ wch:14 }, { wch:14 }, { wch:14 }, ...displayDates.map(() => ({ wch:13 }))];
    ws["!rows"]  = [{ hpt:30 }, ...dataRows.map(() => ({ hpt:40 }))];
    ws["!freeze"] = { xSplit: 3, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    const sheetName = viewMode === "week"
      ? `週_${selectedWeek}`
      : viewMode === "period"
        ? `期間_${periodFrom}_${periodTo}`
        : `${ym.replace("-","年")}月`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `シフト_${sheetName}.xlsx`);
  }

  /* ── sticky column left values ── */
  function nameLeft() {
    if (!colVisibility.position && !colVisibility.department) return 0;
    if (!colVisibility.position) return 90;
    if (!colVisibility.department) return 70;
    return 160;
  }

  /* ── period validation ── */
  const pDays      = periodDays(periodFrom, periodTo);
  const periodOk   = pDays >= 7 && pDays <= 35;
  const periodWarn = periodFrom && periodTo && !periodOk
    ? (pDays < 7 ? "7日以上を指定してください" : "35日以内を指定してください")
    : null;

  /* ── thead: второй ряд — недели со статусами ── */
  // Вычисляем сколько displayDates приходится на каждую неделю
  const weekColSpans = useMemo(() => {
    return weeksRaw.map(week => {
      const count = displayDates.filter(date => {
        const ws = new Date(week.weekStart);
        const we = new Date(week.weekStart); we.setDate(we.getDate() + 6);
        const d  = new Date(date);
        return d >= ws && d <= we;
      }).length;
      return { week, count };
    }).filter(x => x.count > 0);
  }, [weeksRaw, displayDates]);

  /* ── render ── */
  return (
    <ManagerLayout name={getName()} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        {/* ── TopBar ── */}
        <div className={styles.topBar}>

          {/* Year */}
          <select
            className={styles.monthSelect}
            value={ym.split("-")[0]}
            onChange={e => setYm(`${e.target.value}-${ym.split("-")[1]}`)}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>

          {/* Month */}
          <select
            className={styles.monthSelect}
            value={ym.split("-")[1]}
            onChange={e => setYm(`${ym.split("-")[0]}-${e.target.value}`)}
          >
            {MONTHS_JA.map((label, i) => (
              <option key={i} value={String(i + 1).padStart(2, "0")}>{label}</option>
            ))}
          </select>

          {/* View mode tabs */}
          <div style={{
            display: "flex", borderRadius: 6, overflow: "hidden",
            border: "1px solid #ccc", flexShrink: 0,
          }}>
            {VIEW_MODES.map((m, idx) => (
              <button key={m.value} type="button"
                onClick={() => setViewMode(m.value)}
                style={{
                  padding: "5px 14px", fontSize: 13, border: "none", cursor: "pointer",
                  background: viewMode === m.value ? "#2F5496" : "#fff",
                  color:      viewMode === m.value ? "#fff"    : "#333",
                  borderRight: idx < VIEW_MODES.length - 1 ? "1px solid #ccc" : "none",
                  fontWeight:  viewMode === m.value ? "600" : "normal",
                  transition:  "background 0.15s",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Week selector */}
          {viewMode === "week" && (
            <select
              className={styles.monthSelect}
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
            >
              {weekOptions.map(w => (
                <option key={w.weekStart} value={w.weekStart}>
                  {w.weekStart.slice(5).replace("-","/")} 〜 {w.weekEnd.slice(5).replace("-","/")}
                </option>
              ))}
            </select>
          )}

          {/* Period inputs */}
          {viewMode === "period" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={periodFrom}
                onChange={e => setPeriodFrom(e.target.value)}
                style={{
                  padding: "4px 8px", fontSize: 13, border: "1px solid #ccc",
                  borderRadius: 4, cursor: "pointer",
                  borderColor: periodWarn ? "#cc0000" : "#ccc",
                }}
              />
              <span style={{ fontSize: 13, color: "#666" }}>〜</span>
              <input
                type="date"
                value={periodTo}
                min={periodFrom || undefined}
                onChange={e => setPeriodTo(e.target.value)}
                style={{
                  padding: "4px 8px", fontSize: 13, border: "1px solid #ccc",
                  borderRadius: 4, cursor: "pointer",
                  borderColor: periodWarn ? "#cc0000" : "#ccc",
                }}
              />
              {periodFrom && periodTo && (
                <span style={{ fontSize: 12, color: periodOk ? "#5a8a5a" : "#cc0000", whiteSpace: "nowrap" }}>
                  {pDays}日{periodWarn ? `（${periodWarn}）` : ""}
                </span>
              )}
            </div>
          )}

          {/* Excel button */}
          <button type="button" className={styles.exportBtn}
            onClick={exportToExcel}
            disabled={loading || filteredStaff.length === 0 || displayDates.length === 0}>
            📥 Excel
          </button>

          {/* Report menu */}
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
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)", minWidth: 200, marginTop: 4,
              }}>
                {[
                  { key:"all",       icon:"📋", label:"全員シフト表" },
                  { key:"dept",      icon:"🏢", label:"部署別シフト表" },
                  { key:"timesheet", icon:"🕐", label:"勤怠集計表" },
                  { key:"filtered",  icon:"🔍", label:"選択中スタッフのシフト表" },
                ].map(item => (
                  <button key={item.key} type="button"
                    onClick={() => handleReport(item.key)}
                    style={{ display:"block", width:"100%", padding:"10px 16px",
                      textAlign:"left", border:"none", background:"none",
                      cursor:"pointer", fontSize:13 }}
                    onMouseEnter={e => e.target.style.background = "#f5f5f5"}
                    onMouseLeave={e => e.target.style.background = "none"}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className={styles.topHint}>📅 シフト管理</span>
        </div>

        {/* ── SortBar ── */}
        <SortBar
          sortConfig={sortConfig} onSortChange={setSortConfig}
          colVisibility={colVisibility} onColVisibilityChange={setColVisibility}
          workplaceItems={workplaceItems} wpExtraItems={wpExtraItems}
          visibleWorkplaces={visibleWorkplaces}
          onWpToggle={handleWpToggle} onWpToggleAll={handleWpToggleAll}
          positionItems={positionItems} visiblePositions={visiblePositions}
          onPosToggle={handlePosToggle} onPosToggleAll={handlePosToggleAll}
          departmentItems={departmentItems} visibleDepartments={visibleDepartments}
          onDeptToggle={handleDeptToggle} onDeptToggleAll={handleDeptToggleAll}
          onReset={handleReset} isFiltered={isFiltered}
        />

        {/* ── period warning banner ── */}
        {viewMode === "period" && periodWarn && (
          <div style={{
            padding: "8px 16px", background: "#FFF3CD", borderBottom: "1px solid #FFEAA7",
            fontSize: 13, color: "#856404",
          }}>
            ⚠️ {periodWarn}
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : displayDates.length === 0 ? (
          <div className={styles.loading} style={{ color: "#999" }}>
            {viewMode === "period" ? "期間を正しく設定してください（7〜35日）" : "データがありません"}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                {/* Row 1: week status bars */}
                <tr>
                  <th className={styles.thNameSub} style={!colVisibility.number     ? { display:"none" } : {}}></th>
                  <th className={styles.thNameSub} style={!colVisibility.position   ? { display:"none" } : {}}></th>
                  <th className={`${styles.thNameSub} ${styles.thNameSubPos}`}
                    style={{ ...(!colVisibility.department ? { display:"none" } : {}), ...(!colVisibility.position ? { left:0 } : {}) }}></th>
                  <th className={`${styles.thNameSub} ${styles.thNameSubPos}`}
                    style={{ left: nameLeft() }}></th>
                  
                  {weekColSpans.map(({ week, count }) => {
                    const wkData  = data[week.weekStart] || { status:"RECEIVING" };
                    const sm      = STATUS_META[wkData.status] || STATUS_META.RECEIVING;
                    const isLoad  = !!statusLoading[week.weekStart];
                    const narrow  = count <= 4;
                    return (
                      <th key={week.weekStart} colSpan={count} className={styles.thWeek}>
                        <div className={styles.thWeekInner}>
                          <span className={styles.thWeekRange}>
                            {fmtWeekLabel(week.weekStart, addDays(week.weekStart, 6))}
                          </span>
                          <select
                            className={`${styles.statusSelect} ${styles[`s_${sm.cls}`]}`}
                            value={wkData.status}
                            disabled={isLoad}
                            onChange={e => changeStatus(week.weekStart, e.target.value)}
                            style={narrow ? {
                              color: "transparent",
                              padding: "3px 20px 3px 2px",
                              minWidth: 0,
                              width: "28px",
                              flexShrink: 0,
                            } : {}}
                          >
                            <option value="RECEIVING" style={{ color: "#555555" }}>受付中</option>
                            <option value="DRAFTING"  style={{ color: "#7a6000" }}>作成中</option>
                            <option value="CONFIRMED" style={{ color: "#ffffff" }}>確定</option>
                          </select>
                          {isLoad && <span className={styles.statusSpinner}>…</span>}
                        </div>
                      </th>
                    );
                  })}

                  <th className={styles.thNameSub}></th>
                </tr>

                {/* Row 2: column headers + day headers */}
                <tr>
                  <th className={styles.thNumber}   style={!colVisibility.number     ? { display:"none" } : {}}>№</th>
                  <th className={styles.thPosition} style={!colVisibility.position   ? { display:"none" } : {}}>職種・役職</th>
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

                  <th className={styles.thDay} style={{ minWidth: 44 }}>
                    <span className={styles.thNum}>公休</span>
                    <span className={styles.thWd}>数</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={displayDates.length + 5} className={styles.empty}>
                      {allStaff.length === 0 ? "スタッフが登録されていません" : "該当するスタッフが見つかりません"}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map(staff => {
                    const maxSlots = maxSlotsForStaff(staff.userId);
                    return Array.from({ length: maxSlots }, (_, subIdx) => (
                      <tr key={`${staff.userId}_${subIdx}`} className={styles.staffRow} data-staff={staff.userId}>
                        {subIdx === 0 && (
                          <>
                            <td className={styles.tdNumber} rowSpan={maxSlots}
                              style={!colVisibility.number ? { display:"none" } : {}}>
                              {filteredStaff.indexOf(staff) + 1}
                            </td>
                            <td className={styles.tdPosition} rowSpan={maxSlots}
                              style={!colVisibility.position ? { display:"none" } : {}}>
                              {positions[staff.userId] || ""}
                            </td>
                            <td className={styles.tdDepartment} rowSpan={maxSlots}
                              style={{ ...(!colVisibility.department ? { display:"none" } : {}), ...(!colVisibility.position ? { left:0 } : {}) }}>
                              {(staffDepts[staff.userId] || []).map((d, i) => <div key={i}>{d}</div>)}
                            </td>
                            <td className={styles.tdName} rowSpan={maxSlots}
                              style={{ left: nameLeft() }}>
                              {staff.userName}
                            </td>
                          </>
                        )}

                        {displayDates.map(date => {
                          const day      = getDayData(staff.userId, date);
                          const slots    = day.slots || [];
                          const wd       = new Date(date).getDay();
                          const isWknd   = wd === 0 || wd === 6;
                          // неделя начинается — левая граница ячейки
                          const isWeekStart = weeksRaw.some(w => w.weekStart === date);
                          const isSelected  = selectedCells.some(c => c.userId === staff.userId && c.date === date);
                          const isSaving    = savingCell === `${staff.userId}_${date}`;
                          const isOpen      = openCell?.userId === staff.userId && openCell?.date === date;
                          const attStatus = attendanceMap[`${staff.userId}_${date}`];

                          const cellCls = [
                            styles.cell,
                            isWknd       ? styles.cellWknd      : "",
                            isOpen       ? styles.cellOpen       : "",
                            isWeekStart  ? styles.cellWeekStart  : "",
                            isSelected   ? styles.cellSelected   : "",
                          ].join(" ");

                          if (subIdx === 0) {
                            const key = `${staff.userId}_${date}`;
                            if (!cellAnchorRefs.current[key]) cellAnchorRefs.current[key] = { current: null };
                            const anchorRef = cellAnchorRefs.current[key];

                            return (
                              <td key={date} className={cellCls} rowSpan={maxSlots}
                                style={{ padding:0, verticalAlign:"top", position:"relative" }}>
                                <div className={styles.cellAnchor}
                                  ref={el => { anchorRef.current = el; }}
                                  onClick={e => handleCellClick(e, staff.userId, date, isOpen, isSaving)}
                                  onContextMenu={e => handleContextMenu(e, staff.userId, date)}>

                                  {/* Индикатор посещаемости */}
                                  {attStatus && (
                                    <div style={{
                                      position: "absolute", top: 3, right: 3,
                                      width: 6, height: 6, borderRadius: "50%",
                                      background: attStatus === "finished" ? "#16a34a"
                                                : attStatus === "working"  ? "#2563eb"
                                                : "#d97706",
                                      zIndex: 1,
                                    }} />
                                  )}
                                                                    
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
                                        : visibleWorkplaces.has("__none__"))
                                      .map((s, si) => (
                                        <div key={si} className={styles.slotRow}>
                                          {s.last
                                            ? <span className={styles.cellTime}>{formatTime(s.startTime)}<br/><span className={styles.cellLast}>L</span></span>
                                            : <span className={styles.cellTime}>{formatTime(s.startTime)}<br/>{formatTime(s.endTime)}</span>
                                          }
                                          {s.workplace && <span className={styles.cellWorkplace}>{s.workplace}</span>}
                                        </div>
                                      ))
                                  )}
                                </div>
                                {isOpen && (
                                  <CellPopover
                                    day={day} anchorRef={anchorRef} workplaces={workplaces}
                                    onClose={() => setOpenCell(null)}
                                    onSave={patch => { setOpenCell(null); saveCell(staff.userId, date, patch); }}
                                  />
                                )}
                              </td>
                            );
                          }
                          return null;
                        })}

                        {subIdx === 0 && (
                          <td rowSpan={maxSlots} className={styles.cell}
                            style={{ textAlign:"center", verticalAlign:"middle", fontWeight:"bold", fontSize:13 }}>
                            {countOffDays(staff.userId)}
                          </td>
                        )}
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bulk selection bar ── */}
      {selectedCells.length > 0 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1F4E79", color: "#fff", borderRadius: 12,
          padding: "12px 24px", display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1500,
        }}>
          <span style={{ fontSize: 14 }}>📅 {selectedCells.length}日選択中</span>
          <button
            onClick={() => setBulkOpen(true)}
            disabled={bulkSaving}
            style={{
              background: "#fff", color: "#1F4E79", border: "none",
              borderRadius: 8, padding: "6px 16px", fontSize: 13,
              cursor: "pointer", fontWeight: "bold",
            }}>
            ✏️ 一括編集
          </button>
          <button
            onClick={() => setSelectedCells([])}
            style={{
              background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 8, padding: "6px 16px", fontSize: 13, cursor: "pointer",
            }}>
            ✕ 選択解除
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

      {bulkOpen && (
        <BulkPopover
          workplaces={workplaces}
          onClose={() => setBulkOpen(false)}
          onSave={patch => { setBulkOpen(false); saveBulkCells(patch); }}
        />
      )}

      {reportLoading && <ReportLoader />}
      {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
    </ManagerLayout>
  );
}