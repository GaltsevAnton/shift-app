import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;
const RESTAURANT_ID = 1;
const AUTO_RETURN_SEC = 4; // секунд до возврата на главный экран

/* ─── API ───────────────────────────────────────────────── */
async function fetchStaff() {
  const res = await fetch(`${API_BASE}/api/kiosk/staff?restaurantId=${RESTAURANT_ID}`);
  if (!res.ok) throw new Error("Failed to load staff");
  return res.json();
}

async function fetchStatus(userId) {
  const res = await fetch(`${API_BASE}/api/kiosk/status/${userId}`);
  if (!res.ok) throw new Error("Failed to load status");
  return res.json();
}

async function punch(userId, recordType, photoBase64) {
  const res = await fetch(`${API_BASE}/api/kiosk/punch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, recordType, photoBase64 }),
  });
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
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  });
}

function getActionLabel(recordType) {
  switch (recordType) {
    case "CLOCK_IN":    return "出勤";
    case "CLOCK_OUT":   return "退勤";
    case "BREAK_START": return "休憩開始";
    case "BREAK_END":   return "休憩終了";
    default:            return recordType;
  }
}

function getActionColor(recordType) {
  switch (recordType) {
    case "CLOCK_IN":    return "#16a34a";
    case "CLOCK_OUT":   return "#dc2626";
    case "BREAK_START": return "#d97706";
    case "BREAK_END":   return "#2563eb";
    default:            return "#475569";
  }
}

function getAvailableActions(status) {
  switch (status) {
    case "NOT_STARTED": return ["CLOCK_IN"];
    case "WORKING":     return ["BREAK_START", "CLOCK_OUT"];
    case "ON_BREAK":    return ["BREAK_END"];
    case "FINISHED":    return [];
    default:            return [];
  }
}

function getStatusLabel(status) {
  switch (status) {
    case "NOT_STARTED": return { label: "未出勤", color: "#94a3b8" };
    case "WORKING":     return { label: "出勤中", color: "#16a34a" };
    case "ON_BREAK":    return { label: "休憩中", color: "#d97706" };
    case "FINISHED":    return { label: "退勤済", color: "#dc2626" };
    default:            return { label: "",       color: "#94a3b8" };
  }
}

/* ─── Clock ─────────────────────────────────────────────── */
function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const date = now.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
    timeZone: "Asia/Tokyo",
  });
  const time = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  return (
    <div style={{ textAlign: "center", color: "#fff" }}>
      <div style={{ fontSize: 18, opacity: 0.8, marginBottom: 4 }}>{date}</div>
      <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace" }}>{time}</div>
    </div>
  );
}

/* ─── Screen 1: Staff list ──────────────────────────────── */
function StaffListScreen({ onSelect }) {
  const [staff, setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
      <Clock />

      <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
        名前をタップしてください
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>読み込み中...</div>
      )}
      {error && (
        <div style={{ color: "#fca5a5", fontSize: 14 }}>エラー: {error}</div>
      )}

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16,
        justifyContent: "center", maxWidth: 800, width: "100%",
      }}>
        {staff.map(s => (
          <button key={s.id} onClick={() => onSelect(s)}
            style={{
              width: 160, height: 80,
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: 16, color: "#fff",
              fontSize: 18, fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
              backdropFilter: "blur(8px)",
            }}
            onTouchStart={e => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
            onTouchEnd={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
          >
            {s.fullName}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Screen 2: Action select ───────────────────────────── */
function ActionScreen({ staff, onAction, onBack }) {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetchStatus(staff.id)
      .then(setStatus)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [staff.id]);

  const actions = status ? getAvailableActions(status.status) : [];
  const sl      = status ? getStatusLabel(status.status) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
      <Clock />

      {/* Имя сотрудника */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}>{staff.fullName}</div>
        {sl && (
          <div style={{
            display: "inline-block", marginTop: 8,
            padding: "4px 16px", borderRadius: 20,
            background: sl.color + "33", border: `1px solid ${sl.color}`,
            color: sl.color, fontSize: 14, fontWeight: 700,
          }}>
            {sl.label}
          </div>
        )}
      </div>

      {/* Время прихода/ухода */}
      {status && (
        <div style={{
          display: "flex", gap: 24,
          color: "rgba(255,255,255,0.6)", fontSize: 14,
        }}>
          {status.clockInAt  && <span>出勤 {formatTime(status.clockInAt)}</span>}
          {status.breakStartAt && <span>休憩開始 {formatTime(status.breakStartAt)}</span>}
          {status.breakEndAt && <span>休憩終了 {formatTime(status.breakEndAt)}</span>}
          {status.clockOutAt && <span>退勤 {formatTime(status.clockOutAt)}</span>}
        </div>
      )}

      {loading && <div style={{ color: "rgba(255,255,255,0.5)" }}>読み込み中...</div>}
      {error   && <div style={{ color: "#fca5a5" }}>エラー: {error}</div>}

      {/* Кнопки действий */}
      {actions.length === 0 && status?.status === "FINISHED" && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }}>
          本日の退勤打刻は完了しています
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {actions.map(action => (
          <button key={action} onClick={() => onAction(action)}
            style={{
              width: 180, height: 100,
              background: getActionColor(action),
              border: "none", borderRadius: 20,
              color: "#fff", fontSize: 22, fontWeight: 800,
              cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              transition: "transform 0.1s",
            }}
            onTouchStart={e => e.currentTarget.style.transform = "scale(0.96)"}
            onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {getActionLabel(action)}
          </button>
        ))}
      </div>

      {/* Назад */}
      <button onClick={onBack} style={{
        marginTop: 8, background: "none",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 10, color: "rgba(255,255,255,0.6)",
        padding: "10px 28px", fontSize: 15, cursor: "pointer",
      }}>
        ← 戻る
      </button>
    </div>
  );
}

/* ─── Screen 3: Camera & confirm ────────────────────────── */
function CameraScreen({ staff, recordType, onDone, onBack }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [photo, setPhoto]       = useState(null);  // base64
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const [countdown, setCountdown] = useState(null);

  // Запуск камеры
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("カメラにアクセスできません"));

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Снять фото
  function takePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);

    // Сжатие до ~100KB
    const base64 = canvas.toDataURL("image/jpeg", 0.6);
    setPhoto(base64);
  }

  // Подтвердить и отправить
  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      const result = await punch(staff.id, recordType, photo);
      streamRef.current?.getTracks().forEach(t => t.stop());
      setSuccess({
        action: getActionLabel(recordType),
        time:   formatTime(result.recordedAt),
      });

      // Автовозврат через AUTO_RETURN_SEC секунд
      let sec = AUTO_RETURN_SEC;
      setCountdown(sec);
      const timer = setInterval(() => {
        sec--;
        setCountdown(sec);
        if (sec <= 0) { clearInterval(timer); onDone(); }
      }, 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Экран успеха
  if (success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ fontSize: 80 }}>✅</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{staff.fullName}</div>
        <div style={{
          fontSize: 36, fontWeight: 700,
          color: getActionColor(recordType),
        }}>
          {success.action}
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
          {success.time}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>
          {countdown}秒後に戻ります
        </div>
        <button onClick={onDone} style={{
          marginTop: 8, background: "rgba(255,255,255,0.15)",
          border: "none", borderRadius: 12,
          color: "#fff", padding: "12px 32px",
          fontSize: 16, cursor: "pointer",
        }}>
          今すぐ戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
        {staff.fullName} — {getActionLabel(recordType)}
      </div>

      {/* Камера или фото */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden",
        width: 320, height: 240, background: "#000" }}>
        {!photo ? (
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <img src={photo} alt="preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {error && <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div>}

      {/* Кнопки */}
      <div style={{ display: "flex", gap: 16 }}>
        {!photo ? (
          <button onClick={takePhoto} style={{
            width: 160, height: 60,
            background: "#2F5496", border: "none", borderRadius: 14,
            color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer",
          }}>
            📷 撮影
          </button>
        ) : (
          <>
            <button onClick={() => setPhoto(null)} style={{
              width: 120, height: 60,
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, cursor: "pointer",
            }}>
              撮り直す
            </button>
            <button onClick={confirm} disabled={loading} style={{
              width: 160, height: 60,
              background: getActionColor(recordType),
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}>
              {loading ? "..." : "✓ 確定"}
            </button>
          </>
        )}
      </div>

      {/* Пропустить фото */}
      <button onClick={async () => {
        setLoading(true);
        try {
          await punch(staff.id, recordType, null);
          streamRef.current?.getTracks().forEach(t => t.stop());
          onDone();
        } catch (e) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      }} style={{
        background: "none", border: "none",
        color: "rgba(255,255,255,0.4)", fontSize: 13,
        cursor: "pointer", padding: 0,
      }}>
        写真なしで{getActionLabel(recordType)}
      </button>

      <button onClick={onBack} style={{
        background: "none",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 10, color: "rgba(255,255,255,0.6)",
        padding: "10px 28px", fontSize: 15, cursor: "pointer",
      }}>
        ← 戻る
      </button>
    </div>
  );
}

/* ─── KioskPage ─────────────────────────────────────────── */
export default function KioskPage() {
  const [screen, setScreen]         = useState("staff");   // staff | action | camera
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);

  function handleSelectStaff(staff) {
    setSelectedStaff(staff);
    setScreen("action");
  }

  function handleSelectAction(action) {
    setSelectedAction(action);
    setScreen("camera");
  }

  function handleDone() {
    setSelectedStaff(null);
    setSelectedAction(null);
    setScreen("staff");
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
    }}>
      {/* Лого */}
      <div style={{
        position: "fixed", top: 20, left: 24,
        color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700,
        letterSpacing: 1,
      }}>
        HannoSHIFT
      </div>

      {screen === "staff" && (
        <StaffListScreen onSelect={handleSelectStaff} />
      )}
      {screen === "action" && selectedStaff && (
        <ActionScreen
          staff={selectedStaff}
          onAction={handleSelectAction}
          onBack={handleDone}
        />
      )}
      {screen === "camera" && selectedStaff && selectedAction && (
        <CameraScreen
          staff={selectedStaff}
          recordType={selectedAction}
          onDone={handleDone}
          onBack={() => setScreen("action")}
        />
      )}
    </div>
  );
}