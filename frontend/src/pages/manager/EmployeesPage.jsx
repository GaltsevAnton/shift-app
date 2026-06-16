import { useEffect, useState } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import shellStyles from "../../app/layouts/AppShell.module.css";

const emptyCreate = { login: "", fullName: "", position: "", departmentIds: [], role: "STAFF", password: "" };

export default function EmployeesPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [items, setItems]           = useState([]);
  const [positions, setPositions]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");

  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editId, setEditId]         = useState(null);
  const [editForm, setEditForm]     = useState({
    login: "", fullName: "", fullNameKana: "", position: "", departmentIds: [], role: "STAFF", active: true, password: "",
  });

  async function load() {
    setErr(""); setLoading(true);
    try {
      const [data, pos, deps] = await Promise.all([
        api.managerEmployeesList(),
        api.settingsPositionsList(),
        api.settingsDepartmentsList(),
      ]);
      setItems(Array.isArray(data) ? data : []);
      setPositions(Array.isArray(pos) ? pos : []);
      setDepartments(Array.isArray(deps) ? deps : []);
    } catch (e) {
      setErr(e.message || "Load error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e) {
    e.preventDefault(); setErr("");
    try {
      await api.managerEmployeesCreate({
        login:         createForm.login.trim(),
        fullName:      createForm.fullName.trim(),
        position:      createForm.position || null,
        departmentIds: createForm.departmentIds,
        role:          createForm.role,
        password:      createForm.password,
      });
      setCreateForm(emptyCreate);
      await load();
    } catch (e2) { setErr(e2.message || "Create error"); }
  }

  function startEdit(emp) {
    setEditId(emp.id);
    setEditForm({
      login:         emp.login      || "",
      fullName:      emp.fullName   || "",
      fullNameKana:  emp.fullNameKana || "",
      position:      emp.position   || "",
      departmentIds: (emp.departments || []).map(d => d.id),
      role:          emp.role       || "STAFF",
      active:        !!emp.active,
      password:      "",
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({ login: "", fullName: "", position: "", departmentIds: [], role: "STAFF", active: true, password: "" });
  }

  async function onUpdate(e) {
    e.preventDefault(); setErr("");
    try {
      await api.managerEmployeesUpdate(editId, {
        login:         editForm.login.trim(),
        fullName:      editForm.fullName.trim(),
        fullNameKana:  editForm.fullNameKana || null,
        position:      editForm.position   || null,
        departmentIds: editForm.departmentIds,
        role:          editForm.role,
        active:        !!editForm.active,
        password:      editForm.password,
      });
      cancelEdit();
      await load();
    } catch (e2) { setErr(e2.message || "Update error"); }
  }

  async function onDelete(id) {
    if (!window.confirm("削除しますか？")) return;
    setErr("");
    try { await api.managerEmployeesDelete(id); await load(); }
    catch (e2) { setErr(e2.message || "Delete error"); }
  }

  /* ── PositionSelect ── */
  function PositionSelect({ value, onChange }) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
        <option value="">— 未選択 —</option>
        {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
    );
  }

  /* ── DepartmentCheckboxes ── */
  function DepartmentCheckboxes({ selectedIds, onChange }) {
    function toggle(id) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id];
      onChange(next);
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 2 }}>
        {departments.map(d => (
          <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedIds.includes(d.id)}
              onChange={() => toggle(d.id)}
              style={{ accentColor: "#6366f1", width: 15, height: 15 }}
            />
            {d.name}
          </label>
        ))}
        {departments.length === 0 && (
          <span style={{ fontSize: 12, color: "#aaa" }}>設定 → 部署 で追加してください</span>
        )}
      </div>
    );
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={shellStyles.centeredContent}>
      <div style={{ maxWidth: 960, width: "100%" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1d2e" }}>👥 従業員管理</div>
          <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>アカウントの作成・編集・削除</div>
        </div>

        {err && (
          <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* ── Create form ── */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>新規作成</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Login *">
              <input value={createForm.login} onChange={e => setCreateForm({ ...createForm, login: e.target.value })} style={inputStyle} placeholder="login" />
            </Field>
            <Field label="フルネーム *">
              <input value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} style={inputStyle} placeholder="山田 太郎" />
            </Field>
            <Field label="フリガナ（カタカナ）">
              <input
                value={createForm.fullNameKana || ""} onChange={e => setCreateForm({ ...createForm, fullNameKana: e.target.value })} style={inputStyle} placeholder="ヤマダ タロウ"/>
            </Field>
            <Field label="職種・役職">
              <PositionSelect value={createForm.position} onChange={v => setCreateForm({ ...createForm, position: v })} />
            </Field>
            <Field label="ロール">
              <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={inputStyle}>
                <option value="STAFF">STAFF</option>
                <option value="MANAGER">MANAGER</option>
                <option value="KIOSK">KIOSK</option>
              </select>
            </Field>
            <Field label="パスワード *">
              <input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} style={inputStyle} placeholder="••••••••" />
            </Field>
          </div>
          {/* 部署 — отдельная строка на всю ширину */}
          <div style={{ marginTop: 12 }}>
            <Field label="部署">
              <DepartmentCheckboxes
                selectedIds={createForm.departmentIds}
                onChange={ids => setCreateForm({ ...createForm, departmentIds: ids })}
              />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <button onClick={onCreate} style={btnPrimaryStyle} type="button"
              disabled={!createForm.login || !createForm.fullName || !createForm.password}>
              ＋ 作成
            </button>
          </div>
        </div>

        {/* ── List ── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={cardTitleStyle}>スタッフ一覧</div>
            <button onClick={load} disabled={loading} style={btnSecondaryStyle} type="button">
              {loading ? "..." : "更新"}
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f1f6" }}>
                {["ID", "フルネーム", "Login", "職種・役職", "部署", "ロール", "状態", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(emp => (
                editId === emp.id ? (
                  <tr key={emp.id} style={{ background: "#f8f8ff" }}>
                    <td style={tdStyle} colSpan={8}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, padding: "10px 0" }}>
                        <Field label="Login">
                          <input value={editForm.login} onChange={e => setEditForm({ ...editForm, login: e.target.value })} style={inputStyle} />
                        </Field>
                        <Field label="フルネーム">
                          <input value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} style={inputStyle} />
                        </Field>
                        <Field label="フリガナ（カタカナ）">
                          <input value={editForm.fullNameKana} onChange={e => setEditForm({ ...editForm, fullNameKana: e.target.value })} style={inputStyle} />
                        </Field>
                        <Field label="職種・役職">
                          <PositionSelect value={editForm.position} onChange={v => setEditForm({ ...editForm, position: v })} />
                        </Field>
                        <Field label="ロール">
                          <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={inputStyle}>
                            <option value="STAFF">STAFF</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="KIOSK">KIOSK</option>
                          </select>
                        </Field>
                        <Field label="新しいパスワード">
                          <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="変更なし" style={inputStyle} />
                        </Field>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <Field label="部署">
                          <DepartmentCheckboxes
                            selectedIds={editForm.departmentIds}
                            onChange={ids => setEditForm({ ...editForm, departmentIds: ids })}
                          />
                        </Field>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
                        <input type="checkbox" checked={editForm.active} onChange={e => setEditForm({ ...editForm, active: e.target.checked })} />
                        アクティブ
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={onUpdate} style={btnPrimaryStyle} type="button">保存</button>
                        <button onClick={cancelEdit} style={btnSecondaryStyle} type="button">キャンセル</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #f0f1f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafe"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={tdStyle}><span style={{ color: "#aaa", fontSize: 12 }}>#{emp.id}</span></td>
                    <td style={tdStyle}><b>{emp.fullName}</b></td>
                    <td style={tdStyle}><span style={{ color: "#666" }}>{emp.login}</span></td>
                    <td style={tdStyle}>
                      {emp.position
                        ? <span style={{ fontSize: 12, color: "#475569", background: "#f1f5f9", padding: "2px 8px", borderRadius: 20 }}>{emp.position}</span>
                        : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td style={tdStyle}>
                      {emp.departments && emp.departments.length > 0
                        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {emp.departments.map(d => (
                              <span key={d.id} style={{ fontSize: 12, color: "#6366f1", background: "#ede9fe", padding: "2px 8px", borderRadius: 20 }}>
                                {d.name}
                              </span>
                            ))}
                          </div>
                        : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: emp.role === "MANAGER" ? "#ede9fe" : "#e0f2fe",
                        color: emp.role === "MANAGER" ? "#7c3aed" : "#0369a1",
                      }}>
                        {emp.role}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: emp.active ? "#dcfce7" : "#fee2e2",
                        color: emp.active ? "#166534" : "#991b1b",
                      }}>
                        {emp.active ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => startEdit(emp)} style={btnSecondaryStyle} type="button">編集</button>
                        <button onClick={() => onDelete(emp.id)} style={btnDangerStyle} type="button">削除</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>スタッフがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </ManagerLayout>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#555" }}>
      {label}
      {children}
    </label>
  );
}

const cardStyle = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14,
  boxShadow: "0 6px 20px rgba(20,20,40,0.06)", padding: 20, marginBottom: 16,
};
const cardTitleStyle = { fontSize: 17, fontWeight: 800, color: "#1a1d2e", marginBottom: 14 };
const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #e0e0e8", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };
const thStyle = { textAlign: "left", padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" };
const tdStyle = { padding: "12px 12px", verticalAlign: "middle", fontSize: 14 };
const btnPrimaryStyle = { padding: "8px 16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnSecondaryStyle = { padding: "8px 14px", background: "#f0f1f6", color: "#444", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnDangerStyle = { padding: "8px 14px", background: "#fee2e2", color: "#c0392b", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" };