import { useEffect, useState } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import shellStyles from "../../app/layouts/AppShell.module.css";

/* ─── shared styles ─────────────────────────────────────── */
const cardStyle = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 14,
  boxShadow: "0 6px 20px rgba(20,20,40,0.06)",
  padding: 20,
  marginBottom: 16,
};
const cardTitleStyle = {
  fontSize: 15, fontWeight: 800, color: "#1a1d2e", marginBottom: 14,
};
const inputStyle = {
  width: "100%", padding: "8px 10px", border: "1px solid #e0e0e8",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
};
const btnPrimaryStyle = {
  padding: "8px 16px",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff", border: "none", borderRadius: 8,
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const btnSecondaryStyle = {
  padding: "8px 14px", background: "#f0f1f6", color: "#444",
  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnDangerStyle = {
  padding: "6px 12px", background: "#fee2e2", color: "#c0392b",
  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const thStyle = {
  textAlign: "left", padding: "8px 10px", fontSize: 12,
  fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px",
};
const tdStyle = { padding: "10px 10px", verticalAlign: "middle" };

/* ─── Generic CRUD panel ────────────────────────────────── */
function MasterPanel({ title, hint, items, loading, err, onCreate, onUpdate, onDelete }) {
  const [newName, setNewName]   = useState("");
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState("");

  function startEdit(item) {
    setEditId(item.id);
    setEditName(item.name);
  }
  function cancelEdit() {
    setEditId(null);
    setEditName("");
  }

  return (
    <div>
      {err && (
        <div style={{
          background: "#ffe5e5", color: "#c0392b", padding: "10px 14px",
          borderRadius: 10, marginBottom: 16, fontSize: 13,
        }}>
          {err}
        </div>
      )}

      {/* Create */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>新規追加</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>
              名前 *
            </label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={inputStyle}
              placeholder={hint}
              onKeyDown={e => {
                if (e.key === "Enter" && newName.trim()) {
                  onCreate(newName.trim());
                  setNewName("");
                }
              }}
            />
          </div>
          <button
            style={btnPrimaryStyle}
            type="button"
            disabled={!newName.trim()}
            onClick={() => { onCreate(newName.trim()); setNewName(""); }}
          >
            ＋ 追加
          </button>
        </div>
      </div>

      {/* List */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={cardTitleStyle}>{title}一覧</div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#aaa" }}>読み込み中...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f1f6" }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>名前</th>
                <th style={{ ...thStyle, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                editId === item.id ? (
                  <tr key={item.id} style={{ background: "#f8f8ff", borderBottom: "1px solid #f0f1f6" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#aaa", fontSize: 12 }}>#{item.id}</span>
                    </td>
                    <td style={tdStyle} colSpan={2}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          style={{ ...inputStyle, maxWidth: 300 }}
                          onKeyDown={e => {
                            if (e.key === "Enter" && editName.trim()) {
                              onUpdate(item.id, editName.trim());
                              cancelEdit();
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          style={btnPrimaryStyle}
                          type="button"
                          disabled={!editName.trim()}
                          onClick={() => { onUpdate(item.id, editName.trim()); cancelEdit(); }}
                        >
                          保存
                        </button>
                        <button style={btnSecondaryStyle} type="button" onClick={cancelEdit}>
                          キャンセル
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #f0f1f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafe"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                  >
                    <td style={tdStyle}>
                      <span style={{ color: "#aaa", fontSize: 12 }}>#{item.id}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 13, color: "#1a1d2e", background: "#f1f5f9",
                        padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                      }}>
                        {item.name}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button style={btnSecondaryStyle} type="button" onClick={() => startEdit(item)}>
                          編集
                        </button>
                        <button style={btnDangerStyle} type="button" onClick={() => onDelete(item.id)}>
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>
                    まだ登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Workplaces tab ────────────────────────────────────── */
function WorkplacesTab() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try { setItems(await api.settingsWorkplacesList()); }
    catch (e) { setErr(e.message || "読み込みエラー"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(name) {
    setErr("");
    try { await api.settingsWorkplacesCreate({ name }); await load(); }
    catch (e) { setErr(e.message || "作成エラー"); }
  }

  async function onUpdate(id, name) {
    setErr("");
    try { await api.settingsWorkplacesUpdate(id, { name }); await load(); }
    catch (e) { setErr(e.message || "更新エラー"); }
  }

  async function onDelete(id) {
    if (!window.confirm("削除しますか？")) return;
    setErr("");
    try { await api.settingsWorkplacesDelete(id); await load(); }
    catch (e) { setErr(e.message || "削除エラー"); }
  }

  return (
    <MasterPanel
      title="勤務場所"
      hint="例：ホール1、フロント..."
      items={items}
      loading={loading}
      err={err}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}

/* ─── Positions tab ─────────────────────────────────────── */
function PositionsTab() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try { setItems(await api.settingsPositionsList()); }
    catch (e) { setErr(e.message || "読み込みエラー"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(name) {
    setErr("");
    try { await api.settingsPositionsCreate({ name }); await load(); }
    catch (e) { setErr(e.message || "作成エラー"); }
  }

  async function onUpdate(id, name) {
    setErr("");
    try { await api.settingsPositionsUpdate(id, { name }); await load(); }
    catch (e) { setErr(e.message || "更新エラー"); }
  }

  async function onDelete(id) {
    if (!window.confirm("削除しますか？")) return;
    setErr("");
    try { await api.settingsPositionsDelete(id); await load(); }
    catch (e) { setErr(e.message || "削除エラー"); }
  }

  return (
    <MasterPanel
      title="職種・役職"
      hint="例：フロントスタッフ、料理長..."
      items={items}
      loading={loading}
      err={err}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}

/* ─── Departments tab ───────────────────────────────────── */
function DepartmentsTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  async function load() {
    setLoading(true); setErr("");
    try { setItems(await api.settingsDepartmentsList()); }
    catch (e) { setErr(e.message || "読み込みエラー"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(name) {
    setErr("");
    try { await api.settingsDepartmentsCreate({ name }); await load(); }
    catch (e) { setErr(e.message || "作成エラー"); }
  }
  async function onUpdate(id, name) {
    setErr("");
    try { await api.settingsDepartmentsUpdate(id, { name }); await load(); }
    catch (e) { setErr(e.message || "更新エラー"); }
  }
  async function onDelete(id) {
    if (!window.confirm("削除しますか？")) return;
    setErr("");
    try { await api.settingsDepartmentsDelete(id); await load(); }
    catch (e) { setErr(e.message || "削除エラー"); }
  }

  return (
    <MasterPanel
      title="部署"
      hint="例：フロント、調理、事務所..."
      items={items} loading={loading} err={err}
      onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete}
    />
  );
}

/* ─── Main page ─────────────────────────────────────────── */
const TABS = [
  { key: "workplaces",  label: "勤務場所" },
  { key: "positions",   label: "職種・役職" },
  { key: "departments", label: "部署" },
];

export default function SettingsPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";
  const [tab, setTab] = useState("workplaces");

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={shellStyles.centeredContent}>
      <div style={{ maxWidth: 760, width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d2e" }}>設定</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
            マスターデータの管理
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 20,
          background: "#f0f1f6", borderRadius: 10, padding: 4, width: "fit-content",
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: "7px 18px",
                borderRadius: 7,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                background: tab === t.key ? "#fff" : "transparent",
                color: tab === t.key ? "#6366f1" : "#64748b",
                boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "workplaces"  && <WorkplacesTab />}
        {tab === "positions"   && <PositionsTab />}
        {tab === "departments" && <DepartmentsTab />}
      </div>
      </div>
    </ManagerLayout>
  );
}