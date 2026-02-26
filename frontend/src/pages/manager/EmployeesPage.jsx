// import { useEffect, useState } from "react";
// import { api } from "../../shared/api/api";

// const emptyCreate = { login: "", fullName: "", role: "STAFF", password: "" };

// export default function EmployeesPage() {
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");

//   const [createForm, setCreateForm] = useState(emptyCreate);

//   const [editId, setEditId] = useState(null);
//   const [editForm, setEditForm] = useState({
//     login: "",
//     fullName: "",
//     role: "STAFF",
//     active: true,
//     password: "",
//   });

//   async function load() {
//     setErr("");
//     setLoading(true);
//     try {
//       const data = await api.managerEmployeesList();
//       setItems(Array.isArray(data) ? data : []);
//     } catch (e) {
//       setErr(e.message || "Load error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => {
//     load();
//   }, []);

//   async function onCreate(e) {
//     e.preventDefault();
//     setErr("");

//     try {
//       await api.managerEmployeesCreate({
//         login: createForm.login.trim(),
//         fullName: createForm.fullName.trim(),
//         role: createForm.role,
//         password: createForm.password,
//       });
//       setCreateForm(emptyCreate);
//       await load();
//     } catch (e2) {
//       setErr(e2.message || "Create error");
//     }
//   }

//   function startEdit(emp) {
//     setEditId(emp.id);
//     setEditForm({
//       login: emp.login || "",
//       fullName: emp.fullName || "",
//       role: emp.role || "STAFF",
//       active: !!emp.active,
//       password: "", // пусто = не менять
//     });
//   }

//   function cancelEdit() {
//     setEditId(null);
//     setEditForm({ login: "", fullName: "", role: "STAFF", active: true, password: "" });
//   }

//   async function onUpdate(e) {
//     e.preventDefault();
//     setErr("");

//     try {
//       await api.managerEmployeesUpdate(editId, {
//         login: editForm.login.trim(),
//         fullName: editForm.fullName.trim(),
//         role: editForm.role,
//         active: !!editForm.active,
//         password: editForm.password, // пусто = не менять (backend уже это умеет)
//       });
//       cancelEdit();
//       await load();
//     } catch (e2) {
//       setErr(e2.message || "Update error");
//     }
//   }

//   async function onDelete(id) {
//     if (!window.confirm("Удалить сотрудника?")) return;
//     setErr("");

//     try {
//       await api.managerEmployeesDelete(id);
//       await load();
//     } catch (e2) {
//       setErr(e2.message || "Delete error");
//     }
//   }

//   return (
//     <div style={{ padding: 16, maxWidth: 900 }}>
//       <h2 style={{ margin: "0 0 12px" }}>Учетные записи сотрудников</h2>

//       {err && (
//         <div style={{ background: "#ffe5e5", padding: 10, borderRadius: 8, marginBottom: 12 }}>
//           {err}
//         </div>
//       )}

//       {/* Create */}
//       <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 16 }}>
//         <h3 style={{ marginTop: 0 }}>Создать</h3>

//         <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
//           <label>
//             Login
//             <input
//               value={createForm.login}
//               onChange={(e) => setCreateForm({ ...createForm, login: e.target.value })}
//               required
//               style={{ width: "100%", padding: 8 }}
//             />
//           </label>

//           <label>
//             Full name
//             <input
//               value={createForm.fullName}
//               onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
//               required
//               style={{ width: "100%", padding: 8 }}
//             />
//           </label>

//           <label>
//             Role
//             <select
//               value={createForm.role}
//               onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
//               style={{ width: "100%", padding: 8 }}
//             >
//               <option value="STAFF">STAFF</option>
//               <option value="MANAGER">MANAGER</option>
//             </select>
//           </label>

//           <label>
//             Password
//             <input
//               type="password"
//               value={createForm.password}
//               onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
//               required
//               style={{ width: "100%", padding: 8 }}
//             />
//           </label>

//           <button type="submit" style={{ padding: "10px 14px" }}>
//             Создать
//           </button>
//         </form>
//       </div>

//       {/* List */}
//       <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//           <h3 style={{ margin: 0 }}>Список</h3>
//           <button onClick={load} disabled={loading} style={{ padding: "8px 12px" }}>
//             {loading ? "Загрузка..." : "Обновить"}
//           </button>
//         </div>

//         <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
//           {items.map((emp) => (
//             <div key={emp.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
//               {editId === emp.id ? (
//                 <form onSubmit={onUpdate} style={{ display: "grid", gap: 10 }}>
//                   <div><b>ID:</b> {emp.id}</div>

//                   <label>
//                     Login
//                     <input
//                       value={editForm.login}
//                       onChange={(e) => setEditForm({ ...editForm, login: e.target.value })}
//                       required
//                       style={{ width: "100%", padding: 8 }}
//                     />
//                   </label>

//                   <label>
//                     Full name
//                     <input
//                       value={editForm.fullName}
//                       onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
//                       required
//                       style={{ width: "100%", padding: 8 }}
//                     />
//                   </label>

//                   <label>
//                     Role
//                     <select
//                       value={editForm.role}
//                       onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
//                       style={{ width: "100%", padding: 8 }}
//                     >
//                       <option value="STAFF">STAFF</option>
//                       <option value="MANAGER">MANAGER</option>
//                     </select>
//                   </label>

//                   <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
//                     <input
//                       type="checkbox"
//                       checked={editForm.active}
//                       onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
//                     />
//                     Active
//                   </label>

//                   <label>
//                     New password (optional)
//                     <input
//                       type="password"
//                       value={editForm.password}
//                       onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
//                       placeholder="Оставь пустым, чтобы не менять"
//                       style={{ width: "100%", padding: 8 }}
//                     />
//                   </label>

//                   <div style={{ display: "flex", gap: 8 }}>
//                     <button type="submit" style={{ padding: "8px 12px" }}>
//                       Сохранить
//                     </button>
//                     <button type="button" onClick={cancelEdit} style={{ padding: "8px 12px" }}>
//                       Отмена
//                     </button>
//                   </div>
//                 </form>
//               ) : (
//                 <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
//                   <div>
//                     <div><b>{emp.fullName}</b></div>
//                     <div style={{ opacity: 0.8 }}>login: {emp.login}</div>
//                     <div style={{ opacity: 0.8 }}>
//                       role: {emp.role} • active: {String(emp.active)}
//                     </div>
//                   </div>

//                   <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//                     <button onClick={() => startEdit(emp)} style={{ padding: "8px 12px" }}>
//                       Редактировать
//                     </button>
//                     <button onClick={() => onDelete(emp.id)} style={{ padding: "8px 12px" }}>
//                       Удалить
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           ))}

//           {items.length === 0 && !loading && (
//             <div style={{ opacity: 0.7, padding: 8 }}>Сотрудников пока нет.</div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
import { useEffect, useState } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";

const emptyCreate = { login: "", fullName: "", role: "STAFF", password: "" };

export default function EmployeesPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [createForm, setCreateForm] = useState(emptyCreate);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    login: "", fullName: "", role: "STAFF", active: true, password: "",
  });

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await api.managerEmployeesList();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Load error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.managerEmployeesCreate({
        login: createForm.login.trim(),
        fullName: createForm.fullName.trim(),
        role: createForm.role,
        password: createForm.password,
      });
      setCreateForm(emptyCreate);
      await load();
    } catch (e2) {
      setErr(e2.message || "Create error");
    }
  }

  function startEdit(emp) {
    setEditId(emp.id);
    setEditForm({
      login: emp.login || "",
      fullName: emp.fullName || "",
      role: emp.role || "STAFF",
      active: !!emp.active,
      password: "",
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({ login: "", fullName: "", role: "STAFF", active: true, password: "" });
  }

  async function onUpdate(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.managerEmployeesUpdate(editId, {
        login: editForm.login.trim(),
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        active: !!editForm.active,
        password: editForm.password,
      });
      cancelEdit();
      await load();
    } catch (e2) {
      setErr(e2.message || "Update error");
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Удалить сотрудника?")) return;
    setErr("");
    try {
      await api.managerEmployeesDelete(id);
      await load();
    } catch (e2) {
      setErr(e2.message || "Delete error");
    }
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d2e" }}>Employees</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>アカウント管理</div>
        </div>

        {err && (
          <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* ── Create form ── */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>新規作成</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Login">
              <input
                value={createForm.login}
                onChange={(e) => setCreateForm({ ...createForm, login: e.target.value })}
                required
                style={inputStyle}
                placeholder="login"
              />
            </Field>
            <Field label="Full name">
              <input
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                required
                style={inputStyle}
                placeholder="山田 太郎"
              />
            </Field>
            <Field label="Role">
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                style={inputStyle}
              >
                <option value="STAFF">STAFF</option>
                <option value="MANAGER">MANAGER</option>
              </select>
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                style={inputStyle}
                placeholder="••••••••"
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
                {["ID", "Full name", "Login", "Role", "Active", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((emp) => (
                editId === emp.id ? (
                  <tr key={emp.id} style={{ background: "#f8f8ff" }}>
                    <td style={tdStyle} colSpan={6}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, padding: "10px 0" }}>
                        <Field label="Login">
                          <input value={editForm.login}
                            onChange={(e) => setEditForm({ ...editForm, login: e.target.value })}
                            style={inputStyle} />
                        </Field>
                        <Field label="Full name">
                          <input value={editForm.fullName}
                            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                            style={inputStyle} />
                        </Field>
                        <Field label="Role">
                          <select value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            style={inputStyle}>
                            <option value="STAFF">STAFF</option>
                            <option value="MANAGER">MANAGER</option>
                          </select>
                        </Field>
                        <Field label="New password">
                          <input type="password" value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            placeholder="変更なし"
                            style={inputStyle} />
                        </Field>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
                        <input type="checkbox" checked={editForm.active}
                          onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                        Active
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
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>スタッフがいません</td></tr>
              )}
            </tbody>
          </table>
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
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 14,
  boxShadow: "0 6px 20px rgba(20,20,40,0.06)",
  padding: 20,
  marginBottom: 16,
};

const cardTitleStyle = {
  fontSize: 15,
  fontWeight: 800,
  color: "#1a1d2e",
  marginBottom: 14,
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e0e0e8",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle = {
  padding: "10px 10px",
  verticalAlign: "middle",
};

const btnPrimaryStyle = {
  padding: "8px 16px",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondaryStyle = {
  padding: "8px 14px",
  background: "#f0f1f6",
  color: "#444",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnDangerStyle = {
  padding: "8px 14px",
  background: "#fee2e2",
  color: "#c0392b",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};