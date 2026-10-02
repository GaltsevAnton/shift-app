import { useEffect, useState } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import shellStyles from "../../app/layouts/AppShell.module.css";

const ENTITY_TYPE_LABELS = {
  SHIFT:       "シフト",
  MONTH_STATUS: "月ステータス",
  EMPLOYEE:    "従業員",
  DEPARTMENT:  "部署",
  WORKPLACE:   "勤務場所",
  POSITION:    "職種・役職",
  BREAK_RULE:  "休憩ルール",
};

const ACTION_LABELS = {
  CREATE: "作成",
  UPDATE: "更新",
  DELETE: "削除",
};

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

export default function LoggingPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [logs, setLogs]       = useState([]);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const [from, setFrom]             = useState(() => daysAgoStr(30));
  const [to, setTo]                 = useState(() => todayStr());
  const [targetUserId, setTargetUserId] = useState("");
  const [entityType, setEntityType]     = useState("");
  const [expandedId, setExpandedId]     = useState(null);

  async function loadStaff() {
    try {
      const data = await api.managerEmployeesList();
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      // スタッフ一覧が取れなくてもログ自体は表示できるので握りつぶす
    }
  }

  async function loadLogs() {
    setLoading(true); setErr("");
    try {
      const data = await api.auditLogSearch({
        from: from || undefined,
        to: to || undefined,
        targetUserId: targetUserId || undefined,
        entityType: entityType || undefined,
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { loadLogs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() {
    setFrom(daysAgoStr(30));
    setTo(todayStr());
    setTargetUserId("");
    setEntityType("");
  }

  function parsedDetails(log) {
    if (!log.details) return null;
    try { return JSON.parse(log.details); } catch { return null; }
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={shellStyles.centeredContent}>
      <div style={{ maxWidth: 1100, width: "100%" }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1d2e" }}>📝 Logging</div>
          <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
            誰が・いつ・何を変更したかの履歴
          </div>
        </div>

        {/* ── フィルター ── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <Field label="開始日">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="終了日">
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="対象スタッフ">
              <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                <option value="">— すべて —</option>
                {staff
                  .slice()
                  .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ja"))
                  .map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </Field>
            <Field label="種類">
              <select value={entityType} onChange={e => setEntityType(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                <option value="">— すべて —</option>
                {Object.entries(ENTITY_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </Field>
            <button onClick={loadLogs} style={btnPrimaryStyle} type="button" disabled={loading}>
              {loading ? "検索中..." : "🔍 検索"}
            </button>
            <button onClick={handleReset} style={btnSecondaryStyle} type="button">
              リセット
            </button>
          </div>
        </div>

        {err && (
          <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* ── リスト ── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={cardTitleStyle}>変更履歴</div>
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              {loading ? "..." : `${logs.length} 件`}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#aaa" }}>読み込み中...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#aaa" }}>
              該当する履歴がありません
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.map(log => {
                const details = expandedId === log.id ? parsedDetails(log) : null;
                return (
                  <div key={log.id} style={{
                    border: "1px solid #f0f1f6", borderRadius: 10,
                    padding: "12px 16px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={badgeStyle(log.action)}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                          <span style={{
                            fontSize: 12, color: "#6366f1", background: "#ede9fe",
                            padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                          }}>
                            {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                          </span>
                          {log.targetUserName && (
                            <span style={{ fontSize: 12, color: "#475569" }}>
                              👤 {log.targetUserName}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, color: "#1a1d2e", lineHeight: 1.5 }}>
                          {log.summary}
                        </div>
                        {details && (
                          <pre style={{
                            marginTop: 8, padding: 10, background: "#f8fafc",
                            borderRadius: 8, fontSize: 11, color: "#475569",
                            overflowX: "auto", whiteSpace: "pre-wrap",
                          }}>
                            {JSON.stringify(details, null, 2)}
                          </pre>
                        )}
                        {log.details && (
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            style={{
                              marginTop: 6, background: "none", border: "none",
                              color: "#6366f1", fontSize: 12, cursor: "pointer", padding: 0,
                            }}
                            type="button"
                          >
                            {expandedId === log.id ? "詳細を閉じる" : "詳細を見る"}
                          </button>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {fmtDateTime(log.createdAt)}
                        </div>
                        <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginTop: 2 }}>
                          {log.actorName}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </ManagerLayout>
  );
}

function badgeStyle(action) {
  const colors = {
    CREATE: { bg: "#dcfce7", fg: "#166534" },
    UPDATE: { bg: "#e0f2fe", fg: "#0369a1" },
    DELETE: { bg: "#fee2e2", fg: "#991b1b" },
  };
  const c = colors[action] || { bg: "#f1f5f9", fg: "#64748b" };
  return {
    display: "inline-block", fontSize: 11, fontWeight: 700,
    color: c.fg, background: c.bg, padding: "2px 8px", borderRadius: 20,
  };
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#555" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const cardStyle = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14,
  boxShadow: "0 6px 20px rgba(20,20,40,0.06)", padding: 20, marginBottom: 16,
};
const cardTitleStyle = { fontSize: 17, fontWeight: 800, color: "#1a1d2e" };
const inputStyle = { padding: "8px 10px", border: "1px solid #e0e0e8", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };
const btnPrimaryStyle = { padding: "8px 16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnSecondaryStyle = { padding: "8px 14px", background: "#f0f1f6", color: "#444", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" };