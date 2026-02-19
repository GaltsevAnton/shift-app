import { useEffect, useState } from "react";
import { api } from "../../shared/api/api";

const emptyCreate = { login: "", fullName: "", role: "STAFF", password: "" };

export default function EmployeesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [createForm, setCreateForm] = useState(emptyCreate);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    login: "",
    fullName: "",
    role: "STAFF",
    active: true,
    password: "",
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

  useEffect(() => {
    load();
  }, []);

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
      password: "", // пусто = не менять
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
        password: editForm.password, // пусто = не менять (backend уже это умеет)
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
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h2 style={{ margin: "0 0 12px" }}>Учетные записи сотрудников</h2>

      {err && (
        <div style={{ background: "#ffe5e5", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Create */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Создать</h3>

        <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
          <label>
            Login
            <input
              value={createForm.login}
              onChange={(e) => setCreateForm({ ...createForm, login: e.target.value })}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            Full name
            <input
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            Role
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="STAFF">STAFF</option>
              <option value="MANAGER">MANAGER</option>
            </select>
          </label>

          <label>
            Password
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <button type="submit" style={{ padding: "10px 14px" }}>
            Создать
          </button>
        </form>
      </div>

      {/* List */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Список</h3>
          <button onClick={load} disabled={loading} style={{ padding: "8px 12px" }}>
            {loading ? "Загрузка..." : "Обновить"}
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {items.map((emp) => (
            <div key={emp.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              {editId === emp.id ? (
                <form onSubmit={onUpdate} style={{ display: "grid", gap: 10 }}>
                  <div><b>ID:</b> {emp.id}</div>

                  <label>
                    Login
                    <input
                      value={editForm.login}
                      onChange={(e) => setEditForm({ ...editForm, login: e.target.value })}
                      required
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>

                  <label>
                    Full name
                    <input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      required
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>

                  <label>
                    Role
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="STAFF">STAFF</option>
                      <option value="MANAGER">MANAGER</option>
                    </select>
                  </label>

                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={editForm.active}
                      onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    />
                    Active
                  </label>

                  <label>
                    New password (optional)
                    <input
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Оставь пустым, чтобы не менять"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" style={{ padding: "8px 12px" }}>
                      Сохранить
                    </button>
                    <button type="button" onClick={cancelEdit} style={{ padding: "8px 12px" }}>
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div><b>{emp.fullName}</b></div>
                    <div style={{ opacity: 0.8 }}>login: {emp.login}</div>
                    <div style={{ opacity: 0.8 }}>
                      role: {emp.role} • active: {String(emp.active)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => startEdit(emp)} style={{ padding: "8px 12px" }}>
                      Редактировать
                    </button>
                    <button onClick={() => onDelete(emp.id)} style={{ padding: "8px 12px" }}>
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && !loading && (
            <div style={{ opacity: 0.7, padding: 8 }}>Сотрудников пока нет.</div>
          )}
        </div>
      </div>
    </div>
  );
}
