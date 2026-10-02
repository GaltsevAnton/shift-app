import ManagerLayout from "./ManagerLayout";
import shellStyles from "./AppShell.module.css";

/**
 * Заглушка вместо страницы, если нет прав.
 * Страница при этом вообще не монтируется — никаких запросов и кнопок.
 */
export default function AccessDenied({ view, onNavigate, onLogout, loading = false }) {
  const name = localStorage.getItem("staffName") || "manager";

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={shellStyles.centeredContent}>
        {loading ? (
          <div style={{ marginTop: 80, color: "#aaa", fontSize: 14 }}>読み込み中...</div>
        ) : (
          <div style={{
            marginTop: 80,
            maxWidth: 440, width: "100%",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 16,
            boxShadow: "0 6px 20px rgba(20,20,40,0.06)",
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1d2e", marginBottom: 10 }}>
              このページへのアクセスは制限されています
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.8 }}>
              このページを閲覧する権限がありません。<br />
              必要な場合は管理者にお問い合わせください。
            </div>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}