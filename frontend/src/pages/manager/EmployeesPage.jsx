import { useEffect, useState } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import shellStyles from "../../app/layouts/AppShell.module.css";

const REGIONS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const emptyForm = {
  login: "", password: "",
  lastName: "", firstName: "", lastNameKana: "", firstNameKana: "",
  email: "", phone: "",
  postalCode: "", region: "", municipality: "", blockNumber: "", building: "",
  birthDate: "", gender: "MALE",
  position: "", departmentIds: [], role: "STAFF", active: true,
};

export default function EmployeesPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [items, setItems]             = useState([]);
  const [positions, setPositions]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");

  const [modalOpen, setModalOpen]     = useState(false);
  const [editId, setEditId]           = useState(null); // null = создание
  const [form, setForm]               = useState(emptyForm);
  const [formErr, setFormErr]         = useState("");
  const [saving, setSaving]           = useState(false);

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

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setFormErr("");
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditId(emp.id);
    setForm({
      login: emp.login || "",
      password: "",
      lastName: emp.lastName || "",
      firstName: emp.firstName || "",
      lastNameKana: emp.lastNameKana || "",
      firstNameKana: emp.firstNameKana || "",
      email: emp.email || "",
      phone: emp.phone || "",
      postalCode: emp.postalCode || "",
      region: emp.region || "",
      municipality: emp.municipality || "",
      blockNumber: emp.blockNumber || "",
      building: emp.building || "",
      birthDate: emp.birthDate || "",
      gender: emp.gender || "MALE",
      position: emp.position || "",
      departmentIds: (emp.departments || []).map(d => d.id),
      role: emp.role || "STAFF",
      active: !!emp.active,
    });
    setFormErr("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setFormErr("");
  }

  function validate() {
    if (!form.login.trim())          return "ログインIDを入力してください";
    if (!editId && !form.password)   return "パスワードを入力してください";
    if (!form.lastName.trim())       return "姓を入力してください";
    if (!form.firstName.trim())      return "名を入力してください";
    if (!form.lastNameKana.trim())   return "姓（フリガナ）を入力してください";
    if (!form.firstNameKana.trim())  return "名（フリガナ）を入力してください";
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) { setFormErr(v); return; }
    setSaving(true); setFormErr("");

    const payload = {
      login: form.login.trim(),
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      lastNameKana: form.lastNameKana.trim(),
      firstNameKana: form.firstNameKana.trim(),
      email: form.email || null,
      phone: form.phone || null,
      postalCode: form.postalCode || null,
      region: form.region || null,
      municipality: form.municipality || null,
      blockNumber: form.blockNumber || null,
      building: form.building || null,
      birthDate: form.birthDate,
      gender: form.gender,
      position: form.position || null,
      departmentIds: form.departmentIds,
      role: form.role,
      password: form.password,
    };

    try {
      if (editId) {
        await api.managerEmployeesUpdate(editId, { ...payload, active: !!form.active });
      } else {
        await api.managerEmployeesCreate(payload);
      }
      closeModal();
      await load();
    } catch (e) {
      setFormErr(e.message || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    if (!window.confirm("削除しますか？")) return;
    setErr("");
    try { await api.managerEmployeesDelete(id); await load(); }
    catch (e2) { setErr(e2.message || "Delete error"); }
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
      <div style={{ maxWidth: 1100, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1d2e" }}>👥 従業員管理</div>
            <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>アカウントの作成・編集・削除</div>
          </div>
          <button onClick={openCreate} style={btnPrimaryStyle} type="button">
            ＋ 新規作成
          </button>
        </div>

        {err && (
          <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}

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
                {["ID", "氏名", "Login", "職種・役職", "部署", "ロール", "状態", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(emp => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #f0f1f6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafafe"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <td style={tdStyle}><span style={{ color: "#aaa", fontSize: 12 }}>#{emp.id}</span></td>
                  <td style={tdStyle}>
                    <b>{emp.lastName} {emp.firstName}</b>
                    {emp.lastNameKana && (
                      <div style={{ fontSize: 11, color: "#aaa" }}>{emp.lastNameKana} {emp.firstNameKana}</div>
                    )}
                  </td>
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
                      background: emp.role === "MANAGER" ? "#ede9fe" : emp.role === "KIOSK" ? "#fef3c7" : "#e0f2fe",
                      color: emp.role === "MANAGER" ? "#7c3aed" : emp.role === "KIOSK" ? "#92400e" : "#0369a1",
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
                      <button onClick={() => openEdit(emp)} style={btnSecondaryStyle} type="button">編集</button>
                      <button onClick={() => onDelete(emp.id)} style={btnDangerStyle} type="button">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>スタッフがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(15,23,42,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "#fff", borderRadius: 18, padding: 28,
            width: 720, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d2e", marginBottom: 4 }}>
              {editId ? "従業員を編集" : "従業員を新規作成"}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
              必須項目には <RequiredBadge /> が付いています
            </div>

            {formErr && (
              <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                {formErr}
              </div>
            )}

            {/* ── 名前 ── */}
            <SectionTitle>名前</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Field label="姓" required>
                <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} style={inputStyle} placeholder="山田" />
              </Field>
              <Field label="名" required>
                <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} style={inputStyle} placeholder="太郎" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Field label="姓（フリガナ）" required>
                <input value={form.lastNameKana} onChange={e => setForm({ ...form, lastNameKana: e.target.value })} style={inputStyle} placeholder="ヤマダ" />
              </Field>
              <Field label="名（フリガナ）" required>
                <input value={form.firstNameKana} onChange={e => setForm({ ...form, firstNameKana: e.target.value })} style={inputStyle} placeholder="タロウ" />
              </Field>
            </div>

            {/* ── 連絡先 ── */}
            <SectionTitle optional>連絡先</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Field label="メールアドレス">
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="mail@example.com" />
              </Field>
              <Field label="電話番号">
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="090-1234-5678" />
              </Field>
            </div>

            {/* ── 住所 ── */}
            <SectionTitle optional>住所</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Field label="郵便番号">
                <input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} style={inputStyle} placeholder="123-4567" />
              </Field>
              <Field label="都道府県">
                <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={inputStyle}>
                  <option value="">— 未選択 —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Field label="市区町村">
                <input value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })} style={inputStyle} placeholder="飯能市〇〇1-2-3" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Field label="番地">
                <input value={form.blockNumber} onChange={e => setForm({ ...form, blockNumber: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="建物名">
                <input value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} style={inputStyle} placeholder="〇〇マンション101" />
              </Field>
            </div>

            {/* ── 基本情報 ── */}
            <SectionTitle optional>基本情報</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Field label="生年月日">
                <input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="性別">
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="gender" checked={form.gender === "MALE"} onChange={() => setForm({ ...form, gender: "MALE" })} />
                    男性
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="gender" checked={form.gender === "FEMALE"} onChange={() => setForm({ ...form, gender: "FEMALE" })} />
                    女性
                  </label>
                </div>
              </Field>
            </div>

            {/* ── アカウント ── */}
            <SectionTitle>アカウント</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Field label="ログインID" required>
                <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} style={inputStyle} placeholder="login" />
              </Field>
              <Field label={editId ? "新しいパスワード" : "パスワード"} required={!editId}>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inputStyle} placeholder={editId ? "変更なし" : "••••••••"} />
              </Field>
            </div>

            {/* ── 業務情報 ── */}
            <SectionTitle>業務情報</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Field label="職種・役職">
                <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} style={inputStyle}>
                  <option value="">— 未選択 —</option>
                  {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="ロール" required>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                  <option value="STAFF">STAFF</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="KIOSK">KIOSK</option>
                </select>
              </Field>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Field label="部署">
                <DepartmentCheckboxes
                  selectedIds={form.departmentIds}
                  onChange={ids => setForm({ ...form, departmentIds: ids })}
                />
              </Field>
            </div>

            {editId && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 20, cursor: "pointer" }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                アクティブ
              </label>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={closeModal} style={btnSecondaryStyle} type="button">キャンセル</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimaryStyle, opacity: saving ? 0.6 : 1 }} type="button">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#555" }}>
      <span>{label} {required && <RequiredBadge />}</span>
      {children}
    </label>
  );
}

function RequiredBadge() {
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700, color: "#fff",
      background: "#ef4444", borderRadius: 4, padding: "1px 6px", marginLeft: 2,
      verticalAlign: "middle",
    }}>
      必須
    </span>
  );
}

function SectionTitle({ children, optional }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: "#64748b",
      borderBottom: "1px solid #f0f1f6", paddingBottom: 6, marginBottom: 12,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {children}
      {optional && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#64748b",
          background: "#f1f5f9", borderRadius: 4, padding: "1px 6px",
        }}>
          任意
        </span>
      )}
    </div>
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