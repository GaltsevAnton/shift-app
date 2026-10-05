import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import styles from "./LoggingPage.module.css";

const ENTITY_TYPE_LABELS = {
  SHIFT:        "シフト",
  MONTH_STATUS: "月ステータス",
  EMPLOYEE:     "従業員",
  DEPARTMENT:   "部署",
  WORKPLACE:    "勤務場所",
  POSITION:     "職種・役職",
  BREAK_RULE:   "休憩ルール",
};

const ACTION_LABELS = {
  CREATE: "作成",
  UPDATE: "更新",
  DELETE: "削除",
};
const ACTION_CLASS = { CREATE: "actCreate", UPDATE: "actUpdate", DELETE: "actDelete" };

const PRESETS = [
  { days: 0,  label: "今日" },
  { days: 7,  label: "7日" },
  { days: 30, label: "30日" },
];
const PAGE_SIZES = [10, 20, 50];
const NO_TARGET = "__none__";   // записи без 対象スタッフ (например, 月ステータス)

function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}
function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/* ─── small UI helpers (как в 従業員管理) ─── */
const cx = (...a) => a.filter(Boolean).join(" ");

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
function IcoChart()  { return (<svg {...TB_ICON}><path d="M5 20V14M10 20V9M15 20V12M20 20V5" /></svg>); }
function IcoBell()   { return (<svg {...TB_ICON}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 004 0" /></svg>); }
function IcoGear()   { return (<svg {...TB_ICON}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" /></svg>); }
function IcoUser()   { return (<svg {...TB_ICON}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg>); }
function IcoLogout() { return (<svg {...TB_ICON}><path d="M14 4H7a2 2 0 00-2 2v12a2 2 0 002 2h7" /><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" /></svg>); }
function IcoSearch() { return (<svg {...TB_ICON}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>); }
function IcoPrev()   { return (<svg {...TB_ICON}><path d="M15 6l-6 6 6 6" /></svg>); }
function IcoNext()   { return (<svg {...TB_ICON}><path d="M9 6l6 6-6 6" /></svg>); }

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

// Фильтр с галочками: visibleSet === null → всё; searchable — поле поиска внутри списка
function FilterDropdown({ label, options, visibleSet, onChange, searchable, width = 220 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef();
  useOutsideClose(open, setOpen, ref);

  const allValues = options.map(o => o.value);
  const isOn  = v => visibleSet === null || visibleSet.has(v);
  const onCnt = allValues.filter(isOn).length;
  const allOn = onCnt === allValues.length;
  const shown = q.trim() ? options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;

  function toggle(v) {
    const base = visibleSet === null ? new Set(allValues) : new Set(visibleSet);
    base.has(v) ? base.delete(v) : base.add(v);
    onChange(base.size >= allValues.length ? null : base);
  }
  function toggleAll() {
    onChange(allOn ? new Set() : null);
  }

  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button type="button"
        className={cx(styles.wpDropdownBtn, open && styles.wpDropdownBtnActive, !allOn && styles.wpDropdownBtnFiltered)}
        onClick={() => setOpen(v => !v)}>
        <span>{label}</span>
        {!allOn && <span className={styles.ddValue}>{onCnt === 0 ? "なし" : `${onCnt}件`}</span>}
        <Chevron open={open} />
      </button>
      {open && (
        <div className={styles.wpDropdownPanel} style={{ width }}>
          {searchable && (
            <label className={styles.ddSearch}>
              <IcoSearch />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="氏名で検索..." autoFocus />
            </label>
          )}
          {!q.trim() && (
            <>
              <label className={styles.wpDropdownAll}>
                <input type="checkbox" className={styles.colToggleCheck}
                  checked={allOn}
                  ref={el => { if (el) el.indeterminate = !allOn && onCnt > 0; }}
                  onChange={toggleAll} />
                <span>すべて</span>
              </label>
              <div className={styles.wpDropdownDivider} />
            </>
          )}
          <div className={styles.ddList}>
            {shown.map(o => (
              <label key={o.value} className={styles.wpDropdownItem}>
                <input type="checkbox" className={styles.colToggleCheck}
                  checked={isOn(o.value)} onChange={() => toggle(o.value)} />
                <span className={o.special ? styles.ddSpecial : undefined}>{o.label}</span>
              </label>
            ))}
            {shown.length === 0 && <div className={styles.ddEmpty}>候補がありません</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Номера страниц: 1 … 4 5 6 … 12
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1);
  if (from > 2) out.push("…l");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…r");
  out.push(total);
  return out;
}

export default function LoggingPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const [from, setFrom] = useState(() => daysAgoStr(30));
  const [to, setTo]     = useState(() => todayStr());
  const [visibleTargets, setVisibleTargets] = useState(null);   // null = すべて
  const [visibleTypes, setVisibleTypes]     = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [pageSize, setPageSize] = useState(() => {
    const v = Number(localStorage.getItem("logPageSize"));
    return PAGE_SIZES.includes(v) ? v : 20;
  });
  const [page, setPage] = useState(1);
  useEffect(() => { try { localStorage.setItem("logPageSize", String(pageSize)); } catch { /* ignore */ } }, [pageSize]);

  const periodOk = !from || !to || from <= to;

  // Период → запрос на сервер (сразу при изменении, без кнопки 検索)
  useEffect(() => {
    if (!periodOk) return;
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const data = await api.auditLogSearch({ from: from || undefined, to: to || undefined });
        if (alive) setLogs(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setErr(e.message || "読み込みエラー");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [from, to, periodOk]);

  function applyPreset(days) {
    setFrom(days === 0 ? todayStr() : daysAgoStr(days));
    setTo(todayStr());
  }
  const activePreset = to === todayStr()
    ? PRESETS.find(p => from === (p.days === 0 ? todayStr() : daysAgoStr(p.days)))?.days
    : undefined;

  function handleReset() {
    setFrom(daysAgoStr(30));
    setTo(todayStr());
    setVisibleTargets(null);
    setVisibleTypes(null);
  }
  const isFiltered = visibleTargets !== null || visibleTypes !== null
    || from !== daysAgoStr(30) || to !== todayStr();

  // Варианты фильтров — из загруженных записей
  const targetOptions = useMemo(() => {
    const map = new Map();
    let hasNone = false;
    logs.forEach(l => {
      if (l.targetUserId == null && !l.targetUserName) { hasNone = true; return; }
      const key = String(l.targetUserId ?? l.targetUserName);
      if (!map.has(key)) map.set(key, l.targetUserName || `#${l.targetUserId}`);
    });
    const opts = [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ja"));
    if (hasNone) opts.push({ value: NO_TARGET, label: "対象なし", special: true });
    return opts;
  }, [logs]);

  const typeOptions = useMemo(() => {
    const present = new Set(logs.map(l => l.entityType).filter(Boolean));
    const known = Object.keys(ENTITY_TYPE_LABELS).filter(k => present.has(k));
    const unknown = [...present].filter(k => !ENTITY_TYPE_LABELS[k]);
    return [...known, ...unknown].map(k => ({ value: k, label: ENTITY_TYPE_LABELS[k] || k }));
  }, [logs]);

  const filtered = useMemo(() => logs.filter(l => {
    if (visibleTargets) {
      const key = (l.targetUserId == null && !l.targetUserName) ? NO_TARGET : String(l.targetUserId ?? l.targetUserName);
      if (!visibleTargets.has(key)) return false;
    }
    if (visibleTypes && !visibleTypes.has(l.entityType)) return false;
    return true;
  }), [logs, visibleTargets, visibleTypes]);

  // Пагинация
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage    = Math.min(page, totalPages);
  const pageItems  = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);
  useEffect(() => { setPage(1); setExpandedId(null); }, [from, to, visibleTargets, visibleTypes, pageSize]);

  function parsedDetails(log) {
    if (!log.details) return null;
    try { return JSON.parse(log.details); } catch { return log.details; }
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        {/* ══ Шапка ══ */}
        <div className={styles.headRow}>
          <div className={styles.headTitle}>
            <span className={styles.headIcon}><IcoChart /></span>
            <div>
              <div className={styles.title}>Logging</div>
              <div className={styles.subtitle}>誰が・いつ・何を変更したかの履歴</div>
            </div>
          </div>

          <div className={styles.headActions}>
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
          <div className={styles.period}>
            <input type="date" value={from} max={to || undefined}
              className={cx(styles.dateInput, !periodOk && styles.dateInputWarn)}
              onChange={e => setFrom(e.target.value)} aria-label="開始日" />
            <span className={styles.tilde}>〜</span>
            <input type="date" value={to} min={from || undefined}
              className={cx(styles.dateInput, !periodOk && styles.dateInputWarn)}
              onChange={e => setTo(e.target.value)} aria-label="終了日" />
          </div>

          <div className={styles.segment}>
            {PRESETS.map(p => (
              <button key={p.days} type="button"
                className={cx(styles.segBtn, activePreset === p.days && styles.segBtnGreen)}
                onClick={() => applyPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>

          <FilterDropdown label="対象スタッフ" options={targetOptions} visibleSet={visibleTargets}
            onChange={setVisibleTargets} searchable width={250} />
          <FilterDropdown label="種類" options={typeOptions} visibleSet={visibleTypes}
            onChange={setVisibleTypes} />

          {isFiltered && (
            <button type="button" className={styles.resetBtn} onClick={handleReset}>リセット</button>
          )}

          <span className={styles.countText}>
            {loading ? "読み込み中..." : <><b>{filtered.length}</b> 件</>}
          </span>
        </div>

        {!periodOk && <div className={styles.warnBar}>⚠️ 開始日は終了日より前の日付を指定してください</div>}
        {err && <div className={styles.errBar}>{err}</div>}

        {/* ══ Таблица ══ */}
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={cx(styles.th, styles.colDate)}>日時</th>
                  <th className={cx(styles.th, styles.colAct)}>操作</th>
                  <th className={cx(styles.th, styles.colType)}>種類</th>
                  <th className={cx(styles.th, styles.colTarget)}>対象スタッフ</th>
                  <th className={styles.th}>内容</th>
                  <th className={cx(styles.th, styles.colActor)}>実行者</th>
                  <th className={cx(styles.th, styles.colDetail)}>詳細</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(log => {
                  const open = expandedId === log.id;
                  const details = open ? parsedDetails(log) : null;
                  return [
                    <tr key={log.id} className={cx(styles.row, open && styles.rowOpen)}>
                      <td className={cx(styles.td, styles.tdDate)}>{fmtDateTime(log.createdAt)}</td>
                      <td className={styles.td}>
                        <span className={cx(styles.badge, styles[ACTION_CLASS[log.action] || "actOther"])}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.chipType}>{ENTITY_TYPE_LABELS[log.entityType] || log.entityType}</span>
                      </td>
                      <td className={styles.td}>
                        {log.targetUserName
                          ? <span className={styles.target}>{log.targetUserName}</span>
                          : <span className={styles.dash}>—</span>}
                      </td>
                      <td className={cx(styles.td, styles.tdSummary)}>{log.summary}</td>
                      <td className={cx(styles.td, styles.tdActor)}>{log.actorName}</td>
                      <td className={cx(styles.td, styles.colDetail)}>
                        {log.details && (
                          <button type="button" className={cx(styles.detailBtn, open && styles.detailBtnOpen)}
                            onClick={() => setExpandedId(open ? null : log.id)}>
                            {open ? "閉じる" : "詳細"}
                            <Chevron open={open} />
                          </button>
                        )}
                      </td>
                    </tr>,
                    open && (
                      <tr key={`${log.id}-d`} className={styles.detailRow}>
                        <td colSpan={7} className={styles.detailTd}>
                          <pre className={styles.detailPre}>
                            {typeof details === "string" ? details : JSON.stringify(details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ),
                  ];
                })}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className={styles.empty}>該当する履歴がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ══ Пагинация ══ */}
          <div className={styles.pager}>
            <label className={styles.pageSize}>
              <select className={styles.pageSizeSelect} value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>件を表示</span>
            </label>

            <div className={styles.pages}>
              <button type="button" className={styles.pageBtn} disabled={curPage <= 1}
                onClick={() => setPage(curPage - 1)} aria-label="前のページ"><IcoPrev /></button>
              {pageList(curPage, totalPages).map(p => typeof p === "number" ? (
                <button key={p} type="button"
                  className={cx(styles.pageBtn, p === curPage && styles.pageBtnActive)}
                  onClick={() => setPage(p)}>{p}</button>
              ) : (
                <span key={p} className={styles.pageGap}>…</span>
              ))}
              <button type="button" className={styles.pageBtn} disabled={curPage >= totalPages}
                onClick={() => setPage(curPage + 1)} aria-label="次のページ"><IcoNext /></button>
            </div>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}