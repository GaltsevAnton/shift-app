import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../shared/api/api";
import styles from "./StaffMonth.module.css";

/* ─── constants ─────────────────────────────────────────── */
const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

// Статусы половин месяца: цвет точки, текст и подсказка (всплывающее окно по тапу)
const STATUS_INFO = {
  RECEIVING: { label: "受付中", dot: "#9aaabb", color: "#64748b", text: "希望シフトを提出・変更できます" },
  DRAFTING:  { label: "作成中", dot: "#f5a524", color: "#e08a00", text: "マネージャーがシフトを作成中です。変更はできません" },
  CONFIRMED: { label: "確定",   dot: "#1a8a5f", color: "#1a8a5f", text: "シフトが確定しました。変更はできません" },
};

const DEADLINE = {
  1: "前月20日までに提出してください",
  2: "当月5日までに提出してください",
};

const ITEM_H = 44; // высота строки в барабане выбора времени

/* ─── helpers ───────────────────────────────────────────── */
const cx = (...a) => a.filter(Boolean).join(" ");
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
function weekdayOf(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay();
}
function halfOf(dateStr) {
  return new Date(dateStr + "T00:00:00").getDate() <= 15 ? 1 : 2;
}
function fmtDay(dateStr) {
  return `${dateStr.slice(5).replace("-", "/")}（${JP_WD[weekdayOf(dateStr)]}）`;
}
function normTime(t) {
  return t ? String(t).slice(0, 5) : "";
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

// Снимок для отслеживания несохранённых изменений
function serialize(days) {
  return JSON.stringify(days.map(d => [d.date, !!d.off, d.startTime, d.endTime]));
}

/* ─── icons ─────────────────────────────────────────────── */
function CalendarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="14" r="1.1" fill="currentColor" /><circle cx="12" cy="14" r="1.1" fill="currentColor" />
      <circle cx="16" cy="14" r="1.1" fill="currentColor" /><circle cx="8" cy="17.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="17.5" r="1.1" fill="currentColor" /><circle cx="16" cy="17.5" r="1.1" fill="currentColor" />
    </svg>
  );
}
function ChevronDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ClockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WarnIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3L2 20h20L12 3z" fill="#f5a524" />
      <path d="M12 9v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="#fff" />
    </svg>
  );
}
function LockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function MenuIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function LogoutIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4H7a2 2 0 00-2 2v12a2 2 0 002 2h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── TimeButton: поле времени, открывает шторку выбора ──── */
function TimeButton({ value, disabled, onClick, large, withIcon }) {
  return (
    <button
      type="button"
      className={cx(styles.timeBtn, large && styles.timeBtnLg, !value && styles.timeBtnEmpty)}
      disabled={disabled}
      onClick={onClick}
    >
      {withIcon && <ClockIcon className={styles.timeBtnClock} />}
      <span className={styles.timeBtnValue}>{value || "--:--"}</span>
      <ChevronDown className={styles.timeBtnChev} />
    </button>
  );
}

/* ─── TimeSheet: нижняя шторка с барабаном выбора времени ──
   Барабан «бесконечный»: список повторяется LOOPS раз, открываемся на средней копии,
   а после остановки прокрутки незаметно возвращаемся в середину на то же время */
   const LOOPS = 7;
   const MID   = Math.floor(LOOPS / 2);
   
   function TimeSheet({ title, value, options, onCancel, onConfirm }) {
     const len       = options.length;
     const listRef   = useRef(null);
     const idleTimer = useRef(null);
     const startIdx  = MID * len + Math.max(0, options.indexOf(value));
   
     const [idx, setIdx]         = useState(startIdx);
     const [closing, setClosing] = useState(false);
   
     const items = useMemo(
       () => Array.from({ length: len * LOOPS }, (_, i) => options[i % len]),
       [options, len],
     );
   
     // Сразу прокручиваем к текущему значению (до первой отрисовки, без «прыжка»)
     useLayoutEffect(() => {
       if (listRef.current) listRef.current.scrollTop = startIdx * ITEM_H;
     }, []); // eslint-disable-line react-hooks/exhaustive-deps
   
     // Блокируем прокрутку страницы под шторкой
     useEffect(() => {
       const prev = document.body.style.overflow;
       document.body.style.overflow = "hidden";
       return () => {
         document.body.style.overflow = prev;
         clearTimeout(idleTimer.current);
       };
     }, []);
   
     // После остановки — переносим позицию в среднюю копию (то же время, визуально ничего не меняется)
     function recenter() {
       const el = listRef.current;
       if (!el) return;
       const i = Math.round(el.scrollTop / ITEM_H);
       if (Math.floor(i / len) === MID) return;
       const target = MID * len + (((i % len) + len) % len);
       el.scrollTop = target * ITEM_H;
       setIdx(target);
     }
   
     function onScroll() {
       const el = listRef.current;
       if (!el) return;
       const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
       setIdx(i);
       clearTimeout(idleTimer.current);
       idleTimer.current = setTimeout(recenter, 150);
     }
   
     function close(after) {
       if (closing) return;
       setClosing(true);
       setTimeout(after, 200);
     }
   
     return (
       <div className={cx(styles.sheetOverlay, closing && styles.sheetOverlayOut)} onClick={() => close(onCancel)}>
         <div
           className={cx(styles.sheet, closing && styles.sheetOut)}
           role="dialog"
           aria-label={title}
           onClick={e => e.stopPropagation()}
         >
           <div className={styles.sheetHead}>
             <span className={styles.sheetTitle}>{title}</span>
             <button type="button" className={styles.sheetX} aria-label="閉じる" onClick={() => close(onCancel)}>
               <XIcon />
             </button>
           </div>
   
           <div className={styles.wheelWrap}>
             <div className={styles.wheelBand} />
             <div ref={listRef} className={styles.wheel} onScroll={onScroll}>
               <div style={{ height: ITEM_H * 2 }} />
               {items.map((t, i) => (
                 <div
                   key={i}
                   className={styles.wheelItem}
                   data-dist={Math.min(Math.abs(i - idx), 3)}
                   onClick={() => listRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })}
                 >
                   {t}
                 </div>
               ))}
               <div style={{ height: ITEM_H * 2 }} />
             </div>
           </div>
   
           <div className={styles.sheetBtns}>
             <button type="button" className={styles.sheetCancel} onClick={() => close(onCancel)}>キャンセル</button>
             <button type="button" className={styles.sheetOk} onClick={() => close(() => onConfirm(options[idx % len]))}>決定</button>
           </div>
         </div>
       </div>
     );
   }

/* ─── StaffMonth ────────────────────────────────────────── */
export default function StaffMonth({ onLogout, embedded = false }) {
  const monthOptions = useMemo(() => build5Months(), []);
  const name = localStorage.getItem("staffName") || "";

  // Месяц не выбран — всегда начинаем со стартового экрана
  const [month, setMonth]           = useState("");
  const [monthOpen, setMonthOpen]   = useState(false);
  const [activeHalf, setActiveHalf] = useState(1);
  const [status1, setStatus1]       = useState(null);
  const [status2, setStatus2]       = useState(null);
  const [days, setDays]             = useState([]);
  const [snapshot, setSnapshot]     = useState("[]");
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState(null);
  const [savedOverlay, setSavedOverlay] = useState(false);
  const [fillStart, setFillStart]   = useState("10:00");
  const [fillEnd, setFillEnd]       = useState("21:00");
  const [lastFill, setLastFill]     = useState(null);   // { half, kind } — подсветка последней кнопки быстрого заполнения
  const [tip, setTip]               = useState(null);   // 1 | 2 — открытая подсказка статуса
  const [picker, setPicker]         = useState(null);   // { title, value, onPick }
  const [menuOpen, setMenuOpen]     = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(null); // { type: "month", ym } | { type: "logout" }
  const [errorDate, setErrorDate]       = useState(null); // день с ошибкой — подсветка строки
  const [errorTip, setErrorTip]         = useState(null); // текст подсказки под строкой с ошибкой
  const errorTipTimer = useRef(null);

  const savedTimer = useRef(null);
  const loadSeq    = useRef(0);

  const compact    = !!month;
  const statusOf   = h => (h === 1 ? status1 : status2);
  const editableOf = h => statusOf(h) === "RECEIVING";
  const dirty      = useMemo(() => serialize(days) !== snapshot, [days, snapshot]);

  /* ── закрытие выпадающих элементов по тапу мимо ── */
  useEffect(() => {
    function onDown(e) {
      if (e.target.closest?.("[data-keep-open]")) return;
      setMonthOpen(false);
      setTip(null);
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  /* ── цвет системной полосы телефона (часы/сеть/батарея) = цвет шапки ── */
  useEffect(() => {
    if (embedded) return;
    const COLOR = "#0d2c4a";
    let metas = [...document.querySelectorAll('meta[name="theme-color"]')];
    let created = false;
    if (metas.length === 0) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      metas = [m];
      created = true;
    }
    const prev = metas.map(m => m.getAttribute("content"));
    metas.forEach(m => m.setAttribute("content", COLOR));
    return () => {
      if (created) metas.forEach(m => m.remove());
      else metas.forEach((m, i) => m.setAttribute("content", prev[i]));
    };
  }, [embedded]);

  /* ── предупреждение браузера при закрытии вкладки с несохранёнными изменениями ── */
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e) { e.preventDefault(); e.returnValue = ""; }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => () => {
    clearTimeout(savedTimer.current);
    clearTimeout(errorTipTimer.current);
  }, []);

  /* ── загрузка месяца ── */
  async function load(ym) {
    const seq = ++loadSeq.current;
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.staffMonth(ym);
      if (seq !== loadSeq.current) return; // пришёл ответ на уже неактуальный месяц
      const list = (res.days || []).map(d => ({
        date:      d.date,
        off:       !!d.off,
        startTime: normTime(d.startTime),
        endTime:   normTime(d.endTime),
        last:      !!d.last,
      }));
      setStatus1(res.status1);
      setStatus2(res.status2);
      setDays(list);
      setSnapshot(serialize(list));
      // Если первая половина уже закрыта, а вторая принимается — сразу открываем вторую
      setActiveHalf(res.status1 !== "RECEIVING" && res.status2 === "RECEIVING" ? 2 : 1);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setDays([]);
      setSnapshot("[]");
      setMsg(e.message || String(e));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  function goToMonth(ym) {
    setMonth(ym);
    setTip(null);
    setLastFill(null);
    load(ym);
  }

  function selectMonth(ym) {
    setMonthOpen(false);
    if (ym === month) return;
    if (dirty) { setLeaveConfirm({ type: "month", ym }); return; }
    goToMonth(ym);
  }

  function handleLogout() {
    setMenuOpen(false);
    if (dirty) { setLeaveConfirm({ type: "logout" }); return; }
    onLogout?.();
  }

  // Окно «変更が保存されていません»: saveFirst=false — キャンセル (уходим без сохранения), true — 保存する
  async function confirmLeave(saveFirst) {
    const action = leaveConfirm;
    if (!action || saving) return;
    if (saveFirst) {
      const ok = await save({ silent: true });
      if (!ok) { setLeaveConfirm(null); return; } // ошибка — остаёмся, сообщение уже показано
    }
    setLeaveConfirm(null);
    if (action.type === "month") goToMonth(action.ym);
    else onLogout?.();
  }

  /* ── редактирование ── */
  function updateDay(date, patch) {
    setDays(prev => prev.map(d => {
      if (d.date !== date) return d;
      // edited — день трогали вручную (снимали 休, меняли время): для такого дня время обязательно
      const n = { ...d, ...patch, edited: true };
      if (n.off) { n.startTime = ""; n.endTime = ""; }
      return n;
    }));
    if (errorDate === date) {
      setErrorDate(null);
      setErrorTip(null);
    }
  }

  function applyFill(kind) {
    if (!editableOf(activeHalf)) return;
    setDays(prev => prev.map(d => {
      if (halfOf(d.date) !== activeHalf) return d;
      if (kind === "none") return { ...d, off: true, startTime: "", endTime: "" };
      if (kind === "weekdays") {
        const wd = weekdayOf(d.date);
        if (wd === 0 || wd === 6) return { ...d, off: true, startTime: "", endTime: "" };
      }
      return { ...d, off: false, startTime: fillStart, endTime: fillEnd };
    }));
    setLastFill({ half: activeHalf, kind });
  }

  function openPicker(title, value, onPick) {
    setPicker({ title, value, onPick });
  }

  /* ── сохранение ── */
  // Возвращает true при успехе. silent — без окна «保存しました» (сохранение перед переходом)
  async function save({ silent = false } = {}) {
    if (saving || !month) return false;
    setMsg(null);

    for (const d of days) {
      const h = halfOf(d.date);
      if (!editableOf(h) || d.off) continue;

      const partial = (d.startTime || d.endTime) && (!d.startTime || !d.endTime);
      const empty   = !d.startTime && !d.endTime && d.edited; // сняли 休, но время не указали

      if (partial || empty) {
        setActiveHalf(h);
        setErrorDate(d.date);
        setErrorTip(empty
          ? "時間を選択するか、「休」にチェックを入れてください"
          : "開始・終了時間を両方選択してください");
        clearTimeout(errorTipTimer.current);
        errorTipTimer.current = setTimeout(() => setErrorTip(null), 5000);
        // Прокручиваем к строке с ошибкой (после переключения вкладки и отрисовки)
        setTimeout(() => {
          document.querySelector(`[data-date="${d.date}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return false;
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
      setSnapshot(serialize(days));
      if (!silent) {
        setSavedOverlay(true);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedOverlay(false), 2500);
      }
      return true;
    } catch (e) {
      setMsg(e.message || String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  /* ── derived ── */
  const halfDays     = days.filter(d => halfOf(d.date) === activeHalf);
  const activeStatus = statusOf(activeHalf);
  const editable     = editableOf(activeHalf);
  const canSave      = !!month && !loading && !saving && (editableOf(1) || editableOf(2));

  const FILL_BUTTONS = [
    { kind: "all",      label: "全日程" },
    { kind: "weekdays", label: "平日のみ" },
    { kind: "none",     label: "全て休み" },
  ];

  /* ── render ── */
  return (
    <div className={cx(styles.page, embedded && styles.pageEmbedded)}>

      {/* ── App bar ── */}
      {!embedded && (
        <header className={styles.appBar}>
          <div className={styles.menuWrap} data-keep-open>
            <button type="button" className={styles.iconBtn} aria-label="メニュー" onClick={() => setMenuOpen(v => !v)}>
              <MenuIcon className={styles.icon24} />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                <div className={styles.menuUser}>{name}</div>
                <div className={cx(styles.menuItem, styles.menuItemActive)}>
                  <CalendarIcon className={styles.icon18} />希望シフト提出
                </div>
                <button type="button" className={styles.menuItem} onClick={handleLogout}>
                  <LogoutIcon className={styles.icon18} />ログアウト
                </button>
              </div>
            )}
          </div>

          <div className={styles.appTitle}>
            <div className={styles.appName}>HannoSHIFT</div>
            <div className={styles.appUser}>{name}</div>
          </div>

          <button type="button" className={styles.iconBtn} aria-label="ログアウト" onClick={handleLogout}>
            <LogoutIcon className={styles.icon24} />
          </button>
        </header>
      )}

      <div className={styles.scroller}>
      <main className={styles.content}>

        {/* ── Hero: заголовок + выбор месяца (после выбора — сжимается в одну строку) ── */}
        <div className={cx(styles.hero, compact && styles.heroCompact)}>
          <div className={styles.heroTitle}>
            <CalendarIcon className={styles.heroIcon} />
            <h1 className={styles.heroText}>希望シフト提出</h1>
          </div>
          <p className={styles.heroSub}>希望する出勤日と時間を設定してください</p>

          <div className={styles.monthPicker} data-keep-open>
            <button
              type="button"
              className={styles.monthBtn}
              onClick={() => setMonthOpen(v => !v)}
              disabled={saving}
              aria-haspopup="listbox"
              aria-expanded={monthOpen}
            >
              <span className={cx(styles.monthValue, !month && styles.monthPlaceholder)}>
                {month ? monthLabelJa(month) : "— 年 — 月"}
              </span>
              <ChevronDown className={cx(styles.monthChev, monthOpen && styles.monthChevOpen)} />
            </button>

            {monthOpen && (
              <ul className={styles.monthList} role="listbox">
                {monthOptions.map(ym => (
                  <li key={ym}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={ym === month}
                      className={cx(styles.monthOption, ym === month && styles.monthOptionActive)}
                      onClick={() => selectMonth(ym)}
                    >
                      <span>{monthLabelJa(ym)}</span>
                      {ym === month && <CheckIcon className={styles.icon18} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs} role="tablist">
          {[1, 2].map(h => {
            const st   = month && !loading ? statusOf(h) : null;
            const info = st ? STATUS_INFO[st] : null;
            return (
              <div
                key={h}
                role="tab"
                aria-selected={activeHalf === h}
                className={cx(styles.tab, activeHalf === h && styles.tabActive, !month && styles.tabDisabled)}
                onClick={() => { if (month) { setActiveHalf(h); setMsg(null); setErrorTip(null); } }}
              >
                <span className={styles.tabLabel}>{h === 1 ? "1日〜15日" : "16日〜末日"}</span>

                {info && (
                  <span className={styles.statusWrap} data-keep-open>
                    <button
                      type="button"
                      className={styles.statusBtn}
                      onClick={e => { e.stopPropagation(); setTip(t => (t === h ? null : h)); }}
                      aria-label={`${info.label}の説明`}
                    >
                      <span className={styles.dot} style={{ background: info.dot }} />
                      <span style={{ color: info.color }}>{info.label}</span>
                    </button>
                    {tip === h && (
                      <div className={cx(styles.tip, h === 2 && styles.tipRight)} role="tooltip">
                        <div className={styles.tipTitle}>
                          <span className={styles.tipDot} style={{ background: info.dot }} />
                          {info.label}
                        </div>
                        <div className={styles.tipText}>{info.text}</div>
                      </div>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Panel ── */}
        <section className={styles.panel}>
          {!month ? (
            <div className={styles.empty}>
              <CalendarIcon className={styles.emptyIcon} />
              <div>月を選択してください</div>
            </div>
          ) : loading ? (
            <div className={styles.skeletons}>
              {Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : (
            <div className={styles.panelBody} key={`${month}-${activeHalf}`}>
              {msg && <div className={styles.error}>{msg}</div>}

              {/* Баннер по статусу */}
              {activeStatus === "RECEIVING" && (
                <div className={cx(styles.banner, styles.bannerWarn)}>
                  <WarnIcon className={styles.icon18} />
                  {DEADLINE[activeHalf]}
                </div>
              )}
              {activeStatus === "DRAFTING" && (
                <div className={cx(styles.banner, styles.bannerDraft)}>
                  <LockIcon className={styles.icon18} />
                  シフト作成中のため、この期間は変更できません
                </div>
              )}
              {activeStatus === "CONFIRMED" && (
                <div className={cx(styles.banner, styles.bannerOk)}>
                  <span className={styles.bannerOkIcon}><CheckIcon /></span>
                  <div>
                    この期間はすでに確定しています
                    <div className={styles.bannerSub}>都合が悪い場合は必ず店長に連絡をお願いします。</div>
                  </div>
                </div>
              )}

              {days.length > 0 && (
                <>
                  {/* Быстрое заполнение */}
                  <div className={styles.fill}>
                    <div className={cx(styles.rangePill, !editable && styles.rangePillDisabled)}>
                      <ClockIcon className={styles.rangeClock} />
                      <TimeButton
                        large
                        value={fillStart}
                        disabled={!editable}
                        onClick={() => openPicker("開始時間を選択", fillStart, setFillStart)}
                      />
                      <span className={styles.tilde}>〜</span>
                      <TimeButton
                        large
                        value={fillEnd}
                        disabled={!editable}
                        onClick={() => openPicker("終了時間を選択", fillEnd, setFillEnd)}
                      />
                    </div>
                    <div className={styles.fillBtns}>
                      {FILL_BUTTONS.map(b => (
                        <button
                          key={b.kind}
                          type="button"
                          disabled={!editable}
                          className={cx(
                            styles.fillBtn,
                            lastFill?.half === activeHalf && lastFill?.kind === b.kind && styles.fillBtnActive,
                          )}
                          onClick={() => applyFill(b.kind)}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Таблица дней */}
                  <div className={styles.table}>
                    <div className={styles.thead}>
                      <span>日付</span>
                      <span className={styles.thCenter}>休</span>
                      <span>時間（希望）</span>
                    </div>

                    {halfDays.map(d => {
                      const wd  = weekdayOf(d.date);
                      const dur = calcDuration(d.startTime, d.endTime);
                      let note = null;
                      if (!d.off && d.startTime && d.endTime) {
                        if (dur > 16 * 60)                 note = <div className={styles.warn}>※ 長すぎます（最大16時間）</div>;
                        else if (dur < 30)                 note = <div className={styles.warn}>※ 短すぎます（30分以上）</div>;
                        else if (d.endTime <= d.startTime) note = <div className={styles.note}>※ 翌日まで（夜勤）</div>;
                      }
                      return (
                        <div
                          key={d.date}
                          data-date={d.date}
                          className={cx(styles.row, d.off && styles.rowOff, errorDate === d.date && styles.rowError)}
                        >
                          <span className={cx(styles.date, (wd === 0 || wd === 6) && styles.dateWeekend)}>
                            {fmtDay(d.date)}
                          </span>

                          <span className={styles.offCell}>
                            <button
                              type="button"
                              className={cx(styles.offBtn, d.off && styles.offBtnOn)}
                              disabled={!editable}
                              aria-pressed={d.off}
                              aria-label="休み"
                              onClick={() => updateDay(d.date, { off: !d.off })}
                            >
                              {d.off && <CheckIcon />}
                            </button>
                          </span>

                          <div className={styles.times}>
                            <div className={styles.timeRow}>
                              <TimeButton
                                withIcon
                                value={d.startTime}
                                disabled={!editable || d.off}
                                onClick={() => openPicker(
                                  "開始時間を選択",
                                  d.startTime || fillStart,
                                  v => updateDay(d.date, { startTime: v, off: false }),
                                )}
                              />
                              <span className={styles.tilde}>〜</span>
                              {d.last ? (
                                <span className={styles.lastBadge}>L</span>
                              ) : (
                                <TimeButton
                                  value={d.endTime}
                                  disabled={!editable || d.off}
                                  onClick={() => openPicker(
                                    "終了時間を選択",
                                    d.endTime || fillEnd,
                                    v => updateDay(d.date, { endTime: v, off: false }),
                                  )}
                                />
                              )}
                              </div>
                              {note}
                            </div>
  
                            {errorDate === d.date && errorTip && (
                              <div className={styles.rowTip} role="alert">
                                <WarnIcon className={styles.rowTipIcon} />
                                {errorTip}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Сообщение о сохранении */}
          {savedOverlay && (
            <div className={styles.saved} onClick={() => setSavedOverlay(false)}>
              <div className={styles.savedCheck}><CheckIcon /></div>
              <div className={styles.savedTitle}>保存しました</div>
              <div className={styles.savedText}>マネージャーの確認をお待ちください。</div>
            </div>
          )}
        </section>
        </main>
      </div>

      {/* ── Save bar ── */}
      <div className={styles.saveBar}>
        <button type="button" className={styles.saveBtn} onClick={save} disabled={!canSave}>
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>

      {/* ── Несохранённые изменения ── */}
      {leaveConfirm && (
        <div className={styles.confirmOverlay} onClick={() => !saving && setLeaveConfirm(null)}>
          <div
            className={styles.confirmCard}
            role="alertdialog"
            aria-labelledby="leave-title"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.confirmX}
              aria-label="閉じる"
              disabled={saving}
              onClick={() => setLeaveConfirm(null)}
            >
              <XIcon />
            </button>
            <div className={styles.confirmIcon}><WarnIcon /></div>
            <div id="leave-title" className={styles.confirmTitle}>変更が保存されていません</div>
            <div className={styles.confirmText}>
              {leaveConfirm.type === "month"
                ? "保存せずに月を切り替えると、入力した内容は失われます。"
                : "保存せずにログアウトすると、入力した内容は失われます。"}
            </div>
            <div className={styles.confirmBtns}>
              <button type="button" className={styles.sheetCancel} disabled={saving} onClick={() => confirmLeave(false)}>
                キャンセル
              </button>
              <button type="button" className={styles.sheetOk} disabled={saving} onClick={() => confirmLeave(true)}>
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Time picker ── */}
      {picker && (
        <TimeSheet
          title={picker.title}
          value={picker.value}
          options={TIME_OPTIONS}
          onCancel={() => setPicker(null)}
          onConfirm={v => { picker.onPick(v); setPicker(null); }}
        />
      )}
    </div>
  );
}