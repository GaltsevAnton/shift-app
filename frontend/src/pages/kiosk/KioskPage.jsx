import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import styles from "./KioskPage.module.css";

const API_BASE = import.meta.env.VITE_API_BASE;
const RESTAURANT_ID = 1;
const TOKEN_KEY = "kioskToken";

/* ─── Token helpers ─────────────────────────────────────── */
function getKioskToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setKioskToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearKioskToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/* ─── API ───────────────────────────────────────────────── */
const CONNECTION_RETRY_COUNT    = 3;
const CONNECTION_RETRY_DELAY_MS = 5000;
const FETCH_TIMEOUT_MS          = 8000;
const PUNCH_TIMEOUT_MS          = 10000;

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const bustedUrl = url + (url.includes("?") ? "&" : "?") + "_ts=" + Date.now();
  try {
    return await fetch(bustedUrl, { ...options, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkError(e) {
  return e instanceof TypeError || e.name === "AbortError";
}

function friendlyPunchError(e) {
  if (isNetworkError(e)) {
    return "ネットワークに接続できません。時間をおいてもう一度お試しください。改善しない場合は担当者にご連絡ください。";
  }
  return e.message;
}

async function loginKiosk(login, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "ログインに失敗しました");
  }
  return res.json();
}

function authHeaders() {
  const token = getKioskToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

async function fetchStaff() {
  const res = await fetchWithTimeout(`${API_BASE}/api/kiosk/staff?restaurantId=${RESTAURANT_ID}`, {
    headers: authHeaders(),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("Failed to load staff");
  return res.json();
}

async function fetchOneStatus(userId) {
  const res = await fetchWithTimeout(`${API_BASE}/api/kiosk/status/${userId}`, {
    headers: authHeaders(),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("Failed to load status");
  return res.json();
}

/* Статусы всех сотрудников ОДНИМ запросом (новый эндпоинт GET /api/kiosk/statuses).
   Ответ: { [userId]: StaffStatusResponse }.
   Возвращает null, если сервер его ещё не поддерживает или ответил ошибкой —
   тогда используется старый способ (fetchStatusesEach). Поэтому фронт можно
   выкладывать раньше сервера: ничего не сломается. */
let batchStatusesUnsupported = false;

async function fetchStatusesBatch() {
  if (batchStatusesUnsupported) return null;
  const res = await fetchWithTimeout(`${API_BASE}/api/kiosk/statuses?restaurantId=${RESTAURANT_ID}`, {
    headers: authHeaders(),
  });
  if (res.status === 404 || res.status === 405) {   // эндпоинта ещё нет — больше не пробуем до перезагрузки
    batchStatusesUnsupported = true;
    return null;
  }
  if (!res.ok) return null;                          // 401/403/5xx — пробуем старым способом
  return res.json();
}

/* Старый способ: по одному запросу на каждого сотрудника.
   Если по кому-то запрос не удался — оставляем его прежний статус (а не «не пришёл»).
   Если не удались все — считаем, что нет связи. */
async function fetchStatusesEach(staffList, prevMap) {
  let failed = 0;
  let lastError = null;
  const entries = await Promise.all(
    staffList.map(s =>
      fetchOneStatus(s.id)
        .catch(e => {
          if (e.message === "UNAUTHORIZED") throw e;
          failed += 1;
          lastError = e;
          return prevMap?.[s.id] || { status: "NOT_STARTED" };
        })
        .then(status => [s.id, status])
    )
  );
  if (staffList.length > 0 && failed === staffList.length) throw lastError;
  return Object.fromEntries(entries);
}

async function punchApi(userId, recordType, photoBase64) {
  const res = await fetchWithTimeout(`${API_BASE}/api/kiosk/punch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userId, recordType, photoBase64 }),
  }, PUNCH_TIMEOUT_MS);
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to punch");
  }
  return res.json();
}

/* ─── Helpers ───────────────────────────────────────────── */
// Форматтеры создаём один раз (дешевле, чем toLocaleTimeString на каждый вызов; результат тот же)
const FMT_HM  = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
const FMT_HMS = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo" });

function formatTime(instant) {
  if (!instant) return "--:--";
  const d = new Date(instant);
  return isNaN(d) ? "--:--" : FMT_HMS.format(d);
}
function formatTimeShort(instant) {
  if (!instant) return "--:--";
  const d = new Date(instant);
  return isNaN(d) ? "--:--" : FMT_HM.format(d);
}
function formatJpDate(now) {
  const WD = ["日","月","火","水","木","金","土"];
  const t = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${m}月${d}日（${WD[t.getDay()]}）`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}

/* Текущее время, которое обновляется ровно на границе секунды (stepMs=1000) или минуты (60000).
   Используется только внутри маленьких компонентов часов — остальной экран не перерисовывается.
   При возврате из фона время сразу пересчитывается. */
function useNow(stepMs) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = null;
    function schedule() {
      timer = setTimeout(tick, stepMs - (Date.now() % stepMs) + 20);
    }
    function tick() {
      setNow(new Date());
      schedule();
    }
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      tick();
    }
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stepMs]);
  return now;
}

/* ─── Данные: сравнение и слияние ───────────────────────── */
function sameJson(a, b) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/* Новая карта статусов, но неизменившиеся записи берём из старой (те же объекты).
   Тогда React.memo не перерисовывает карточки, у которых ничего не поменялось,
   а если не поменялось ничего — не перерисовывается вообще ничего. */
function mergeStatusMap(prev, next) {
  const out = {};
  let changed = Object.keys(prev).length !== Object.keys(next).length;
  for (const id of Object.keys(next)) {
    if (prev[id] && sameJson(prev[id], next[id])) {
      out[id] = prev[id];
    } else {
      out[id] = next[id];
      changed = true;
    }
  }
  return changed ? out : prev;
}

/* Статус сразу после успешной отметки — до ответа сервера, чтобы карточка обновилась мгновенно.
   Повторяет логику сервера (KioskService.getStatus): после 退勤 смена закрыта → NOT_STARTED.
   Через долю секунды заменяется настоящим статусом с сервера. */
function applyPunchLocally(prev, recordType, photoBase64, serverTime) {
  const time = typeof serverTime === "string" && serverTime ? serverTime : new Date().toISOString();
  const base = prev || {};
  const record = { type: recordType, time };
  const records = [...(base.records || []), record];
  const lastPhotoPath = photoBase64 || base.lastPhotoPath;
  switch (recordType) {
    case "CLOCK_IN":
      return { ...base, status: "WORKING", clockInAt: time, clockOutAt: null, breakStartAt: null, breakEndAt: null,
               lastPhotoPath, records: [record] };
    case "BREAK_START":
      return { ...base, status: "ON_BREAK", breakStartAt: time, lastPhotoPath, records };
    case "BREAK_END":
      return { ...base, status: "WORKING", breakEndAt: time, lastPhotoPath, records };
    case "CLOCK_OUT":
      return { ...base, status: "NOT_STARTED", clockInAt: null, clockOutAt: null, breakStartAt: null, breakEndAt: null,
               lastPhotoPath, records };
    default:
      return base;
  }
}

/* Загружает картинку заранее (чтобы при подмене фото в карточке не было мигания). */
function preloadImage(url, timeoutMs = 3000) {
  return new Promise(resolve => {
    const img = new Image();
    let timer = null;
    const done = () => { clearTimeout(timer); resolve(); };
    timer = setTimeout(done, timeoutMs);
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

/* JPEG из canvas асинхронно (toBlob), чтобы интерфейс не подвисал на слабых устройствах.
   Результат — тот же data URL "data:image/jpeg;base64,...", что и у toDataURL.
   Если toBlob недоступен — старый синхронный способ. */
function canvasToJpegDataUrl(canvas, quality) {
  return new Promise(resolve => {
    const sync = () => resolve(canvas.toDataURL("image/jpeg", quality));
    if (!canvas.toBlob) { sync(); return; }
    try {
      canvas.toBlob(blob => {
        if (!blob) { sync(); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = sync;
        reader.readAsDataURL(blob);
      }, "image/jpeg", quality);
    } catch {
      sync();
    }
  });
}

/* ─── Камера (одна на всё приложение) ───────────────────────
   - Попап «берёт» камеру при открытии и «отдаёт» при закрытии.
   - После закрытия камера остаётся включённой CAMERA_KEEP_ALIVE_MS —
     у следующего сотрудника она откроется мгновенно.
   - Если попап закрыли раньше, чем камера успела включиться, она всё равно
     выключится по таймеру (раньше в этом случае оставалась включённой до перезагрузки).
   - Когда экран скрыт (сон iPad, другое приложение) — выключается сразу. */
const CAMERA_KEEP_ALIVE_MS = 60000;
const CAMERA_CONSTRAINTS = { video: { facingMode: "user" }, audio: false };

const cam = { stream: null, pending: null, users: 0, stopTimer: null };

function camIsLive() {
  return !!cam.stream && cam.stream.getVideoTracks().some(t => t.readyState === "live");
}

function camStopNow() {
  clearTimeout(cam.stopTimer);
  cam.stopTimer = null;
  if (cam.stream) {
    cam.stream.getTracks().forEach(t => t.stop());
    cam.stream = null;
  }
}

function camScheduleStop() {
  clearTimeout(cam.stopTimer);
  cam.stopTimer = setTimeout(() => {
    if (cam.users === 0) camStopNow();
  }, CAMERA_KEEP_ALIVE_MS);
}

// Живой поток: уже включённая камера или новый запуск
function camEnsure() {
  if (camIsLive()) return Promise.resolve(cam.stream);
  if (cam.stream) camStopNow();   // поток «умер» (например, iOS после сна) — выбрасываем
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error("NO_CAMERA"));
  if (!cam.pending) {
    cam.pending = navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      .then(stream => {
        cam.stream = stream;
        return stream;
      })
      .finally(() => {
        cam.pending = null;
        if (cam.users === 0) camScheduleStop();   // попап уже закрыли, пока камера включалась
      });
  }
  return cam.pending;
}

function camAcquire() {
  cam.users += 1;
  clearTimeout(cam.stopTimer);
  cam.stopTimer = null;
  return camEnsure();
}

function camRelease() {
  cam.users = Math.max(0, cam.users - 1);
  if (cam.users === 0) camScheduleStop();
}

const KANA_GROUPS = [
  { key: "ア", chars: "アイウエオ" },
  { key: "カ", chars: "カキクケコガギグゲゴ" },
  { key: "サ", chars: "サシスセソザジズゼゾ" },
  { key: "タ", chars: "タチツテトダヂヅデド" },
  { key: "ナ", chars: "ナニヌネノ" },
  { key: "ハ", chars: "ハヒフヘホバビブベボパピプペポ" },
  { key: "マ", chars: "マミムメモ" },
  { key: "ヤ", chars: "ヤユヨ" },
  { key: "ラ", chars: "ラリルレロ" },
  { key: "ワ", chars: "ワヲン" },
];

function toKatakana(str) {
  return (str || "").replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function getKanaGroup(staff) {
  const name = toKatakana(staff.fullNameKana || staff.fullName || "");
  const first = name[0];
  for (const g of KANA_GROUPS) {
    if (g.chars.includes(first)) return g.key;
  }
  return null;
}

function getAvailableActions(status) {
  switch (status) {
    case "NOT_STARTED": return ["CLOCK_IN"];
    case "WORKING":     return ["BREAK_START", "CLOCK_OUT"];
    case "ON_BREAK":    return ["BREAK_END"];
    case "FINISHED":    return ["CLOCK_IN"];
    default:            return [];
  }
}

function getActionLabel(type) {
  switch (type) {
    case "CLOCK_IN":    return "出勤";
    case "CLOCK_OUT":   return "退勤";
    case "BREAK_START": return "休憩";
    case "BREAK_END":   return "復帰";
    default:            return type;
  }
}

/* Иконка Wi-Fi — для сообщения «接続に問題があります» */
function WifiIcon({ ok, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#fff" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
      {!ok && <line x1="1" y1="1" x2="23" y2="23" stroke="#fff" strokeWidth="2" />}
    </svg>
  );
}

/* ─── Icons шапки (☰, Wi-Fi, стрелка) ─────────────────────────────────── */
function MenuIcon({ size = 26, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <line x1="3.5" y1="6.5"  x2="20.5" y2="6.5" />
      <line x1="3.5" y1="12"   x2="20.5" y2="12" />
      <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
    </svg>
  );
}

function WifiLineIcon({ ok, size = 26, color = "#fff" }) {
  const arcOpacity = ok ? 1 : 0.45;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g opacity={arcOpacity}>
        <path d="M2.5 9.3a14 14 0 0 1 19 0" />
        <path d="M5.6 12.7a9.4 9.4 0 0 1 12.8 0" />
        <path d="M8.7 16a4.9 4.9 0 0 1 6.6 0" />
        <circle cx="12" cy="19.3" r="1.2" fill={color} stroke="none" />
      </g>
      {!ok && <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" />}
    </svg>
  );
}

function ChevronRightIcon({ size = 16, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 5 16 12 9 19" />
    </svg>
  );
}

/* Цвет кнопки действия → CSS-класс (цвета в KioskPage.module.css: .actClockIn …) */
const ACTION_CLASS = {
  CLOCK_IN:    "actClockIn",
  CLOCK_OUT:   "actClockOut",
  BREAK_START: "actBreakStart",
  BREAK_END:   "actBreakEnd",
};

/* Склейка className: cx("a", cond && "b") → "a b" */
function cx(...args) {
  return args.filter(Boolean).join(" ");
}

const MOBILE_BREAKPOINT = 768;
function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    function sync() { setIsMobile(mql.matches); }

    // matchMedia сам корректно реагирует на изменение размеров экрана —
    // надёжнее, чем ручное чтение window.innerWidth на resize
    mql.addEventListener("change", sync);

    // iOS/iPadOS: при возврате приложения из фона возможен кратковременный
    // некорректный расчёт размеров экрана сразу после возобновления —
    // перепроверяем состояние явно, когда вкладка/приложение снова видимо
    function onVisibility() {
      if (document.visibilityState === "visible") {
        // небольшая задержка, чтобы система успела стабилизировать layout
        setTimeout(sync, 50);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      mql.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  return isMobile;
}

/* ─── KioskLogin ────────────────────────────────────────── */
function KioskLogin({ onLoggedIn }) {
  const [login, setLogin]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await loginKiosk(login, password);
      setKioskToken(res.accessToken);
      onLoggedIn();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <form onSubmit={handleSubmit} className={styles.loginForm}>
        <div className={styles.loginHead}>
          <div className={styles.loginTitle}>HannoSHIFT</div>
          <div className={styles.loginSub}>勤怠端末ログイン</div>
        </div>
        <label className={styles.loginLabel}>
          ログインID
          <input
            value={login}
            onChange={e => setLogin(e.target.value)}
            className={styles.loginInput}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </label>
        <label className={styles.loginLabel}>
          パスワード
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={styles.loginInput}
            autoComplete="current-password"
          />
        </label>
        {error && <div className={styles.loginError}>{error}</div>}
        <button type="submit" disabled={loading} className={styles.loginBtn}>
          {loading ? "..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}

/* ─── PopupClock ────────────────────────────────────────── */
// align="left" — для мобильного попапа; по умолчанию центр (планшет)
function PopupClock({ align = "center" }) {
  const now = useNow(1000);
  const left = align === "left";
  return (
    <>
      <div className={cx(styles.clockDate, left && styles.clockDateLeft)}>
        {formatJpDate(now)}
      </div>
      <div className={cx(styles.clockTime, left && styles.clockTimeLeft)}>
        <span className={styles.clockHM}>{FMT_HM.format(now)}</span>
        <span className={styles.clockSec}>:{pad2(now.getSeconds())}</span>
      </div>
    </>
  );
}

/* ─── Line icons (попап, шапка планшета) ──────────────────────────────── */
function LineIcon({ size = 24, color = "currentColor", strokeWidth = 1.8, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function BriefcaseIcon(p) {
  return <LineIcon {...p}><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M2.5 12.5h19" /></LineIcon>;
}
function ExitIcon(p) {
  return <LineIcon {...p}><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" /><polyline points="16 8 20 12 16 16" /><line x1="20" y1="12" x2="10" y2="12" /></LineIcon>;
}
function CupIcon(p) {
  return <LineIcon {...p}><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /></LineIcon>;
}
function ReturnIcon(p) {
  return <LineIcon {...p}><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></LineIcon>;
}
function CheckIcon(p) {
  return <LineIcon strokeWidth={2.4} {...p}><polyline points="20 6 9 17 4 12" /></LineIcon>;
}
function XIcon(p) {
  return <LineIcon strokeWidth={2.2} {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></LineIcon>;
}
function RefreshIcon(p) {
  return <LineIcon {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></LineIcon>;
}
function UserIcon(p) {
  return <LineIcon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></LineIcon>;
}
function LogoutIcon(p) {
  return <LineIcon {...p}><rect x="3" y="3" width="18" height="18" rx="2.5" /><polyline points="11 8 15 12 11 16" /><line x1="15" y1="12" x2="7" y2="12" /></LineIcon>;
}
function CameraIcon(p) {
  return <LineIcon {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3.2" /></LineIcon>;
}
function ActionIcon({ type, ...p }) {
  switch (type) {
    case "CLOCK_IN":    return <BriefcaseIcon {...p} />;
    case "CLOCK_OUT":   return <ExitIcon {...p} />;
    case "BREAK_START": return <CupIcon {...p} />;
    case "BREAK_END":   return <ReturnIcon {...p} />;
    default:            return null;
  }
}

/* ─── PunchPopup ────────────────────────────────────────── */
const ACTIONS = ["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"];

function PunchPopup({ staff, statusInfo, onClose, onSuccess, onUnauthorized }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const capturingRef = useRef(false);   // защита от двойного нажатия, пока кодируется снимок
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [confirming, setConfirming]   = useState(null); // { recordType, photoBase64 }
  const isMobile = useIsMobile();

  const availableActions = getAvailableActions(statusInfo?.status || "NOT_STARTED");

  // Камера: берём общую (если ещё включена — открывается мгновенно), при закрытии отдаём
  useEffect(() => {
    let alive = true;
    const video = videoRef.current;

    function attach(stream) {
      if (!alive || !video) return;
      if (video.srcObject !== stream) {
        video.onloadedmetadata = () => { if (alive) setCameraReady(true); };
        video.srcObject = stream;
      }
      const p = video.play?.();
      if (p && p.catch) p.catch(() => {});
    }
    function fail() {
      if (alive) setCameraError("カメラにアクセスできません");
    }

    camAcquire().then(attach, fail);

    // Вернулись из фона (сон iPad, другое приложение) — камера могла выключиться, включаем снова
    function onVisible() {
      if (document.visibilityState !== "visible" || camIsLive()) return;
      setCameraReady(false);
      camEnsure().then(attach, fail);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (video) video.srcObject = null;
      camRelease();   // выключится через CAMERA_KEEP_ALIVE_MS, если попап не откроют снова
    };
  }, []);

  async function handleAction(recordType) {
    if (loading || capturingRef.current) return;
    capturingRef.current = true;
    try {
      // Снимаем фото (камера продолжает работать)
      let photoBase64 = null;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && cameraReady) {
        const vw = video.videoWidth  || 640;
        const vh = video.videoHeight || 480;
        const scale = 1.5;
        const cropW = vw / scale;
        const cropH = vh / scale;
        const cropX = (vw - cropW) / 2;
        const cropY = (vh - cropH) / 2;
        canvas.width  = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d");
        // Отражаем снимок по горизонтали — как на камере (зеркально)
        ctx.translate(cropW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        // Кадр уже зафиксирован; кодируем в JPEG асинхронно — без подвисания интерфейса
        photoBase64 = await canvasToJpegDataUrl(canvas, 0.7);
      }

      // Показываем экран подтверждения (камера НЕ останавливается)
      setConfirming({ recordType, photoBase64 });
    } finally {
      capturingRef.current = false;
    }
  }

  async function handleConfirm() {
    if (!confirming || loading) return;
    const { recordType, photoBase64 } = confirming;
    setLoading(true); setError(null);
    try {
      const result = await punchApi(staff.id, recordType, photoBase64);
      // Успех: попап закрывается сразу, карточка обновляется мгновенно (см. KioskApp)
      onSuccess({ staffId: staff.id, recordType, photoBase64, result });
    } catch (e) {
      if (e.message === "UNAUTHORIZED") { onUnauthorized(); return; }
      setError(friendlyPunchError(e));
      setConfirming(null); // возврат на экран кнопок
      setLoading(false);
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget && !loading && !confirming) onClose();
  }

  /* ══ Разметка общая для телефона и планшета; раскладка — через классы m… (телефон) и t… (планшет) ══ */
  const status   = statusInfo?.status;
  const clockIn  = statusInfo?.clockInAt;
  const isActive = status === "WORKING" || status === "ON_BREAK";
  const dotClass = status === "ON_BREAK" ? styles.dotBreak : styles.dotWork;
  const iconSize = isMobile ? 26 : 30;

  const errorBox = error && (
    <div className={cx(styles.errorBox, styles.pError)}>{error}</div>
  );

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={isMobile ? styles.mCard : styles.tCard}>

        {/* ── Экран подтверждения ── */}
        {confirming && (
          <div className={isMobile ? styles.mConfirm : styles.tConfirm}>
            <div className={styles.pConfirmHead}>
              <div className={styles.pHeadIcon}>
                <CameraIcon size={22} />
              </div>
              <div className={styles.pHeadText}>写真を確認してください</div>
            </div>

            <div className={styles.pPhotoBox}>
              {confirming.photoBase64 ? (
                <img src={confirming.photoBase64} alt="photo" className={styles.coverImg} />
              ) : (
                <CameraIcon size={48} />
              )}
            </div>

            <div className={styles.pClockWrap}>
              <PopupClock align="left" />
            </div>

            <div className={styles.spacer} />
            {errorBox}

            <button
              onClick={handleConfirm}
              disabled={loading}
              className={cx(styles.pBtnConfirm, styles[ACTION_CLASS[confirming.recordType]])}
            >
              {loading ? "..." : (<><CheckIcon size={24} />{getActionLabel(confirming.recordType)}</>)}
            </button>

            <button
              onClick={() => { setConfirming(null); setError(null); }}
              disabled={loading}
              className={styles.pBtnOutline}
            >
              <XIcon size={16} />キャンセル
            </button>
          </div>
        )}

        {/* ── Экран выбора действия (всегда в DOM — камера не выключается) ── */}
        <div className={cx(isMobile ? styles.mMain : styles.tMain, confirming && styles.hidden)}>

          {/* Камера */}
          <div className={isMobile ? styles.mCamera : styles.tCamera}>
            <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {cameraReady && (
              <div className={styles.ovalWrap}>
                <div className={styles.pOval} />
              </div>
            )}

            {cameraError && (
              <div className={styles.camError}>
                <CameraIcon size={40} />
                <div>{cameraError}</div>
              </div>
            )}

            {/* Время прихода */}
            {clockIn && (
              <div className={styles.pClockBadge}>
                {isActive && <span className={cx(styles.pBadgeDot, dotClass)} />}
                {formatTimeShort(clockIn)}
              </div>
            )}

            {/* ✕ закрыть */}
            <button onClick={onClose} disabled={loading} aria-label="close" className={styles.pCloseBtn}>
              <XIcon size={isMobile ? 18 : 22} />
            </button>

            {/* Имя */}
            <div className={styles.pCamName}>{staff.fullName}</div>
          </div>

          {/* Панель: время, отметки, кнопки (на телефоне — под камерой, на планшете — справа) */}
          <div className={styles.pPanel}>
            {!confirming && (
              <div className={styles.pClockWrapTop}>
                <PopupClock align="left" />
              </div>
            )}

            {/* Отметки за сегодня */}
            {statusInfo?.records && statusInfo.records.length > 0 && (
              <div className={styles.pRecords}>
                {statusInfo.records.map((r, i) => (
                  <div key={i} className={styles.recRow}>
                    <span className={styles.pRecLabel}>{getActionLabel(r.type)}</span>
                    <span className={styles.recTime}>{formatTime(r.time)}</span>
                  </div>
                ))}
              </div>
            )}

            {errorBox}

            {status === "FINISHED" && (
              <div className={cx(styles.finishedNote, styles.pFinished)}>
                本日の退勤打刻は完了しています
              </div>
            )}

            <div className={styles.spacer} />

            {/* Кнопки 2×2 */}
            <div className={styles.pActions}>
              {ACTIONS.map(action => {
                const isAvail = availableActions.includes(action);
                return (
                  <button
                    key={action}
                    onClick={() => isAvail && !loading && handleAction(action)}
                    disabled={!isAvail || loading}
                    className={cx(
                      styles.pActBtn,
                      isAvail ? styles[ACTION_CLASS[action]] : styles.pActOff,
                      isAvail && loading && styles.pActBusy,
                      isAvail && !loading && styles.pressable,
                    )}
                  >
                    <ActionIcon type={action} size={iconSize} />
                    {getActionLabel(action)}
                  </button>
                );
              })}
            </div>

            <button onClick={onClose} disabled={loading} className={styles.pBtnOutline}>
              <XIcon size={16} />キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Smiley placeholder (общая заглушка) ───────────────── */
function SmileyPlaceholder({ size }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} opacity="0.5">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#1e3a5f" strokeWidth="4"/>
      <path d="M 30 60 Q 50 78 70 60" fill="none" stroke="#1e3a5f" strokeWidth="4" strokeLinecap="round"/>
      <path d="M 33 38 Q 38 32 43 38" fill="none" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M 57 38 Q 62 32 67 38" fill="none" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── Staff Card ────────────────────────────────────────── */
// Одна разметка для телефона и планшета. Размеры — в CSS:
//   телефон: .mGrid { --kiosk-photo-h; --kiosk-name-h }
//   планшет: .tGrid { --kiosk-photo-h; --kiosk-name-h } + переопределения .tGrid .s*
const StaffCard = memo(function StaffCard({ staff, statusInfo, isSelected, onSelect }) {
  const status     = statusInfo?.status;
  const clockIn    = statusInfo?.clockInAt;
  const isActive   = status === "WORKING" || status === "ON_BREAK";
  const isFinished = status === "FINISHED";
  const hasPhoto   = statusInfo?.lastPhotoPath && status !== "NOT_STARTED" && status !== "FINISHED";
  const dotClass   = status === "ON_BREAK" ? styles.dotBreak : styles.dotWork;

  return (
    <div
      onClick={() => onSelect(staff)}
      className={cx(styles.sCard, isSelected && styles.sCardSelected, isFinished && styles.finished)}
    >
      <div className={cx(styles.sPhoto, hasPhoto && styles.sPhotoDark)}>
        <div className={styles.sPhotoInner}>
          {hasPhoto ? (
            <img
              src={statusInfo.lastPhotoPath}
              alt={staff.fullName}
              className={styles.coverImg}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <SmileyPlaceholder size="62%" />
          )}
        </div>

        {clockIn ? (
          <div className={styles.sBadge}>
            {isActive && <span className={cx(styles.sBadgeDot, dotClass)} />}
            {formatTimeShort(clockIn)}
          </div>
        ) : isActive && (
          <div className={cx(styles.sLoneDot, dotClass)} />
        )}
      </div>

      <div className={styles.sName}>{staff.fullName}</div>
    </div>
  );
});

/* ─── MobileKanaBar (горизонтальная строка букв, только mobile) ── */
const MobileKanaBar = memo(function MobileKanaBar({ groups, activeGroup, onSelect }) {
  const scrollRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateArrow();
    window.addEventListener("resize", updateArrow);
    return () => window.removeEventListener("resize", updateArrow);
  }, [updateArrow, groups.length]);

  function scrollRight() {
    scrollRef.current?.scrollBy({ left: 160, behavior: "smooth" });
  }

  return (
    <div className={styles.kanaBar}>
      <div
        ref={scrollRef}
        onScroll={updateArrow}
        className={cx(styles.kanaScroll, canScrollRight && styles.kanaScrollPad)}
      >
        {groups.map(g => (
          <button
            key={g.key}
            onClick={() => onSelect(g.key)}
            className={cx(
              styles.kanaBtn,
              g.key === "All" && styles.kanaBtnAll,
              activeGroup === g.key && styles.kanaBtnActive,
            )}
          >
            <span className={styles.kanaKey}>{g.key}</span>
            <span className={styles.kanaCount}>({g.count}{g.key === "All" ? "人" : ""})</span>
          </button>
        ))}
      </div>

      {canScrollRight && (
        <button onClick={scrollRight} aria-label="more" className={styles.kanaArrow}>
          <ChevronRightIcon size={16} />
        </button>
      )}
    </div>
  );
});

/* ─── Часы в шапке (отдельные компоненты — остальной экран каждую секунду не перерисовывается) ── */
// Телефон: секунд нет — обновляемся раз в минуту
function MobileHeaderClock() {
  const now = useNow(60000);
  return (
    <div className={styles.mDateLine}>
      {formatJpDate(now)}&nbsp;&nbsp;{FMT_HM.format(now)}
    </div>
  );
}

// Планшет: с секундами
function TabletHeaderClock() {
  const now = useNow(1000);
  return (
    <>
      <span className={styles.tDate}>{formatJpDate(now)}</span>
      <span className={styles.tTimeBox}>
        <span className={styles.tTime}>{FMT_HM.format(now)}</span>
        <span className={styles.tSec}>:{pad2(now.getSeconds())}</span>
      </span>
    </>
  );
}

/* ─── KioskApp ──────────────────────────────────────────── */
const POLL_INTERVAL_MS = 30000;

function KioskApp({ onLogout }) {
  const [staff, setStaff]                 = useState([]);
  const [statusMap, setStatusMap]         = useState({});
  const [loading, setLoading]             = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [activeGroup, setActiveGroup]     = useState("All");
  const [menuOpen, setMenuOpen]           = useState(false);
  const [connectionOk, setConnectionOk]   = useState(true);
  const [wifiTip, setWifiTip]             = useState(false);
  const wifiTipTimerRef = useRef(null);
  const retryCountRef   = useRef(0);
  const retryTimerRef   = useRef(null);
  const statusMapRef    = useRef(statusMap);  // последние известные статусы (для запасного способа загрузки)
  const lastPunchAtRef  = useRef(0);          // время последней отметки — старый ответ опроса её не затрёт
  const punchSeqRef     = useRef({});         // номер последней отметки по сотруднику
  const isMobile = useIsMobile();

  useEffect(() => { statusMapRef.current = statusMap; }, [statusMap]);

  // Подсказка у иконки Wi-Fi — показывается по тапу и сама скрывается через 2 сек
  function showWifiTip() {
    if (wifiTipTimerRef.current) clearTimeout(wifiTipTimerRef.current);
    setWifiTip(true);
    wifiTipTimerRef.current = setTimeout(() => setWifiTip(false), 2000);
  }
  useEffect(() => () => { if (wifiTipTimerRef.current) clearTimeout(wifiTipTimerRef.current); }, []);

  const loadData = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      retryCountRef.current = 0;
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    }
    const startedAt = Date.now();
    try {
      // Список и статусы — параллельно
      const staffPromise = fetchStaff();
      staffPromise.catch(() => {});                   // ошибка обработается ниже, на await
      let sm = await fetchStatusesBatch();            // один запрос на всех
      const s = await staffPromise;
      if (!sm) sm = await fetchStatusesEach(s, statusMapRef.current);   // сервер без нового эндпоинта

      // Если данные не изменились — оставляем прежние объекты: ничего не перерисовывается
      setStaff(prev => (sameJson(prev, s) ? prev : s));
      // Пока шёл запрос, кто-то отметился — не затираем его свежий статус старыми данными
      if (startedAt >= lastPunchAtRef.current) {
        setStatusMap(prev => mergeStatusMap(prev, sm));
      }
      retryCountRef.current = 0;
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      setConnectionOk(true);
    } catch (e) {
      if (e.message === "UNAUTHORIZED") { onLogout(); return; }
      console.error(e);
      if (retryCountRef.current < CONNECTION_RETRY_COUNT) {
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => { loadData(); }, CONNECTION_RETRY_DELAY_MS);
      } else {
        setConnectionOk(false);
      }
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { loadData(); }, [loadData]);

  // Опрос каждые 30 сек — только когда экран виден и попап закрыт
  useEffect(() => {
    const t = setInterval(() => {
      if (!selectedStaff && document.visibilityState === "visible") loadData(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [selectedStaff, loadData]);

  // Экран снова виден (iPad проснулся, вернулись в приложение) — сразу обновляем данные.
  // Экран скрыт — выключаем камеру (попап сам включит её снова при возврате).
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        if (!selectedStaff) loadData(true);
      } else {
        camStopNow();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [selectedStaff, loadData]);

  // ブラウザがネットワーク復旧を検知したら即座に再試行
  useEffect(() => {
    function handleOnline() { loadData(true); }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadData]);

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  // Группа каны для каждого сотрудника — считаем один раз при загрузке списка
  const kanaById = useMemo(() => {
    const m = {};
    staff.forEach(s => { m[s.id] = getKanaGroup(s); });
    return m;
  }, [staff]);

  const groups = useMemo(() => [
    { key: "All", count: staff.length },
    ...KANA_GROUPS.map(g => ({
      key: g.key,
      count: staff.filter(s => kanaById[s.id] === g.key).length,
    })).filter(g => g.count > 0),
  ], [staff, kanaById]);

  const filteredStaff = useMemo(() => (
    activeGroup === "All" ? staff : staff.filter(s => kanaById[s.id] === activeGroup)
  ), [staff, activeGroup, kanaById]);

  const workingCount = useMemo(() => Object.values(statusMap)
    .filter(s => s.status === "WORKING" || s.status === "ON_BREAK").length, [statusMap]);

  const handleSelect = useCallback(s => setSelectedStaff(s), []);

  // Отметка прошла: попап закрываем сразу, карточку обновляем мгновенно,
  // а настоящий статус спрашиваем у сервера в фоне.
  const handlePunchSuccess = useCallback(({ staffId, recordType, photoBase64, result }) => {
    lastPunchAtRef.current = Date.now();
    const seq = (punchSeqRef.current[staffId] || 0) + 1;
    punchSeqRef.current[staffId] = seq;

    setSelectedStaff(null);
    setStatusMap(prev => ({
      ...prev,
      [staffId]: applyPunchLocally(prev[staffId], recordType, photoBase64, result?.recordedAt),
    }));

    fetchOneStatus(staffId)
      .then(async st => {
        if (st?.lastPhotoPath) await preloadImage(st.lastPhotoPath);   // без мигания при подмене фото
        if (punchSeqRef.current[staffId] !== seq) return;               // уже была новая отметка
        setStatusMap(prev => (sameJson(prev[staffId], st) ? prev : { ...prev, [staffId]: st }));
      })
      .catch(e => {
        if (e.message === "UNAUTHORIZED") onLogout();
        // иначе оставляем локальный статус — следующий опрос уточнит
      });
  }, [onLogout]);

  const showCards = !loading && connectionOk && filteredStaff.length > 0;

  // Иконка Wi-Fi с подсказкой 接続あり / 接続なし (телефон и планшет)
  function renderWifi() {
    return (
      <>
        <button onClick={showWifiTip} aria-label="connection" className={styles.iconBtn}>
          <WifiLineIcon ok={connectionOk} size={28} />
        </button>
        <div className={cx(styles.wifiTip, wifiTip && styles.wifiTipShow)}>
          <span className={styles.wifiTipArrow} />
          <span className={styles.wifiTipText}>{connectionOk ? "接続あり" : "接続なし"}</span>
        </div>
      </>
    );
  }

  function renderMenu(mobile) {
    if (!menuOpen) return null;
    return (
      <>
        <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
        <div className={cx(styles.menuDrop, mobile ? styles.menuDropMobile : styles.menuDropTablet)}>
          {mobile && (
            <div className={cx(styles.menuItem, styles.menuInfo)}>
              <span className={styles.menuInfoIcon}><UserIcon size={18} /></span>
              出勤中 {workingCount}人
            </div>
          )}
          <button
            onClick={() => { setMenuOpen(false); onLogout(); }}
            className={cx(styles.menuItem, styles.menuLogout)}
          >
            <LogoutIcon size={18} />
            ログアウト
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={cx(styles.app, isMobile && styles.appMobile)}>

      {/* ── Header ── */}
      {isMobile ? (
        <div className={styles.mHeader}>
          <div className={styles.mHeaderRow}>
            <div className={styles.mHeaderLeft}>
              <button onClick={() => setMenuOpen(v => !v)} aria-label="menu" className={styles.iconBtn}>
                <MenuIcon size={28} />
              </button>
              {renderMenu(true)}
            </div>

            <div className={styles.mTitle}>HannoSHIFT</div>

            <div className={styles.mHeaderRight}>
              {renderWifi()}
            </div>
          </div>

          <MobileHeaderClock />
        </div>
      ) : (
        <div className={styles.tHeader}>
          <div className={styles.tHeaderLeft}>
            <div className={styles.relative}>
              <button onClick={() => setMenuOpen(v => !v)} aria-label="menu" className={styles.iconBtn}>
                <MenuIcon size={30} />
              </button>
              {renderMenu(false)}
            </div>
            <TabletHeaderClock />
          </div>

          <div className={styles.tTitle}>HannoSHIFT</div>

          <div className={styles.tHeaderRight}>
            <button onClick={() => loadData(true)} aria-label="refresh" className={styles.iconBtn}>
              <RefreshIcon size={28} />
            </button>
            <div className={styles.relative}>
              {renderWifi()}
            </div>
            <div className={styles.tWorking}>出勤中 {workingCount}人</div>
          </div>
        </div>
      )}

      {/* ── Mobile: горизонтальная строка букв (вне скролла списка → всегда прилипшая) ── */}
      {isMobile && (
        <MobileKanaBar groups={groups} activeGroup={activeGroup} onSelect={setActiveGroup} />
      )}

      {/* ── Body ── */}
      <div className={styles.body}>
        {!isMobile && (
          <div className={styles.tKana}>
            {groups.map(g => (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={cx(styles.tKanaBtn, activeGroup === g.key && styles.tKanaBtnActive)}
              >
                <span className={styles.tKanaKey}>{g.key}</span>
                <span className={styles.tKanaCount}>({g.count}人)</span>
              </button>
            ))}
          </div>
        )}

        <div className={isMobile ? cx(styles.mGrid, showCards && styles.gridRows) : cx(styles.tGrid, showCards && styles.gridRows)}>
          {loading ? (
            <div className={cx(styles.fullRow, styles.msgLoading)}>読み込み中...</div>
          ) : !connectionOk ? (
            <div className={cx(styles.fullRow, styles.connErr)}>
              <WifiIcon ok={false} size={72} />
              <div className={styles.connErrTitle}>接続に問題があります</div>
              <div className={styles.connErrSub}>サポートにお問い合わせください</div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className={cx(styles.fullRow, styles.msgEmpty)}>該当するスタッフがいません</div>
          ) : (
            filteredStaff.map(s => (
              <StaffCard
                key={s.id}
                staff={s}
                statusInfo={statusMap[s.id]}
                isSelected={selectedStaff?.id === s.id}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </div>

      {selectedStaff && (
        <PunchPopup
          staff={selectedStaff}
          statusInfo={statusMap[selectedStaff.id]}
          onClose={() => setSelectedStaff(null)}
          onSuccess={handlePunchSuccess}
          onUnauthorized={() => { setSelectedStaff(null); onLogout(); }}
        />
      )}

    </div>
  );
}

/* ─── KioskPage (root) ──────────────────────────────────── */
export default function KioskPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!getKioskToken());

  function handleLogout() {
    camStopNow();
    clearKioskToken();
    setIsLoggedIn(false);
  }

  if (!isLoggedIn) {
    return <KioskLogin onLoggedIn={() => setIsLoggedIn(true)} />;
  }

  return <KioskApp onLogout={handleLogout} />;
}