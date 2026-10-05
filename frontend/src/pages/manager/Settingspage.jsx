import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import styles from "./SettingsPage.module.css";

/* ═══════════════════════════════════════════════════════════
   設定 — новый дизайн (2026-10-05)
   Без вкладок: все справочники блоками на одной странице (masonry 3/2/1 колонки),
   под ними отдельной строкой «システム設定» — 通知設定 и 権限 (ADMIN).
   ═══════════════════════════════════════════════════════════ */

const cx = (...a) => a.filter(Boolean).join(" ");
const SCROLL_AFTER = 10; // больше N элементов — внутренняя прокрутка списка

/* ─── Иконки ────────────────────────────────────────────── */
const TB_ICON = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};
function IcoGear()   { return (<svg {...TB_ICON}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" /></svg>); }
function IcoBell()   { return (<svg {...TB_ICON}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 004 0" /></svg>); }
function IcoUser()   { return (<svg {...TB_ICON}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg>); }
function IcoLogout() { return (<svg {...TB_ICON}><path d="M14 4H7a2 2 0 00-2 2v12a2 2 0 002 2h7" /><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" /></svg>); }
function IcoPin()    { return (<svg {...TB_ICON}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></svg>); }
function IcoBag()    { return (<svg {...TB_ICON}><rect x="3.5" y="7.5" width="17" height="12.5" rx="2" /><path d="M9 7.5V5.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5.5v2M3.5 12.5h17" /></svg>); }
function IcoUsers()  { return (<svg {...TB_ICON}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><circle cx="16.8" cy="9.5" r="2.5" /><path d="M16.5 13.6c2.3.2 4 2 4 4.6" /></svg>); }
function IcoList()   { return (<svg {...TB_ICON}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4" /></svg>); }
function IcoCup()    { return (<svg {...TB_ICON}><path d="M4.5 9h12v5a5 5 0 01-5 5h-2a5 5 0 01-5-5V9z" /><path d="M16.5 10.5h1.5a2.5 2.5 0 010 5h-1.8M8 3.5v2.5M12 3.5v2.5" /></svg>); }
function IcoShield() { return (<svg {...TB_ICON}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6L12 3z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>); }
function IcoDb()     { return (<svg {...TB_ICON}><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" /></svg>); }
function IcoClock()  { return (<svg {...TB_ICON}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>); }
function IcoEdit()   { return (<svg {...TB_ICON}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>); }
function IcoTrash()  { return (<svg {...TB_ICON}><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5a1 1 0 001 .9h7a1 1 0 001-.9l1-12.5M9.5 7V4.5h5V7" /></svg>); }
function IcoCheck()  { return (<svg {...TB_ICON} strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>); }
function IcoClear()  { return (<svg {...TB_ICON} strokeWidth={2.4}><path d="M7 7l10 10M17 7L7 17" /></svg>); }
function IcoUp()     { return (<svg {...TB_ICON} strokeWidth={2.2}><path d="M6 14.5l6-6 6 6" /></svg>); }
function IcoDown()   { return (<svg {...TB_ICON} strokeWidth={2.2}><path d="M6 9.5l6 6 6-6" /></svg>); }
function IcoPlus()   { return (<svg {...TB_ICON} strokeWidth={2.3}><path d="M12 5v14M5 12h14" /></svg>); }
function IcoSave()   { return (<svg {...TB_ICON}><path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>); }

/* Esc закрывает окно */
function useEsc(active, onEsc) {
  const ref = useRef(onEsc);
  ref.current = onEsc;
  useEffect(() => {
    if (!active) return;
    function onKey(e) { if (e.key === "Escape") ref.current(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}

/* ─── Раздел страницы (マスターデータ / システム設定) ─────── */
// Свёрнутые разделы запоминаются в localStorage (settingsCollapsed: ["master", ...])
function loadCollapsed() {
  try {
    const v = JSON.parse(localStorage.getItem("settingsCollapsed") || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function Section({ id, icon, title, sub, children }) {
  const [open, setOpen] = useState(() => !loadCollapsed().includes(id));

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      const list = loadCollapsed().filter(k => k !== id);
      if (!next) list.push(id);
      localStorage.setItem("settingsCollapsed", JSON.stringify(list));
    } catch { /* ignore */ }
  }

  return (
    <section className={cx(styles.section, !open && styles.sectionClosed)}>
      <button type="button" className={styles.sectionHead} onClick={toggle} aria-expanded={open}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionText}>
          <span className={styles.sectionTitle}>{title}</span>
          {sub && <span className={styles.sectionSub}>{sub}</span>}
        </span>
        <span className={styles.sectionChevron} aria-label={open ? "折りたたむ" : "展開する"}>
          <IcoDown />
        </span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

/* ─── Общий каркас блока ────────────────────────────────── */
function Block({ icon, title, count, hint, err, ok, className, children, foot }) {
  return (
    <section className={cx(styles.block, className)}>
      <div className={styles.blockHead}>
        <div className={styles.blockHeadRow}>
          <span className={styles.blockIcon}>{icon}</span>
          <span className={styles.blockTitle}>{title}</span>
          {count != null && <span className={styles.blockCount}>{count}</span>}
          {ok && <span className={styles.blockOk}><IcoCheck />{ok}</span>}
        </div>
        {hint && <div className={styles.blockHint}>{hint}</div>}
      </div>
      {err && <div className={styles.blockErr}>{err}</div>}
      <div className={styles.blockBody}>{children}</div>
      {foot && <div className={styles.blockFoot}>{foot}</div>}
    </section>
  );
}

function RowOps({ canEdit, canDelete, onEdit, onDelete, disabled }) {
  if (!canEdit && !canDelete) return null;
  return (
    <div className={styles.rowOps}>
      {canEdit && (
        <button type="button" className={styles.opBtn} onClick={onEdit} disabled={disabled}
          title="編集" aria-label="編集">
          <IcoEdit />
        </button>
      )}
      {canDelete && (
        <button type="button" className={cx(styles.opBtn, styles.opBtnDanger)} onClick={onDelete} disabled={disabled}
          title="削除" aria-label="削除">
          <IcoTrash />
        </button>
      )}
    </div>
  );
}

function EditOps({ onSave, onCancel, saveDisabled }) {
  return (
    <div className={styles.rowOps}>
      <button type="button" className={cx(styles.opBtn, styles.opBtnOk)} onClick={onSave} disabled={saveDisabled}
        aria-label="保存">
        <IcoCheck />
      </button>
      <button type="button" className={styles.opBtn} onClick={onCancel} aria-label="キャンセル">
        <IcoClear />
      </button>
    </div>
  );
}

/* ─── Загрузка / CRUD для одного справочника ─────────────── */
function useMaster(listFn) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listFn();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }

  // действие + перезагрузка; ошибка — в шапку блока. Возвращает true при успехе
  async function run(fn, errLabel) {
    setErr("");
    try { await fn(); await load(); return true; }
    catch (e) { setErr(e.message || errLabel); return false; }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { items, setItems, loading, err, setErr, load, run };
}

/* ─── Простой справочник (только «名前») ─────────────────── */
function NameListBlock({ icon, title, hint, placeholder, fns, can, deleteWarn, onAskDelete }) {
  const m = useMaster(fns.list);
  const [newName, setNewName]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState("");
  const [reordering, setReordering] = useState(false);
  const addRef = useRef(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    const ok = await m.run(() => fns.create({ name }), "作成エラー");
    setAdding(false);
    if (ok) { setNewName(""); addRef.current?.focus(); }
  }

  function startEdit(item) { setEditId(item.id); setEditName(item.name); }
  function cancelEdit()    { setEditId(null); setEditName(""); }

  async function saveEdit() {
    const name = editName.trim();
    if (!name) return;
    const item = m.items.find(i => i.id === editId);
    if (item && item.name === name) { cancelEdit(); return; }
    const ok = await m.run(() => fns.update(editId, { name }), "更新エラー");
    if (ok) cancelEdit();
  }

  function askDelete(item) {
    onAskDelete({
      name: item.name,
      warn: deleteWarn,
      action: () => m.run(() => fns.remove(item.id), "削除エラー"),
    });
  }

  async function move(index, dir) {
    const swap = index + dir;
    if (swap < 0 || swap >= m.items.length || reordering) return;
    const next = [...m.items];
    [next[index], next[swap]] = [next[swap], next[index]];
    m.setItems(next);            // оптимистично
    setReordering(true); m.setErr("");
    try {
      await fns.reorder(next.map(d => d.id));
    } catch (e) {
      m.setErr(e.message || "並び替えエラー");
      await m.load();            // откат к серверному состоянию
    } finally {
      setReordering(false);
    }
  }

  const movable = !!fns.reorder && can.edit;
  const items = m.items;

  return (
    <Block icon={icon} title={title} count={m.loading && !items.length ? null : items.length}
      hint={hint} err={m.err}
      foot={can.create && (
        <div className={styles.addRow}>
          <input ref={addRef} className={styles.input} value={newName} placeholder={placeholder}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAdd(); }} />
          <button type="button" className={styles.addBtn} onClick={handleAdd} disabled={!newName.trim() || adding}>
            <IcoPlus />追加
          </button>
        </div>
      )}>
      {m.loading && !items.length ? (
        <div className={styles.empty}>読み込み中...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>まだ登録されていません</div>
      ) : (
        <ul className={cx(styles.list, items.length > SCROLL_AFTER && styles.listScroll)}>
          {items.map((item, index) => (
            <li key={item.id} className={cx(styles.row, editId === item.id && styles.rowEditing)}>
              {movable && (
                <div className={styles.moveBtns}>
                  <button type="button" className={styles.moveBtn} aria-label="上へ"
                    disabled={index === 0 || reordering || editId != null} onClick={() => move(index, -1)}>
                    <IcoUp />
                  </button>
                  <button type="button" className={styles.moveBtn} aria-label="下へ"
                    disabled={index === items.length - 1 || reordering || editId != null} onClick={() => move(index, 1)}>
                    <IcoDown />
                  </button>
                </div>
              )}

              {editId === item.id ? (
                <>
                  <input className={cx(styles.input, styles.inputEdit)} value={editName} autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }} />
                  <EditOps onSave={saveEdit} onCancel={cancelEdit} saveDisabled={!editName.trim()} />
                </>
              ) : (
                <>
                  <span className={styles.rowName}>{item.name}</span>
                  <RowOps canEdit={can.edit} canDelete={can.del}
                    disabled={editId != null}
                    onEdit={() => startEdit(item)} onDelete={() => askDelete(item)} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

/* ─── 休憩ルール ────────────────────────────────────────── */
const emptyRule = { name: "", thresholdMinutes: "", breakMinutes: "" };

function BreakRulesBlock({ can, onAskDelete }) {
  const m = useMaster(api.settingsBreakRulesList);
  const [form, setForm]         = useState(emptyRule);
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [editForm, setEditForm] = useState(emptyRule);

  const valid = f => String(f.name).trim() && Number(f.thresholdMinutes) > 0 && Number(f.breakMinutes) > 0;
  const toPayload = f => ({
    name: String(f.name).trim(),
    thresholdMinutes: Number(f.thresholdMinutes),
    breakMinutes: Number(f.breakMinutes),
  });

  async function handleAdd() {
    if (!valid(form) || adding) return;
    setAdding(true);
    const ok = await m.run(() => api.settingsBreakRulesCreate(toPayload(form)), "作成エラー");
    setAdding(false);
    if (ok) setForm(emptyRule);
  }

  function startEdit(item) {
    setEditId(item.id);
    setEditForm({ name: item.name, thresholdMinutes: item.thresholdMinutes, breakMinutes: item.breakMinutes });
  }
  function cancelEdit() { setEditId(null); setEditForm(emptyRule); }

  async function saveEdit() {
    if (!valid(editForm)) return;
    const ok = await m.run(() => api.settingsBreakRulesUpdate(editId, toPayload(editForm)), "更新エラー");
    if (ok) cancelEdit();
  }

  function askDelete(item) {
    onAskDelete({
      name: item.name,
      sub: `${item.thresholdMinutes}分以上 → 休憩 ${item.breakMinutes}分`,
      action: () => m.run(() => api.settingsBreakRulesDelete(item.id), "削除エラー"),
    });
  }

  const onKey = (save, cancel) => e => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) save();
    if (e.key === "Escape" && cancel) cancel();
  };

  // по возрастанию порога — так проще читать «какая ширина какому времени»
  const items = [...m.items].sort((a, b) => (a.thresholdMinutes ?? 0) - (b.thresholdMinutes ?? 0));

  return (
    <Block icon={<IcoCup />} title="休憩ルール" count={m.loading && !items.length ? null : items.length}
      hint="勤務時間がしきい値を超えた場合、最も近いルールの休憩時間を差し引きます。"
      err={m.err}
      foot={can.create && (
        <div className={styles.ruleForm}>
          <label className={styles.ruleField}>
            <span>名前</span>
            <input className={styles.input} value={form.name} placeholder="例：休憩1"
              onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={onKey(handleAdd)} />
          </label>
          <label className={styles.ruleField}>
            <span>分以上</span>
            <input type="number" min="1" className={styles.input} value={form.thresholdMinutes} placeholder="例：360"
              onChange={e => setForm({ ...form, thresholdMinutes: e.target.value })} onKeyDown={onKey(handleAdd)} />
          </label>
          <label className={styles.ruleField}>
            <span>休憩（分）</span>
            <input type="number" min="1" className={styles.input} value={form.breakMinutes} placeholder="例：45"
              onChange={e => setForm({ ...form, breakMinutes: e.target.value })} onKeyDown={onKey(handleAdd)} />
          </label>
          <button type="button" className={styles.addBtn} onClick={handleAdd} disabled={!valid(form) || adding}>
            <IcoPlus />追加
          </button>
        </div>
      )}>
      {m.loading && !items.length ? (
        <div className={styles.empty}>読み込み中...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>まだ登録されていません</div>
      ) : (
        <ul className={cx(styles.list, items.length > SCROLL_AFTER && styles.listScroll)}>
          {items.map(item => (
            editId === item.id ? (
              <li key={item.id} className={cx(styles.row, styles.rowEditing)}>
                <div className={styles.ruleEdit}>
                  <input className={styles.input} value={editForm.name} autoFocus aria-label="名前"
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    onKeyDown={onKey(saveEdit, cancelEdit)} />
                  <input type="number" min="1" className={styles.input} value={editForm.thresholdMinutes} aria-label="分以上"
                    onChange={e => setEditForm({ ...editForm, thresholdMinutes: e.target.value })}
                    onKeyDown={onKey(saveEdit, cancelEdit)} />
                  <input type="number" min="1" className={styles.input} value={editForm.breakMinutes} aria-label="休憩（分）"
                    onChange={e => setEditForm({ ...editForm, breakMinutes: e.target.value })}
                    onKeyDown={onKey(saveEdit, cancelEdit)} />
                </div>
                <EditOps onSave={saveEdit} onCancel={cancelEdit} saveDisabled={!valid(editForm)} />
              </li>
            ) : (
              <li key={item.id} className={styles.row}>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.ruleInfo}>
                  <b>{item.thresholdMinutes}</b>分以上
                  <span className={styles.ruleArrow}>→</span>
                  休憩 <b className={styles.ruleBreak}>{item.breakMinutes}</b>分
                </span>
                <RowOps canEdit={can.edit} canDelete={can.del} disabled={editId != null}
                  onEdit={() => startEdit(item)} onDelete={() => askDelete(item)} />
              </li>
            )
          ))}
        </ul>
      )}
    </Block>
  );
}

/* ─── 通知設定 ──────────────────────────────────────────── */
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

function NotificationsBlock({ canEdit }) {
  const [prefs, setPrefs]         = useState({});
  const [checkTime, setCheckTime] = useState("00:00");
  const [savedTime, setSavedTime] = useState("00:00");
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [savedMsg, setSavedMsg]   = useState("");
  const msgTimer = useRef(null);

  function flashSaved() {
    setSavedMsg("保存しました");
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setSavedMsg(""), 2000);
  }
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  async function load() {
    setLoading(true); setErr("");
    try {
      const [p, s] = await Promise.all([
        api.notificationPreferencesGet(),
        api.notificationSettingsGet(),
      ]);
      setPrefs(p || {});
      const t = (s?.forgotClockoutCheckTime || "00:00:00").slice(0, 5);
      setCheckTime(t); setSavedTime(t);
    } catch (e) {
      setErr(e.message || "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function togglePref(key) {
    const prev = prefs;
    const val = prev[key] === false; // сейчас выкл → включаем
    setPrefs({ ...prev, [key]: val });
    setErr(""); setSavedMsg("");
    try {
      await api.notificationPreferencesSet({ [key]: val });
      flashSaved();
    } catch (e) {
      setErr(e.message || "保存エラー");
      setPrefs(prev); // откат
    }
  }

  async function saveCheckTime() {
    setSaving(true); setErr(""); setSavedMsg("");
    try {
      await api.notificationSettingsSet(checkTime);
      setSavedTime(checkTime);
      flashSaved();
    } catch (e) {
      setErr(e.message || "保存エラー");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Block icon={<IcoBell />} title="通知設定" err={err} ok={savedMsg} className={styles.blockWide}>
      {loading ? (
        <div className={styles.empty}>読み込み中...</div>
      ) : (
        <div className={styles.ntWrap}>
          <div className={styles.ntSection}>
            <div className={styles.subTitle}>受け取る通知（自分用）</div>
            <div className={styles.subHint}>
              ここでの設定はあなた自身のメールアドレスへの通知にのみ適用されます。他のマネージャーには影響しません。
            </div>
            <div className={styles.ntGrid}>
              {NOTIFICATION_TYPES.map(t => (
                <label key={t.key} className={styles.toggle}>
                  <input type="checkbox" checked={prefs[t.key] !== false} onChange={() => togglePref(t.key)} />
                  <span className={styles.switch} />
                  <span className={styles.toggleText}>
                    {t.label}
                    <small>{t.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.ntSide}>
            <div className={styles.subTitle}><IcoClock />退勤忘れチェック時刻</div>
            <div className={styles.subHint}>
              毎日この時刻に、前日分の未退勤（打刻忘れ）をチェックします。この設定は全マネージャー共通です。
            </div>
            <div className={styles.timeRow}>
              <input type="time" className={cx(styles.input, styles.timeInput)} value={checkTime}
                disabled={!canEdit} onChange={e => setCheckTime(e.target.value)} aria-label="チェック時刻" />
              {canEdit && (
                <button type="button" className={styles.saveBtn} onClick={saveCheckTime}
                  disabled={saving || !checkTime || checkTime === savedTime}>
                  <IcoSave />{saving ? "保存中..." : "保存"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Block>
  );
}

/* ─── 権限 (ADMIN専用) ──────────────────────────────────── */
// ВНИМАНИЕ: синхронизируется вручную с enum Permission на бэкенде
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

function RolesBlock({ onAskDelete }) {
  const [roles, setRoles]       = useState([]);
  const [allPerms, setAllPerms] = useState([]); // серверный список Permission — источник истины
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(emptyRoleForm);
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState("");

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([api.settingsRolesList(), api.settingsPermissionsList()]);
      setRoles(Array.isArray(r) ? r : []);
      setAllPerms(Array.isArray(p) ? p : []);
    } catch (e) {
      setErr(e.message || "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setEditId(null); setForm(emptyRoleForm); setFormErr(""); setModalOpen(true); }
  function openEdit(role) {
    setEditId(role.id);
    setForm({ name: role.name, permissions: role.permissions || [] });
    setFormErr(""); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditId(null); setForm(emptyRoleForm); setFormErr(""); }
  useEsc(modalOpen && !saving, closeModal);

  function togglePerm(key) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key],
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
      setErr("");
      await load();
    } catch (e) {
      setFormErr(e.message || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function askDelete(role) {
    onAskDelete({
      title: "ロールを削除しますか？",
      name: role.name,
      warn: "このロールを削除すると、割り当てられている従業員は「ロールなし」（権限なし）になります。",
      action: async () => {
        setErr("");
        try { await api.settingsRolesDelete(role.id); await load(); }
        catch (e) { setErr(e.message || "削除エラー"); }
      },
    });
  }

  const visibleGroups = PERMISSION_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => allPerms.length === 0 || allPerms.includes(i.key)) }))
    .filter(g => g.items.length > 0);

  // краткая сводка роли: группы, где есть хотя бы одно право (частично — с n/m)
  function roleSummary(role) {
    const set = new Set(role.permissions || []);
    return visibleGroups
      .map(g => ({ label: g.label, n: g.items.filter(i => set.has(i.key)).length, total: g.items.length }))
      .filter(g => g.n > 0);
  }

  return (
    <Block icon={<IcoShield />} title="権限" count={loading && !roles.length ? null : roles.length}
      hint="ロールごとに操作可能な範囲を設定します。従業員にロールを割り当てると、そのロールの権限のみが有効になります（未割り当ての場合は権限なし）。"
      err={err} className={styles.blockWide}
      foot={
        <div className={styles.addRow}>
          <button type="button" className={cx(styles.addBtn, styles.addBtnWide)} onClick={openCreate}>
            <IcoPlus />新規ロール
          </button>
        </div>
      }>
      {loading && !roles.length ? (
        <div className={styles.empty}>読み込み中...</div>
      ) : roles.length === 0 ? (
        <div className={styles.empty}>まだ登録されていません</div>
      ) : (
        <ul className={cx(styles.list, roles.length > SCROLL_AFTER && styles.listScroll)}>
          {roles.map(role => {
            const sum = roleSummary(role);
            return (
              <li key={role.id} className={cx(styles.row, styles.roleRow)}>
                <div className={styles.roleMain}>
                  <span className={styles.rowName}>{role.name}</span>
                  <span className={styles.roleCount}>{(role.permissions || []).length} 件</span>
                </div>
                <div className={styles.roleChips}>
                  {sum.length === 0
                    ? <span className={styles.roleNone}>権限なし</span>
                    : sum.map(g => (
                      <span key={g.label} className={cx(styles.roleChip, g.n < g.total && styles.roleChipPart)}>
                        {g.label}{g.n < g.total && <small>{g.n}/{g.total}</small>}
                      </span>
                    ))}
                </div>
                <RowOps canEdit canDelete onEdit={() => openEdit(role)} onDelete={() => askDelete(role)} />
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && createPortal(
        <div className={styles.rmOverlay}>
          <div className={styles.rmModal} role="dialog" aria-modal="true"
            aria-label={editId ? "ロールを編集" : "ロールを新規作成"}>
            <div className={styles.rmHead}>
              <span className={styles.rmHeadIcon}><IcoShield /></span>
              <div className={styles.rmHeadText}>
                <div className={styles.rmTitle}>{editId ? "ロールを編集" : "ロールを新規作成"}</div>
                <div className={styles.rmSub}>選択中の権限：{form.permissions.length} 件</div>
              </div>
              <button type="button" className={styles.rmClose} onClick={closeModal} aria-label="閉じる"><IcoClear /></button>
            </div>

            <div className={styles.rmBody}>
              <label className={styles.rmField}>
                <span className={styles.rmLabel}>ロール名 <span className={styles.req}>*</span></span>
                <input className={styles.input} value={form.name} placeholder="例：ホールリーダー" autoFocus
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>

              <div className={styles.rmLabel}>権限</div>
              <div className={styles.rmGroups}>
                {visibleGroups.map(group => {
                  const n = group.items.filter(i => form.permissions.includes(i.key)).length;
                  const all = n === group.items.length;
                  return (
                    <div key={group.label} className={cx(styles.rmGroup, n > 0 && styles.rmGroupOn)}>
                      <label className={styles.rmGroupHead}>
                        <input type="checkbox" checked={all}
                          ref={el => { if (el) el.indeterminate = n > 0 && !all; }}
                          onChange={e => toggleGroup(group, e.target.checked)} />
                        {group.label}
                        <span className={styles.rmGroupCount}>{n}/{group.items.length}</span>
                      </label>
                      <div className={styles.rmItems}>
                        {group.items.map(item => (
                          <label key={item.key}
                            className={cx(styles.rmItem, form.permissions.includes(item.key) && styles.rmItemOn)}>
                            <input type="checkbox" checked={form.permissions.includes(item.key)}
                              onChange={() => togglePerm(item.key)} />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.rmFoot}>
              <div className={styles.rmErr}>{formErr}</div>
              <button type="button" className={styles.btnCancel} onClick={closeModal} disabled={saving}>キャンセル</button>
              <button type="button" className={styles.btnSave} onClick={handleSave} disabled={saving}>
                <IcoSave />{saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Block>
  );
}

/* ─── Окно подтверждения удаления (общее) ───────────────── */
function DeleteConfirm({ data, onClose }) {
  const [busy, setBusy] = useState(false);
  useEsc(!!data && !busy, onClose);
  if (!data) return null;

  async function confirm() {
    setBusy(true);
    try { await data.action(); }
    finally { setBusy(false); onClose(); }
  }

  return createPortal(
    <div className={styles.dlOverlay}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={styles.dlModal} role="alertdialog" aria-modal="true" aria-label="削除の確認">
        <span className={styles.dlIcon}><IcoTrash /></span>
        <div className={styles.dlTitle}>{data.title || "削除しますか？"}</div>
        <div className={styles.dlItem}>
          <span className={styles.dlItemName}>{data.name}</span>
          {data.sub && <span className={styles.dlItemSub}>{data.sub}</span>}
        </div>
        {data.warn && <div className={styles.dlWarn}>{data.warn}</div>}
        <div className={styles.dlFoot}>
          <button type="button" className={styles.btnCancel} onClick={onClose} disabled={busy}>キャンセル</button>
          <button type="button" className={styles.dlDelete} onClick={confirm} disabled={busy}>
            <IcoTrash />{busy ? "削除中..." : "削除する"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Страница ──────────────────────────────────────────── */
export default function SettingsPage({ view, onNavigate, onLogout, permissions = [] }) {
  const name = localStorage.getItem("staffName") || "manager";
  const isAdmin = localStorage.getItem("appRole") === "ADMIN";
  const has = perm => isAdmin || permissions.includes(perm);
  const canSet = prefix => ({ create: has(`${prefix}_CREATE`), edit: has(`${prefix}_EDIT`), del: has(`${prefix}_DELETE`) });

  const [confirm, setConfirm] = useState(null);

  const masterBlocks = [
    has("WORKPLACE_VIEW") && (
      <NameListBlock key="wp" icon={<IcoPin />} title="勤務場所" placeholder="例：ホール1、フロント..."
        fns={{
          list: api.settingsWorkplacesList, create: api.settingsWorkplacesCreate,
          update: api.settingsWorkplacesUpdate, remove: api.settingsWorkplacesDelete,
        }}
        can={canSet("WORKPLACE")} onAskDelete={setConfirm} />
    ),
    has("POSITION_VIEW") && (
      <NameListBlock key="pos" icon={<IcoBag />} title="職種・役職" placeholder="例：フロントスタッフ、料理長..."
        fns={{
          list: api.settingsPositionsList, create: api.settingsPositionsCreate,
          update: api.settingsPositionsUpdate, remove: api.settingsPositionsDelete,
        }}
        can={canSet("POSITION")} onAskDelete={setConfirm} />
    ),
    has("DEPARTMENT_VIEW") && (
      <NameListBlock key="dep" icon={<IcoUsers />} title="部署" placeholder="例：フロント、調理、事務所..."
        hint="矢印でキオスク画面に表示される部署の順序を変更できます（部署の非表示・除外はできません）。"
        fns={{
          list: api.settingsDepartmentsList, create: api.settingsDepartmentsCreate,
          update: api.settingsDepartmentsUpdate, remove: api.settingsDepartmentsDelete,
          reorder: api.settingsDepartmentsReorder,
        }}
        can={canSet("DEPARTMENT")} onAskDelete={setConfirm} />
    ),
    has("ATTENDANCE_STATUS_VIEW") && (
      <NameListBlock key="ast" icon={<IcoList />} title="勤務状況リスト" placeholder="例：有給、欠勤、日時調整..."
        hint="勤怠管理の「状況」欄で選択できる項目です。名称変更・削除をしても、既に設定済みの日の表示は変更前のまま残ります。"
        deleteWarn="勤怠管理で既に設定済みの表示はそのまま残ります。"
        fns={{
          list: api.settingsAttendanceStatusesList, create: api.settingsAttendanceStatusesCreate,
          update: api.settingsAttendanceStatusesUpdate, remove: api.settingsAttendanceStatusesDelete,
        }}
        can={canSet("ATTENDANCE_STATUS")} onAskDelete={setConfirm} />
    ),
    has("BREAK_RULE_VIEW") && (
      <BreakRulesBlock key="br" can={canSet("BREAK_RULE")} onAskDelete={setConfirm} />
    ),
  ].filter(Boolean);

  const showNotifications = has("NOTIFICATION_VIEW");
  const showRoles = isAdmin;
  const nothing = masterBlocks.length === 0 && !showNotifications && !showRoles;

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        {/* ══ Шапка ══ */}
        <div className={styles.headRow}>
          <div className={styles.headTitle}>
            <span className={styles.headIcon}><IcoGear /></span>
            <div>
              <div className={styles.title}>設定</div>
              <div className={styles.subtitle}>マスターデータの管理</div>
            </div>
          </div>

          <div className={styles.headActions}>
            <button type="button" className={styles.iconBtn} data-tip="お知らせ（準備中）" aria-label="お知らせ" disabled>
              <IcoBell />
            </button>
            <button type="button" className={styles.iconBtn} data-tip="設定" aria-label="設定" onClick={() => onNavigate("SETTINGS")}>
              <IcoGear />
            </button>
            <button type="button" className={styles.iconBtn} data-tip="希望シフト" aria-label="希望シフト" onClick={() => onNavigate("PREFS")}>
              <IcoUser />
            </button>
            <button type="button" className={styles.iconBtn} data-tip="ログアウト" aria-label="ログアウト" onClick={onLogout}>
              <IcoLogout />
            </button>
          </div>
        </div>

        {/* ══ Контент ══ */}
        <div className={styles.content}>
          {nothing && <div className={styles.empty}>表示できる設定項目がありません</div>}

          {masterBlocks.length > 0 && (
            <Section id="master" icon={<IcoDb />} title="マスターデータ"
              sub="勤務場所・職種・部署など、各画面で選択する項目のリストです">
              <div className={styles.grid}>{masterBlocks}</div>
            </Section>
          )}

          {(showNotifications || showRoles) && (
            <Section id="system" icon={<IcoGear />} title="システム設定"
              sub={showRoles ? "メール通知と、ロールごとの権限の設定です" : "メール通知の設定です"}>
              <div className={cx(styles.systemRow, showNotifications && showRoles && styles.systemRowTwo)}>
                {showNotifications && <NotificationsBlock canEdit={has("NOTIFICATION_EDIT")} />}
                {showRoles && <RolesBlock onAskDelete={setConfirm} />}
              </div>
            </Section>
          )}
        </div>
      </div>

      <DeleteConfirm data={confirm} onClose={() => setConfirm(null)} />
    </ManagerLayout>
  );
}