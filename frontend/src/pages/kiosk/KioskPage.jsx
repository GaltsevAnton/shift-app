import { useState, useEffect, useRef, useCallback } from "react";

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
  const res = await fetch(`${API_BASE}/api/kiosk/staff?restaurantId=${RESTAURANT_ID}`, {
    headers: authHeaders(),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("Failed to load staff");
  return res.json();
}

async function fetchAllStatuses(staffList) {
  const results = await Promise.all(
    staffList.map(s =>
      fetch(`${API_BASE}/api/kiosk/status/${s.id}`, { headers: authHeaders() })
        .then(r => {
          if (r.status === 401 || r.status === 403) throw new Error("UNAUTHORIZED");
          return r.json();
        })
        .then(status => ({ userId: s.id, status }))
        .catch(() => ({ userId: s.id, status: { status: "NOT_STARTED" } }))
    )
  );
  const map = {};
  results.forEach(r => { map[r.userId] = r.status; });
  return map;
}

async function punchApi(userId, recordType, photoBase64) {
  const res = await fetch(`${API_BASE}/api/kiosk/punch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userId, recordType, photoBase64 }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to punch");
  }
  return res.json();
}

/* ─── Helpers ───────────────────────────────────────────── */
function formatTime(instant) {
  if (!instant) return "--:--";
  return new Date(instant).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo",
  });
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

function getActionBg(type, available) {
  if (!available.includes(type)) return "rgba(255,255,255,0.15)";
  switch (type) {
    case "CLOCK_IN":    return "#3b6fd4";
    case "CLOCK_OUT":   return "#e53935";
    case "BREAK_START": return "#f57c00";
    case "BREAK_END":   return "#43a047";
    default:            return "#3b6fd4";
  }
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
    <div style={{
      width: "100vw", height: "100dvh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#1e3a5f",
      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 20, padding: 40,
        width: 360, display: "flex", flexDirection: "column", gap: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a5f" }}>HannoSHIFT</div>
          <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>勤怠端末ログイン</div>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
          ログインID
          <input
            value={login}
            onChange={e => setLogin(e.target.value)}
            style={{
              display: "block", width: "100%", marginTop: 6,
              padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid #e2e8f0", fontSize: 15,
              boxSizing: "border-box", outline: "none",
            }}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
          パスワード
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              display: "block", width: "100%", marginTop: 6,
              padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid #e2e8f0", fontSize: 15,
              boxSizing: "border-box", outline: "none",
            }}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <div style={{
            background: "#fef2f2", color: "#dc2626",
            padding: "8px 12px", borderRadius: 8, fontSize: 13,
          }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} style={{
          marginTop: 8, padding: "12px",
          background: "#2F5496", color: "#fff",
          border: "none", borderRadius: 10,
          fontSize: 16, fontWeight: 700, cursor: "pointer",
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}

/* ─── PopupClock ────────────────────────────────────────── */
function PopupClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const WD = ["日","月","火","水","木","金","土"];
  const t  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const m  = String(t.getMonth() + 1).padStart(2, "0");
  const d  = String(t.getDate()).padStart(2, "0");
  const dateStr = `${m}月${d}日（${WD[t.getDay()]}）`;
  const timeStr = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  });
  const secStr = String(now.getSeconds()).padStart(2, "0");
  return (
    <>
      <div style={{ fontSize: 22, color: "rgba(255,255,255,0.8)", fontWeight: 600, marginBottom: 4 }}>
        {dateStr}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 44, fontWeight: 700, color: "#fff", fontFamily: "monospace", lineHeight: 1 }}>{timeStr}</span>
        <span style={{ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>:{secStr}</span>
      </div>
    </>
  );
}

/* ─── PunchPopup ────────────────────────────────────────── */
function PunchPopup({ staff, statusInfo, onClose, onSuccess, onUnauthorized }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [confirming, setConfirming]   = useState(null); // { recordType, photoBase64 }

  const availableActions = getAvailableActions(statusInfo?.status || "NOT_STARTED");

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      })
      .catch(() => setCameraError("カメラにアクセスできません"));
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  async function handleAction(recordType) {
    if (loading) return;

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
      canvas.getContext("2d").drawImage(
        video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH
      );
      photoBase64 = canvas.toDataURL("image/jpeg", 0.7);
    }

    // Показываем экран подтверждения (камера НЕ останавливается)
    setConfirming({ recordType, photoBase64 });
  }

  async function handleConfirm() {
    if (!confirming || loading) return;
    setLoading(true); setError(null);
    try {
      const result = await punchApi(staff.id, confirming.recordType, confirming.photoBase64);
      streamRef.current?.getTracks().forEach(t => t.stop()); // останавливаем только при успехе
      setConfirming(null);
      onSuccess(result);
    } catch (e) {
      if (e.message === "UNAUTHORIZED") { onUnauthorized(); return; }
      setError(e.message);
      setConfirming(null); // возврат на экран кнопок
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading && !confirming) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        width: 900, height: 610,
        background: "#1e3a5f",
        borderRadius: 24,
        overflow: "hidden",
        display: "flex",
        position: "relative",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>

        {/* ── Экран подтверждения (поверх, абсолютный) ── */}
        {confirming && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: "#1e3a5f",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20,
            padding: 32,
          }}>
            {confirming.photoBase64 ? (
              <img
                src={confirming.photoBase64}
                alt="photo"
                style={{
                  width: 320, height: 320, objectFit: "cover",
                  borderRadius: 16,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                }}
              />
            ) : (
              <div style={{
                width: 320, height: 320, borderRadius: 16,
                background: "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 64,
              }}>📷</div>
            )}

            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
              {staff.fullName}
            </div>

            <PopupClock />
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              {getActionLabel(confirming.recordType)}
            </div>

            {error && (
              <div style={{
                background: "rgba(229,57,53,0.2)", border: "1px solid rgba(229,57,53,0.5)",
                borderRadius: 8, padding: "8px 16px",
                color: "#ffcdd2", fontSize: 13, textAlign: "center",
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 440 }}>
              <button
                onClick={() => { setConfirming(null); setError(null); }}
                disabled={loading}
                style={{
                  flex: 1, padding: "18px 0",
                  background: "rgba(255,255,255,0.15)",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderRadius: 14, color: "#fff",
                  fontSize: 22, fontWeight: 700, cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  flex: 1, padding: "18px 0",
                  background: getActionBg(confirming.recordType, [confirming.recordType]),
                  border: "none", borderRadius: 14, color: "#fff",
                  fontSize: 22, fontWeight: 700, cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "..." : getActionLabel(confirming.recordType)}
              </button>
            </div>
          </div>
        )}

        {/* ── Камера (всегда в DOM, скрыта при подтверждении) ── */}
        <div style={{
          width: 560, flexShrink: 0, position: "relative",
          background: "#000", overflow: "hidden",
          visibility: confirming ? "hidden" : "visible",
        }}>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transform: "scaleX(-1) scale(1.5)",
              transformOrigin: "center center",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {cameraReady && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <div style={{
                width: "55%", height: "75%",
                border: "3px dashed rgba(255,255,255,0.5)",
                borderRadius: "50%",
              }} />
            </div>
          )}

          {cameraError && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.7)", fontSize: 14, gap: 8,
            }}>
              <div style={{ fontSize: 40 }}>📷</div>
              <div>{cameraError}</div>
            </div>
          )}

          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
            padding: "24px 16px 16px",
            color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center",
          }}>
            {staff.fullName}
          </div>
        </div>

        {/* ── Панель кнопок (всегда в DOM, скрыта при подтверждении) ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "#1e3a5f",
          visibility: confirming ? "hidden" : "visible",
        }}>
          <div style={{ padding: "16px 16px 10px", textAlign: "center" }}>
            <PopupClock />
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "0 20px 12px",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#d0dff0", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 100 100" width="48" height="48" opacity="0.5">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1e3a5f" strokeWidth="4"/>
                <path d="M 30 60 Q 50 78 70 60" fill="none" stroke="#1e3a5f" strokeWidth="4" strokeLinecap="round"/>
                <path d="M 33 38 Q 38 32 43 38" fill="none" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M 57 38 Q 62 32 67 38" fill="none" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>
                {staff.fullName}
              </div>
            </div>
          </div>

          {statusInfo?.records && statusInfo.records.length > 0 && (
            <div style={{
              padding: "0 20px 8px",
              display: "flex", flexDirection: "column", gap: 4,
              maxHeight: 140, overflowY: "auto",
            }}>
              {statusInfo.records.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>{getActionLabel(r.type)}</span>
                  <span style={{ color: "#fff", fontFamily: "monospace", fontWeight: 600 }}>
                    {formatTime(r.time)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && !confirming && (
            <div style={{
              margin: "0 12px 8px",
              background: "rgba(229,57,53,0.2)", border: "1px solid rgba(229,57,53,0.5)",
              borderRadius: 8, padding: "6px 12px",
              color: "#ffcdd2", fontSize: 12, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: 260, flexShrink: 0, gap: 1 }}>
            {["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"].map(action => {
              const isAvail = availableActions.includes(action);
              return (
                <button
                  key={action}
                  onClick={() => isAvail && !loading && handleAction(action)}
                  style={{
                    background: getActionBg(action, availableActions),
                    border: "none", color: "#fff",
                    fontSize: 26, fontWeight: 800,
                    cursor: isAvail && !loading ? "pointer" : "not-allowed",
                    opacity: isAvail ? 1 : 0.3,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "transform 0.1s",
                  }}
                  onTouchStart={e => isAvail && (e.currentTarget.style.transform = "scale(0.97)")}
                  onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
                  onMouseDown={e => isAvail && (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  {loading && isAvail ? "..." : getActionLabel(action)}
                </button>
              );
            })}
          </div>

          {statusInfo?.status === "FINISHED" && (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center", padding: "6px 0" }}>
              本日の退勤打刻は完了しています
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Staff Card ────────────────────────────────────────── */
function StaffCard({ staff, statusInfo, onClick, isSelected }) {
  const clockIn    = statusInfo?.clockInAt;
  const isActive   = statusInfo?.status === "WORKING" || statusInfo?.status === "ON_BREAK";
  const isFinished = statusInfo?.status === "FINISHED";
  const isBreak    = statusInfo?.status === "ON_BREAK";

  return (
    <div onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      cursor: "pointer", width: 160,
      opacity: isFinished ? 0.55 : 1,
    }}>
      <div style={{
        width: 140, height: 140, borderRadius: 6,
        overflow: "hidden", position: "relative",
        background: "#d0dff0",
        border: isSelected ? "3px solid #2F5496" : "3px solid rgba(0,0,0,0.1)",
        boxShadow: isSelected ? "0 0 0 3px #3b6fd4" : "none",
        transition: "box-shadow 0.15s",
      }}>
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: statusInfo?.lastPhotoPath && statusInfo?.status !== "NOT_STARTED" ? "#000" : "#d0dff0",
        }}>
          {statusInfo?.lastPhotoPath && statusInfo?.status !== "NOT_STARTED" && statusInfo?.status !== "FINISHED" ? (
            <img
              src={statusInfo.lastPhotoPath}
              alt={staff.fullName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <svg viewBox="0 0 100 100" width="72" height="72" opacity="0.5">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e3a5f" strokeWidth="4"/>
              <path d="M 30 60 Q 50 78 70 60" fill="none" stroke="#1e3a5f" strokeWidth="4" strokeLinecap="round"/>
              <path d="M 33 38 Q 38 32 43 38" fill="none" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M 57 38 Q 62 32 67 38" fill="none" stroke="#1e3a5f" strokeWidth="3.5" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {isActive && (
          <div style={{
            position: "absolute", top: 6, left: 6,
            width: 10, height: 10, borderRadius: "50%",
            background: isBreak ? "#f57c00" : "#43a047",
            border: "2px solid #fff",
            boxShadow: "0 0 4px rgba(0,0,0,0.3)",
          }} />
        )}

        {clockIn && (
          <div style={{
            position: "absolute", top: 5, left: 0, right: 0,
            textAlign: "center", fontSize: 12, fontWeight: 700, color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            background: "rgba(0,0,0,0.3)", padding: "2px 0",
          }}>
            {formatTime(clockIn)}
          </div>
        )}
      </div>

      <div style={{
        marginTop: 6, fontSize: 15, fontWeight: 600,
        color: "#1e293b", textAlign: "center", lineHeight: 1.3,
        maxWidth: 150, overflow: "hidden",
      }}>
        {staff.fullName}
      </div>
    </div>
  );
}

/* ─── KioskApp ──────────────────────────────────────────── */
function KioskApp({ onLogout }) {
  const [staff, setStaff]                 = useState([]);
  const [statusMap, setStatusMap]         = useState({});
  const [loading, setLoading]             = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [activeGroup, setActiveGroup]     = useState("All");
  const [menuOpen, setMenuOpen]           = useState(false);
  const [now, setNow]                     = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const s  = await fetchStaff();
      setStaff(s);
      const sm = await fetchAllStatuses(s);
      setStatusMap(sm);
    } catch (e) {
      if (e.message === "UNAUTHORIZED") { onLogout(); return; }
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const t = setInterval(() => { if (!selectedStaff) loadData(); }, 30000);
    return () => clearInterval(t);
  }, [selectedStaff, loadData]);

  const groups = [
    { key: "All", count: staff.length },
    ...KANA_GROUPS.map(g => ({
      key: g.key,
      count: staff.filter(s => getKanaGroup(s) === g.key).length,
    })).filter(g => g.count > 0),
  ];

  const filteredStaff = activeGroup === "All"
    ? staff
    : staff.filter(s => getKanaGroup(s) === activeGroup);

  const workingCount = Object.values(statusMap)
    .filter(s => s.status === "WORKING" || s.status === "ON_BREAK").length;

  async function handlePunchSuccess(result) {
    if (selectedStaff) {
      try {
        const res = await fetch(`${API_BASE}/api/kiosk/status/${selectedStaff.id}`, {
          headers: authHeaders(),
        });
        const newStatus = await res.json();
        setStatusMap(prev => ({ ...prev, [selectedStaff.id]: newStatus }));
      } catch {}
    }
    setSelectedStaff(null);
  }

  const timeStr = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  });
  const secStr = String(now.getSeconds()).padStart(2, "0");

  return (
    <div style={{
      width: "100vw", height: "100dvh",
      display: "flex", flexDirection: "column",
      background: "#f0f4f8",
      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
      userSelect: "none", overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", background: "#1e3a5f", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)", position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen(v => !v)} style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 20, cursor: "pointer", padding: "6px 12px",
            }}>☰</button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{
                  position: "fixed", inset: 0, zIndex: 998,
                }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0,
                  background: "#fff", borderRadius: 10, overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 999,
                  minWidth: 160,
                }}>
                  <button onClick={() => { setMenuOpen(false); onLogout(); }} style={{
                    display: "block", width: "100%", padding: "12px 18px",
                    textAlign: "left", border: "none", background: "none",
                    color: "#dc2626", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}>
                    🚪 ログアウト
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
              {(() => {
                const WD = ["日","月","火","水","木","金","土"];
                const t = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
                const m  = String(t.getMonth() + 1).padStart(2, "0");
                const d  = String(t.getDate()).padStart(2, "0");
                return `${m}月${d}日（${WD[t.getDay()]}）`;
              })()}
            </span>
            <span style={{ fontSize: 34, fontWeight: 700, color: "#fff", fontFamily: "monospace", lineHeight: 1 }}>
              {timeStr}:{secStr}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
          HannoSHIFT
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={loadData} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
            color: "#fff", fontSize: 18, cursor: "pointer", padding: "6px 12px",
          }}>↻</button>
          <div style={{
            background: "rgba(255,255,255,0.15)", borderRadius: 20,
            padding: "6px 18px", color: "#fff", fontSize: 14, fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            出勤中 {workingCount}人
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{
          width: 68, flexShrink: 0, background: "#1e3a5f",
          display: "flex", flexDirection: "column", overflowY: "auto",
          boxShadow: "2px 0 8px rgba(0,0,0,0.2)",
        }}>
          {groups.map(g => (
            <button key={g.key} onClick={() => setActiveGroup(g.key)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "11px 4px",
              background: activeGroup === g.key ? "#2F5496" : "transparent",
              border: "none", cursor: "pointer",
              borderLeft: activeGroup === g.key ? "3px solid #fff" : "3px solid transparent",
              transition: "background 0.15s",
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{g.key}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>({g.count}人)</span>
            </button>
          ))}
        </div>

        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 16px",
          display: "flex", flexWrap: "wrap",
          alignContent: "flex-start", gap: 14,
        }}>
          {loading ? (
            <div style={{ color: "rgba(0,0,0,0.5)", fontSize: 16, padding: 40 }}>読み込み中...</div>
          ) : filteredStaff.length === 0 ? (
            <div style={{ color: "rgba(0,0,0,0.4)", fontSize: 15, padding: 40 }}>
              該当するスタッフがいません
            </div>
          ) : (
            filteredStaff.map(s => (
              <StaffCard
                key={s.id}
                staff={s}
                statusInfo={statusMap[s.id]}
                isSelected={selectedStaff?.id === s.id}
                onClick={() => setSelectedStaff(s)}
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
    clearKioskToken();
    setIsLoggedIn(false);
  }

  if (!isLoggedIn) {
    return <KioskLogin onLoggedIn={() => setIsLoggedIn(true)} />;
  }

  return <KioskApp onLogout={handleLogout} />;
}