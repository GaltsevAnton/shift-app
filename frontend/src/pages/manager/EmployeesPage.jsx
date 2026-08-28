import { useEffect, useState, useRef } from "react";
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
  unlockAccount: false,
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
    setEditingLockInfo(null);
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
      unlockAccount: false,
    });
    setEditingLockInfo({ accountLocked: !!emp.accountLocked, lockLevel: emp.lockLevel || 0 });
    setFormErr("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setEditingLockInfo(null);
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
        if (form.unlockAccount) {
          await api.managerEmployeesUnlock(editId);
        }
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

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [unlocking, setUnlocking] = useState(null);
  const [editingLockInfo, setEditingLockInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [sortConfig, setSortConfig] = useState({ field: null, dir: "asc" });
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [visiblePositions, setVisiblePositions] = useState(null);   // null = すべて表示
  const [visibleDepartments, setVisibleDepartments] = useState(null);
  const [visibleRoles, setVisibleRoles] = useState(null);
  const [visibleStatuses, setVisibleStatuses] = useState(null);

  function handleSort(field) {
    setSortConfig(prev => ({
      field,
      dir: prev.field === field ? (prev.dir === "asc" ? "desc" : "asc") : "asc",
    }));
  }

  async function handleUnlock(id) {
    setUnlocking(id);
    setErr("");
    try {
      await api.managerEmployeesUnlock(id);
      await load();
    } catch (e) {
      setErr(e.message || "Unlock error");
    } finally {
      setUnlocking(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirm) return;
    setErr("");
    try {
      await api.managerEmployeesDelete(deleteConfirm);
      setDeleteConfirm(null);
      await load();
    } catch (e2) {
      setErr(e2.message || "Delete error");
      setDeleteConfirm(null);
    }
  }

  const positionOptions = [...new Set(items.map(e => e.position || "").filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .map(p => ({ value: p, label: p }));

  const departmentOptions = [...new Set(items.flatMap(e => (e.departments || []).map(d => d.name)))]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .map(d => ({ value: d, label: d }));

  const roleOptions = [...new Set(items.map(e => e.role).filter(Boolean))]
    .map(r => ({ value: r, label: r }));

  const statusOptions = [
    { value: "ON",  label: "ON" },
    { value: "OFF", label: "OFF" },
  ];

  const filteredItems = items
    .filter(emp => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const fullName = `${emp.lastName || ""} ${emp.firstName || ""}`.toLowerCase();
        const fullNameKana = `${emp.lastNameKana || ""} ${emp.firstNameKana || ""}`.toLowerCase();
        const login = (emp.login || "").toLowerCase();
        if (!fullName.includes(q) && !fullNameKana.includes(q) && !login.includes(q)) return false;
      }
      if (visiblePositions && !visiblePositions.has(emp.position || "")) return false;
      if (visibleDepartments) {
        const names = (emp.departments || []).map(d => d.name);
        if (!names.some(n => visibleDepartments.has(n))) return false;
      }
      if (visibleRoles && !visibleRoles.has(emp.role)) return false;
      if (visibleStatuses) {
        const st = emp.active ? "ON" : "OFF";
        if (!visibleStatuses.has(st)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortConfig.field) return 0;
      let va, vb;
      if (sortConfig.field === "id") { va = a.id; vb = b.id; }
      else if (sortConfig.field === "name")  { va = `${a.lastName || ""}${a.firstName || ""}`; vb = `${b.lastName || ""}${b.firstName || ""}`; }
      else if (sortConfig.field === "login") { va = a.login || ""; vb = b.login || ""; }
      if (typeof va === "number") return (sortConfig.dir === "asc" ? 1 : -1) * (va - vb);
      return (sortConfig.dir === "asc" ? 1 : -1) * String(va).localeCompare(String(vb), "ja");
    });

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="氏名・ログインIDで検索..."
              style={{
                padding: "8px 14px", fontSize: 13,
                border: "1.5px solid #e0e0e8", borderRadius: 8,
                outline: "none", background: "#fff",
                width: 200,
              }}
            />
            <button onClick={openCreate} style={btnPrimaryStyle} type="button">
              ＋ 新規作成
            </button>
          </div>
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
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              {loading ? "..." : `表示中: ${filteredItems.length} / ${items.length} 人`}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f1f6" }}>
                <SortableTh label="ID"    field="id"    sortConfig={sortConfig} onSort={handleSort} />
                <SortableTh label="氏名"  field="name"  sortConfig={sortConfig} onSort={handleSort} />
                <SortableTh label="Login" field="login" sortConfig={sortConfig} onSort={handleSort} />
                <FilterTh
                  label="職種・役職"
                  options={positionOptions}
                  visibleSet={visiblePositions}
                  onChange={setVisiblePositions}
                  isOpen={openFilterCol === "position"}
                  onToggleOpen={open => setOpenFilterCol(open ? "position" : null)}
                />
                <FilterTh
                  label="部署"
                  options={departmentOptions}
                  visibleSet={visibleDepartments}
                  onChange={setVisibleDepartments}
                  isOpen={openFilterCol === "department"}
                  onToggleOpen={open => setOpenFilterCol(open ? "department" : null)}
                />
                <FilterTh
                  label="ロール"
                  options={roleOptions}
                  visibleSet={visibleRoles}
                  onChange={setVisibleRoles}
                  isOpen={openFilterCol === "role"}
                  onToggleOpen={open => setOpenFilterCol(open ? "role" : null)}
                />
                <FilterTh
                  label="状態"
                  options={statusOptions}
                  visibleSet={visibleStatuses}
                  onChange={setVisibleStatuses}
                  isOpen={openFilterCol === "status"}
                  onToggleOpen={open => setOpenFilterCol(open ? "status" : null)}
                />
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(emp => (
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: emp.active ? "#dcfce7" : "#fee2e2",
                        color: emp.active ? "#166534" : "#991b1b",
                      }}>
                        {emp.active ? "ON" : "OFF"}
                      </span>
                      {emp.accountLocked && (
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: "#fef3c7", color: "#92400e",
                        }}>
                          🔒 ロック中
                        </span>
                      )}
                      {!emp.accountLocked && emp.lockLevel > 0 && (
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: "#f1f5f9", color: "#64748b",
                        }}>
                          ⚠ 一時ロック（{lockLevelLabel(emp.lockLevel)}）
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(emp)} style={btnSecondaryStyle} type="button">編集</button>
                      <button onClick={() => setDeleteConfirm(emp.id)} style={btnDangerStyle} type="button">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>
                  {items.length === 0 ? "スタッフがいません" : "該当するスタッフが見つかりません"}
                </td></tr>
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
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: editingLockInfo && (editingLockInfo.accountLocked || editingLockInfo.lockLevel > 0) ? 8 : 20, cursor: "pointer" }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                アクティブ
              </label>
            )}

            {editId && editingLockInfo && (editingLockInfo.accountLocked || editingLockInfo.lockLevel > 0) && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 20, cursor: "pointer" }}>
                <input type="checkbox" checked={form.unlockAccount} onChange={e => setForm({ ...form, unlockAccount: e.target.checked })} />
                🔓 ロックを解除する（現在：{editingLockInfo.accountLocked ? "永久ロック" : `一時ロック（${lockLevelLabel(editingLockInfo.lockLevel)}）`}）
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

      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 3000,
          background: "rgba(15,23,42,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 32,
            maxWidth: 420, width: "90%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1d2e", marginBottom: 12 }}>
              本当に削除しますか？
            </div>
            <div style={{
              fontSize: 13, color: "#64748b", lineHeight: 1.7,
              marginBottom: 24, background: "#fef2f2",
              border: "1px solid #fca5a5", borderRadius: 10,
              padding: "12px 16px",
            }}>
              このスタッフを削除すると、<br />
              <strong style={{ color: "#dc2626" }}>すべてのシフトデータと打刻記録</strong>も<br />
              完全に削除されます。<br />
              この操作は取り消せません。
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ ...btnSecondaryStyle, padding: "10px 24px", fontSize: 14 }}
                type="button"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirmed}
                style={{
                  padding: "10px 24px", fontSize: 14, fontWeight: 700,
                  background: "#dc2626", color: "#fff",
                  border: "none", borderRadius: 8, cursor: "pointer",
                }}
                type="button"
              >
                完全に削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

function lockLevelLabel(level) {
  switch (level) {
    case 1: return "10分";
    case 2: return "30分";
    case 3: return "3時間";
    default: return "";
  }
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

function SortableTh({ label, field, sortConfig, onSort }) {
  const isActive = sortConfig.field === field;
  return (
    <th style={{ ...thStyle, cursor: "pointer", userSelect: "none" }} onClick={() => onSort(field)}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: isActive ? "#6366f1" : undefined }}>
        {label}
        <span style={{ fontSize: 11, color: isActive ? "#6366f1" : "#ccc" }}>
          {isActive ? (sortConfig.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

function FilterTh({ label, options, visibleSet, onChange, isOpen, onToggleOpen }) {
  const ref = useRef();

  useEffect(() => {
    if (!isOpen) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onToggleOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const allOn = visibleSet === null || (options.length > 0 && options.every(o => visibleSet.has(o.value)));
  const isFiltered = !allOn;

  function toggleOption(value) {
    const base = visibleSet === null ? new Set(options.map(o => o.value)) : new Set(visibleSet);
    base.has(value) ? base.delete(value) : base.add(value);
    onChange(base.size >= options.length ? null : base);
  }
  function toggleAll() {
    onChange(allOn ? new Set() : null);
  }

  return (
    <th style={{ ...thStyle, position: "relative" }}>
      <span
        onClick={() => onToggleOpen(!isOpen)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          cursor: "pointer", userSelect: "none",
          color: isFiltered ? "#6366f1" : undefined,
        }}
      >
        {label}
        <span style={{ fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
      </span>
      {isOpen && (
        <div ref={ref} style={{
          position: "absolute", top: "100%", left: 0, zIndex: 500, marginTop: 4,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "6px 0",
          minWidth: 160, textAlign: "left", fontWeight: 400, textTransform: "none",
          letterSpacing: "normal",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#334155" }}>
            <input type="checkbox" checked={allOn} onChange={toggleAll} />
            すべて
          </label>
          <div style={{ height: 1, background: "#f0f1f6", margin: "4px 0" }} />
          {options.map(o => (
            <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#475569" }}>
              <input
                type="checkbox"
                checked={visibleSet === null || visibleSet.has(o.value)}
                onChange={() => toggleOption(o.value)}
              />
              {o.label}
            </label>
          ))}
          {options.length === 0 && (
            <div style={{ padding: "6px 14px", fontSize: 12, color: "#aaa" }}>候補がありません</div>
          )}
        </div>
      )}
    </th>
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