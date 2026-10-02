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
function MasterPanel({ title, hint, items, loading, err, onCreate, onUpdate, onDelete, onMove }) {
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
                {onMove && <th style={{ ...thStyle, width: 60 }}></th>}
                <th style={thStyle}>ID</th>
                <th style={thStyle}>名前</th>
                <th style={{ ...thStyle, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                editId === item.id ? (
                  <tr key={item.id} style={{ background: "#f8f8ff", borderBottom: "1px solid #f0f1f6" }}>
                    {onMove && <td style={tdStyle}></td>}
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
                    {onMove && (
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 2 }}>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => onMove(index, -1)}
                            style={{ ...btnSecondaryStyle, padding: "2px 8px", opacity: index === 0 ? 0.3 : 1 }}
                          >↑</button>
                          <button
                            type="button"
                            disabled={index === items.length - 1}
                            onClick={() => onMove(index, 1)}
                            style={{ ...btnSecondaryStyle, padding: "2px 8px", opacity: index === items.length - 1 ? 0.3 : 1 }}
                          >↓</button>
                        </div>
                      </td>
                    )}
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
                  <td colSpan={onMove ? 4 : 3} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>
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
  const [reordering, setReordering] = useState(false);

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

  async function onMove(index, dir) {
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= items.length || reordering) return;
    const next = [...items];
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    setItems(next); // оптимистично, для мгновенного отклика
    setReordering(true); setErr("");
    try {
      await api.settingsDepartmentsReorder(next.map(d => d.id));
    } catch (e) {
      setErr(e.message || "並び替えエラー");
      await load(); // откат к серверному состоянию при ошибке
    } finally {
      setReordering(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        矢印でキオスク画面に表示される部署の順序を変更できます（部署の非表示・除外はできません）。
      </div>
      <MasterPanel
        title="部署"
        hint="例：フロント、調理、事務所..."
        items={items} loading={loading} err={err}
        onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete}
        onMove={onMove}
      />
    </div>
  );
}

/* ─── Attendance statuses tab (勤務状況リスト) ───────────── */
function AttendanceStatusesTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  async function load() {
    setLoading(true); setErr("");
    try { setItems(await api.settingsAttendanceStatusesList()); }
    catch (e) { setErr(e.message || "読み込みエラー"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(name) {
    setErr("");
    try { await api.settingsAttendanceStatusesCreate({ name }); await load(); }
    catch (e) { setErr(e.message || "作成エラー"); }
  }
  async function onUpdate(id, name) {
    setErr("");
    try { await api.settingsAttendanceStatusesUpdate(id, { name }); await load(); }
    catch (e) { setErr(e.message || "更新エラー"); }
  }
  async function onDelete(id) {
    if (!window.confirm("削除しますか？\n（勤怠管理で既に設定済みの表示はそのまま残ります）")) return;
    setErr("");
    try { await api.settingsAttendanceStatusesDelete(id); await load(); }
    catch (e) { setErr(e.message || "削除エラー"); }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        勤怠管理の「状況」欄で選択できる項目です。名称変更・削除をしても、既に設定済みの日の表示は変更前のまま残ります。
      </div>
      <MasterPanel
        title="勤務状況"
        hint="例：有給、欠勤、日時調整..."
        items={items} loading={loading} err={err}
        onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete}
      />
    </div>
  );
}

/* ─── Break Rules tab ───────────────────────────────────── */
function BreakRulesTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [form, setForm]       = useState({ name: "", thresholdMinutes: "", breakMinutes: "" });
  const [editId, setEditId]   = useState(null);
  const [editForm, setEditForm] = useState({});

  async function load() {
    setLoading(true); setErr("");
    try { setItems(await api.settingsBreakRulesList()); }
    catch (e) { setErr(e.message || "読み込みエラー"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate() {
    if (!form.name.trim() || !form.thresholdMinutes || !form.breakMinutes) return;
    setErr("");
    try {
      await api.settingsBreakRulesCreate({
        name: form.name.trim(),
        thresholdMinutes: Number(form.thresholdMinutes),
        breakMinutes: Number(form.breakMinutes),
      });
      setForm({ name: "", thresholdMinutes: "", breakMinutes: "" });
      await load();
    } catch (e) { setErr(e.message || "作成エラー"); }
  }

  async function onUpdate(id) {
    setErr("");
    try {
      await api.settingsBreakRulesUpdate(id, {
        name: editForm.name,
        thresholdMinutes: Number(editForm.thresholdMinutes),
        breakMinutes: Number(editForm.breakMinutes),
      });
      setEditId(null);
      await load();
    } catch (e) { setErr(e.message || "更新エラー"); }
  }

  async function onDelete(id) {
    if (!window.confirm("削除しますか？")) return;
    setErr("");
    try { await api.settingsBreakRulesDelete(id); await load(); }
    catch (e) { setErr(e.message || "削除エラー"); }
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>
              名前 *
            </label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              placeholder="例：休憩1"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>
              しきい値（分以上）*
            </label>
            <input
              type="number" min="1"
              value={form.thresholdMinutes}
              onChange={e => setForm({ ...form, thresholdMinutes: e.target.value })}
              style={inputStyle}
              placeholder="例：360"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>
              休憩時間（分）*
            </label>
            <input
              type="number" min="1"
              value={form.breakMinutes}
              onChange={e => setForm({ ...form, breakMinutes: e.target.value })}
              style={inputStyle}
              placeholder="例：45"
            />
          </div>
          <button
            style={{ ...btnPrimaryStyle, whiteSpace: "nowrap" }}
            type="button"
            disabled={!form.name.trim() || !form.thresholdMinutes || !form.breakMinutes}
            onClick={onCreate}
          >
            ＋ 追加
          </button>
        </div>
      </div>

      {/* List */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>休憩ルール一覧</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          勤務時間がしきい値を超えた場合、最も近いルールの休憩時間を差し引きます。
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#aaa" }}>読み込み中...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f1f6" }}>
                <th style={thStyle}>名前</th>
                <th style={thStyle}>勤務時間が X 分以上</th>
                <th style={thStyle}>休憩時間（分）</th>
                <th style={{ ...thStyle, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                editId === item.id ? (
                  <tr key={item.id} style={{ background: "#f8f8ff", borderBottom: "1px solid #f0f1f6" }}>
                    <td style={tdStyle}>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        style={{ ...inputStyle, maxWidth: 140 }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number" min="1"
                        value={editForm.thresholdMinutes}
                        onChange={e => setEditForm({ ...editForm, thresholdMinutes: e.target.value })}
                        style={{ ...inputStyle, maxWidth: 100 }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number" min="1"
                        value={editForm.breakMinutes}
                        onChange={e => setEditForm({ ...editForm, breakMinutes: e.target.value })}
                        style={{ ...inputStyle, maxWidth: 100 }}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button style={btnPrimaryStyle} type="button" onClick={() => onUpdate(item.id)}>保存</button>
                        <button style={btnSecondaryStyle} type="button" onClick={() => setEditId(null)}>キャンセル</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f0f1f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafe"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 13, color: "#1a1d2e", background: "#f1f5f9",
                        padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                      }}>
                        {item.name}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "#475569" }}>
                        {item.thresholdMinutes} 分以上
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "#6366f1" }}>
                        {item.breakMinutes} 分
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button style={btnSecondaryStyle} type="button"
                          onClick={() => {
                            setEditId(item.id);
                            setEditForm({
                              name: item.name,
                              thresholdMinutes: item.thresholdMinutes,
                              breakMinutes: item.breakMinutes,
                            });
                          }}>
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
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>
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

/* ─── Notifications tab ─────────────────────────────────── */
const NOTIFICATION_TYPES = [
  { key: "LATE_ARRIVAL",        label: "遅刻通知",         hint: "スタッフが出勤予定時刻に遅刻した場合に通知します。" },
  { key: "EARLY_DEPARTURE",     label: "早退通知",         hint: "スタッフが退勤予定時刻より早く退勤した場合に通知します。" },
  { key: "FORGOT_CLOCKOUT",     label: "退勤忘れ通知",     hint: "退勤の打刻がされないままシフトが終了した場合に通知します。" },
  { key: "UNSCHEDULED_ARRIVAL", label: "シフトなし出勤通知", hint: "シフトの予定がない日に出勤の打刻があった場合に通知します。" },
  { key: "ACCOUNT_LOCKED",      label: "アカウントロック通知", hint: "ログイン試行回数の上限に達し、アカウントが永久ロックされた場合に通知します。" },
  { key: "EMPLOYEE_CREATED",    label: "新規従業員登録通知", hint: "新しい従業員が登録された場合に通知します。" },
  { key: "EMPLOYEE_DELETED",    label: "従業員削除通知",   hint: "従業員が削除された場合に通知します。" },
  { key: "PASSWORD_CHANGED",    label: "パスワード変更通知", hint: "従業員（自分以外）のパスワードが変更された場合に通知します。" },
];

function NotificationsTab() {
  const [prefs, setPrefs]     = useState({});
  const [checkTime, setCheckTime] = useState("00:00");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const [p, s] = await Promise.all([
        api.notificationPreferencesGet(),
        api.notificationSettingsGet(),
      ]);
      setPrefs(p || {});
      setCheckTime((s?.forgotClockoutCheckTime || "00:00:00").slice(0, 5));
    } catch (e) {
      setErr(e.message || "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setErr(""); setSavedMsg("");
    try {
      await api.notificationPreferencesSet({ [key]: next[key] });
      setSavedMsg("保存しました");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) {
      setErr(e.message || "保存エラー");
      setPrefs(prefs); // revert
    }
  }

  async function saveCheckTime() {
    setSaving(true); setErr(""); setSavedMsg("");
    try {
      await api.notificationSettingsSet(checkTime);
      setSavedMsg("保存しました");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) {
      setErr(e.message || "保存エラー");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: "#aaa" }}>読み込み中...</div>;
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
      {savedMsg && (
        <div style={{
          background: "#dcfce7", color: "#166534", padding: "8px 14px",
          borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600,
        }}>
          ✓ {savedMsg}
        </div>
      )}

      {/* 自分が受け取る通知 */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>受け取る通知（自分用）</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          ここでの設定はあなた自身のメールアドレスへの通知にのみ適用されます。他のマネージャーには影響しません。
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NOTIFICATION_TYPES.map(t => (
            <label key={t.key} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 14px", borderRadius: 10, cursor: "pointer",
              border: "1px solid #f0f1f6",
            }}>
              <input
                type="checkbox"
                checked={prefs[t.key] !== false}
                onChange={() => togglePref(t.key)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: "#6366f1", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d2e" }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{t.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 退勤忘れチェック時刻（全体設定） */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>退勤忘れチェック時刻</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          毎日この時刻に、前日分の未退勤（打刻忘れ）をチェックします。この設定は全マネージャー共通です。
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>
              チェック時刻
            </label>
            <input
              type="time"
              value={checkTime}
              onChange={e => setCheckTime(e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            />
          </div>
          <button
            style={{ ...btnPrimaryStyle, opacity: saving ? 0.6 : 1 }}
            type="button"
            disabled={saving}
            onClick={saveCheckTime}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Roles tab (権限, ADMIN専用) ────────────────────────── */
const PERMISSION_GROUPS = [
  { label: "シフト", items: [
      { key: "SHIFT_VIEW", label: "閲覧・作成・編集・削除" },
  ]},
  { label: "勤怠管理", items: [
      { key: "ATTENDANCE_VIEW",   label: "閲覧" },
      { key: "ATTENDANCE_EDIT",   label: "編集" },
      { key: "ATTENDANCE_DELETE", label: "削除" },
  ]},
  { label: "従業員", items: [
      { key: "EMPLOYEE_VIEW",   label: "閲覧" },
      { key: "EMPLOYEE_CREATE", label: "作成" },
      { key: "EMPLOYEE_EDIT",   label: "編集" },
      { key: "EMPLOYEE_DELETE", label: "削除" },
  ]},
  { label: "勤務場所", items: [
      { key: "WORKPLACE_VIEW",   label: "閲覧" },
      { key: "WORKPLACE_CREATE", label: "作成" },
      { key: "WORKPLACE_EDIT",   label: "編集" },
      { key: "WORKPLACE_DELETE", label: "削除" },
  ]},
  { label: "職種・役職", items: [
      { key: "POSITION_VIEW",   label: "閲覧" },
      { key: "POSITION_CREATE", label: "作成" },
      { key: "POSITION_EDIT",   label: "編集" },
      { key: "POSITION_DELETE", label: "削除" },
  ]},
  { label: "部署", items: [
      { key: "DEPARTMENT_VIEW",   label: "閲覧" },
      { key: "DEPARTMENT_CREATE", label: "作成" },
      { key: "DEPARTMENT_EDIT",   label: "編集" },
      { key: "DEPARTMENT_DELETE", label: "削除" },
  ]},
  { label: "休憩ルール", items: [
      { key: "BREAK_RULE_VIEW",   label: "閲覧" },
      { key: "BREAK_RULE_CREATE", label: "作成" },
      { key: "BREAK_RULE_EDIT",   label: "編集" },
      { key: "BREAK_RULE_DELETE", label: "削除" },
  ]},
  { label: "勤務状況リスト", items: [
    { key: "ATTENDANCE_STATUS_VIEW",   label: "閲覧" },
    { key: "ATTENDANCE_STATUS_CREATE", label: "作成" },
    { key: "ATTENDANCE_STATUS_EDIT",   label: "編集" },
    { key: "ATTENDANCE_STATUS_DELETE", label: "削除" },
]},
{ label: "通知設定", items: [
      { key: "NOTIFICATION_VIEW", label: "閲覧" },
      { key: "NOTIFICATION_EDIT", label: "編集" },
  ]},
  { label: "ログ", items: [
      { key: "LOGGING_VIEW", label: "閲覧" },
  ]},
];

const emptyRoleForm = { name: "", permissions: [] };

function RolesTab() {
  const [roles, setRoles]         = useState([]);
  const [allPerms, setAllPerms]   = useState([]); // серверный список Permission — источник истины
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(emptyRoleForm);
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function load() {
    setLoading(true); setErr("");
    try {
      const [r, p] = await Promise.all([
        api.settingsRolesList(),
        api.settingsPermissionsList(),
      ]);
      setRoles(Array.isArray(r) ? r : []);
      setAllPerms(Array.isArray(p) ? p : []);
    } catch (e) {
      setErr(e.message || "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyRoleForm);
    setFormErr("");
    setModalOpen(true);
  }

  function openEdit(role) {
    setEditId(role.id);
    setForm({ name: role.name, permissions: role.permissions || [] });
    setFormErr("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyRoleForm);
    setFormErr("");
  }

  function togglePerm(key) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }));
  }

  function toggleGroup(group, checked) {
    const keys = group.items.map(i => i.key);
    setForm(f => {
      const without = f.permissions.filter(p => !keys.includes(p));
      return { ...f, permissions: checked ? [...without, ...keys] : without };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormErr("名前を入力してください"); return; }
    setSaving(true); setFormErr("");
    try {
      const payload = { name: form.name.trim(), permissions: form.permissions };
      if (editId) await api.settingsRolesUpdate(editId, payload);
      else        await api.settingsRolesCreate(payload);
      closeModal();
      await load();
    } catch (e) {
      setFormErr(e.message || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirm) return;
    setErr("");
    try {
      await api.settingsRolesDelete(deleteConfirm);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      setErr(e.message || "削除エラー");
      setDeleteConfirm(null);
    }
  }

  const visibleGroups = PERMISSION_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => allPerms.length === 0 || allPerms.includes(i.key)) }))
    .filter(g => g.items.length > 0);

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        ロールごとに操作可能な範囲を設定します。従業員にロールを割り当てると、そのロールの権限のみが有効になります（未割り当ての場合は権限なし）。
      </div>

      {err && (
        <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button style={btnPrimaryStyle} type="button" onClick={openCreate}>＋ 新規ロール</button>
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>ロール一覧</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#aaa" }}>読み込み中...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f1f6" }}>
                <th style={thStyle}>名前</th>
                <th style={thStyle}>権限数</th>
                <th style={{ ...thStyle, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id} style={{ borderBottom: "1px solid #f0f1f6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafafe"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: "#1a1d2e", background: "#f1f5f9", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                      {role.name}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: "#64748b" }}>{(role.permissions || []).length} 件</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button style={btnSecondaryStyle} type="button" onClick={() => openEdit(role)}>編集</button>
                      <button style={btnDangerStyle} type="button" onClick={() => setDeleteConfirm(role.id)}>削除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && !loading && (
                <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#aaa" }}>まだ登録されていません</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal: create/edit ── */}
      {modalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(15,23,42,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "#fff", borderRadius: 18, padding: 28,
            width: 640, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d2e", marginBottom: 16 }}>
              {editId ? "ロールを編集" : "ロールを新規作成"}
            </div>

            {formErr && (
              <div style={{ background: "#ffe5e5", color: "#c0392b", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                {formErr}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>
                ロール名 *
              </label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
                placeholder="例：ホールリーダー"
              />
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>権限</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleGroups.map(group => {
                const allChecked = group.items.every(i => form.permissions.includes(i.key));
                return (
                  <div key={group.label} style={{ border: "1px solid #f0f1f6", borderRadius: 10, padding: "10px 14px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#1a1d2e", marginBottom: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={allChecked} onChange={e => toggleGroup(group, e.target.checked)} />
                      {group.label}
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", paddingLeft: 24 }}>
                      {group.items.map(item => (
                        <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(item.key)}
                            onChange={() => togglePerm(item.key)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={closeModal} style={btnSecondaryStyle} type="button">キャンセル</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimaryStyle, opacity: saving ? 0.6 : 1 }} type="button">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 3000,
          background: "rgba(15,23,42,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, width: "90%", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1d2e", marginBottom: 12 }}>本当に削除しますか？</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, marginBottom: 24 }}>
              このロールを削除すると、割り当てられている従業員は「ロールなし」（権限なし）になります。
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...btnSecondaryStyle, padding: "10px 24px", fontSize: 14 }} type="button">キャンセル</button>
              <button onClick={handleDeleteConfirmed} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }} type="button">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */
const BASE_TABS = [
  { key: "workplaces",     label: "勤務場所" },
  { key: "positions",      label: "職種・役職" },
  { key: "departments",    label: "部署" },
  { key: "breakrules",     label: "休憩ルール" },
  { key: "attstatuses",    label: "勤務状況リスト" },
  { key: "notifications",  label: "通知設定" },
];

// Какое право нужно для таба
const TAB_PERMISSION = {
  workplaces:    "WORKPLACE_VIEW",
  positions:     "POSITION_VIEW",
  departments:   "DEPARTMENT_VIEW",
  breakrules:    "BREAK_RULE_VIEW",
  attstatuses:   "ATTENDANCE_STATUS_VIEW",
  notifications: "NOTIFICATION_VIEW",
};

export default function SettingsPage({ view, onNavigate, onLogout, permissions = [] }) {
  const name = localStorage.getItem("staffName") || "manager";
  const isAdmin = localStorage.getItem("appRole") === "ADMIN";
  const allowedTabs = BASE_TABS.filter(t => isAdmin || permissions.includes(TAB_PERMISSION[t.key]));
  const TABS = isAdmin ? [...allowedTabs, { key: "roles", label: "権限" }] : allowedTabs;
  const [tab, setTab] = useState("workplaces");
  // если выбранный таб недоступен — показываем первый доступный
  const activeTab = TABS.some(t => t.key === tab) ? tab : (TABS[0]?.key ?? null);

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
                background: activeTab === t.key ? "#fff" : "transparent",
                color: activeTab === t.key ? "#6366f1" : "#64748b",
                boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "workplaces"    && <WorkplacesTab />}
        {activeTab === "positions"     && <PositionsTab />}
        {activeTab === "departments"   && <DepartmentsTab />}
        {activeTab === "breakrules"    && <BreakRulesTab />}
        {activeTab === "attstatuses"   && <AttendanceStatusesTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "roles" && isAdmin && <RolesTab />}
      </div>
      </div>
    </ManagerLayout>
  );
}