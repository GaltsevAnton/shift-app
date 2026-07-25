import { useEffect, useState } from "react";
import { clearToken, getToken } from "../shared/api/api";
import Login from "../pages/auth/LoginPage";
import ManagerTablePage from "../pages/manager/ManagerTablePage";
// import ManagerWeekPage from "../pages/manager/ManagerWeekPage";
import StaffMonthPage from "../pages/staff/StaffMonthPage";
import EmployeesPage from "../pages/manager/EmployeesPage";
import SettingsPage from "../pages/manager/SettingsPage";
import AttendancePage from "../pages/manager/AttendancePage";

/* ─── Определение платформы ─────────────────────────────── */
function getInstallHint() {
  // Уже установлено как PWA
  if (window.navigator.standalone) return null;
  if (window.matchMedia("(display-mode: standalone)").matches) return null;
  // Уже закрыл подсказку
  if (localStorage.getItem("installBannerDismissed")) return null;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Chromium/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

  if (isIOS && isSafari) return "ios-safari";
  if (isIOS && isChrome) return "ios-chrome";
  if (isAndroid && isChrome) return "android-chrome";
  return null;
}

/* ─── Локализация ───────────────────────────────────────── */
const BANNER_I18N = {
  ja: {
    "ios-safari": {
      icon: "📲",
      title: "ホーム画面に追加",
      steps: [
        "下の 共有ボタン（□↑）をタップ",
        "「ホーム画面に追加」を選択",
        "「追加」をタップして完了",
      ],
    },
    "ios-chrome": {
      icon: "📲",
      title: "ホーム画面に追加",
      steps: [
        "アドレスバーの 共有アイコン をタップ",
        "「その他」を選択",
        "「ホーム画面に追加」をタップして完了",
      ],
    },
    "android-chrome": {
      icon: "📲",
      title: "アプリをインストール",
      installBtn: "📲 アプリをインストール",
      steps: [
        "右上の ⋮ メニューをタップ",
        "「アプリをインストール」を選択",
      ],
    },
    dismiss: "次回から表示しない",
  },
  en: {
    "ios-safari": {
      icon: "📲",
      title: "Add to Home Screen",
      steps: [
        "Tap the Share button (□↑) at the bottom",
        "Select \"Add to Home Screen\"",
        "Tap \"Add\" to finish",
      ],
    },
    "ios-chrome": {
      icon: "📲",
      title: "Add to Home Screen",
      steps: [
        "Tap the Share icon in the address bar",
        "Select \"More\"",
        "Tap \"Add to Home Screen\" to finish",
      ],
    },
    "android-chrome": {
      icon: "📲",
      title: "Install App",
      installBtn: "📲 Install App",
      steps: [
        "Tap the ⋮ menu in the top right",
        "Select \"Install app\"",
      ],
    },
    dismiss: "Don't show again",
  },
};

function getBannerLang() {
  const lang = (navigator.language || "ja").slice(0, 2).toLowerCase();
  return lang === "ja" ? "ja" : "en";
}

/* ─── InstallBanner ─────────────────────────────────────── */
function InstallBanner() {
  const [hint, setHint] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const h = getInstallHint();
    if (!h) return;
    setHint(h);

    // Android Chrome — ловим событие установки
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Показываем баннер через 2 сек после загрузки
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem("installBannerDismissed", "1");
    setVisible(false);
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") dismiss();
    }
  }

  if (!visible || !hint) return null;

  const lang = getBannerLang();
  const t    = BANNER_I18N[lang];
  const msg  = t[hint];
  if (!msg) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      zIndex: 9999,
      background: "#1e293b",
      color: "#fff",
      padding: "16px 20px 20px",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
      borderRadius: "16px 16px 0 0",
      animation: "slideUp 0.3s ease",
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Закрыть */}
      <button
        onClick={dismiss}
        style={{
          position: "absolute", top: 12, right: 16,
          background: "rgba(255,255,255,0.15)", border: "none",
          color: "#fff", borderRadius: 6, width: 28, height: 28,
          fontSize: 14, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >✕</button>

      {/* Заголовок */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>{msg.icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{msg.title}</span>
      </div>

      {/* Шаги или кнопка */}
      {hint === "android-chrome" && deferredPrompt ? (
        <button
          onClick={handleInstall}
          style={{
            width: "100%", padding: "12px",
            background: "#2F5496", border: "none", borderRadius: 10,
            color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}
        >
          {msg.installBtn}
        </button>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          {msg.steps.map((step, i) => (
            <li key={i} style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
              {step}
            </li>
          ))}
        </ol>
      )}

      {/* Не показывать снова */}
      <button
        onClick={dismiss}
        style={{
          marginTop: 14, background: "none", border: "none",
          color: "#64748b", fontSize: 12, cursor: "pointer", padding: 0,
        }}
      >
        {t.dismiss}
      </button>
    </div>
  );
}

/* ─── App ───────────────────────────────────────────────── */
export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [managerView, setManagerView] = useState(
    localStorage.getItem("managerView") || "SHIFTS"
  );

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  function onLogout() {
    clearToken();
    setTokenState(null);
  }

  // Автологаут через 30 минут бездействия
  useEffect(() => {
    if (!token) return;

    const TIMEOUT = 30 * 60 * 1000;
    let timer = setTimeout(onLogout, TIMEOUT);

    function reset() {
      clearTimeout(timer);
      timer = setTimeout(onLogout, TIMEOUT);
    }

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, reset));

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [token]);

  function go(view) {
    localStorage.setItem("managerView", view);
    setManagerView(view);
  }

  if (!token) return (
    <>
      <InstallBanner />
      <Login onLoggedIn={() => setTokenState(getToken())} />
    </>
  );

  const role = localStorage.getItem("appRole") || "MANAGER";

  if (role === "STAFF") return (
    <>
      <InstallBanner />
      <StaffMonthPage onLogout={onLogout} />
    </>
  );

  if (managerView === "PREFS") return (
    <>
      <InstallBanner />
      <StaffMonthPage onLogout={onLogout} managerNav={{ view: managerView, onNavigate: go }} />
    </>
  );
  if (managerView === "EMPLOYEES") return (
    <>
      <InstallBanner />
      <EmployeesPage view={managerView} onNavigate={go} onLogout={onLogout} />
    </>
  );
  if (managerView === "SETTINGS") return (
    <>
      <InstallBanner />
      <SettingsPage view={managerView} onNavigate={go} onLogout={onLogout} />
    </>
  );
  if (managerView === "ATTENDANCE") return (
    <>
      <InstallBanner />
      <AttendancePage view={managerView} onNavigate={go} onLogout={onLogout} />
    </>
  );
  
  return (
    <>
      <InstallBanner />
      <ManagerTablePage key={token} view={managerView} onNavigate={go} onLogout={onLogout} />
    </>
  );
}