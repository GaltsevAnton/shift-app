import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "../../shared/api/api";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import styles from "./EmployeesPage.module.css";

/* ─── small UI helpers (новый дизайн, как в 勤怠管理 / シフト管理) ─── */
const cx = (...a) => a.filter(Boolean).join(" ");

function Chevron({ open }) {
  return (
    <svg className={cx(styles.chev, open && styles.chevOpen)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TB_ICON = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};
function IcoUsers()  { return (<svg {...TB_ICON}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><circle cx="16.8" cy="9.5" r="2.5" /><path d="M16.5 13.6c2.3.2 4 2 4 4.6" /></svg>); }
function IcoPlus()   { return (<svg {...TB_ICON} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>); }
function IcoBell()   { return (<svg {...TB_ICON}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 004 0" /></svg>); }
function IcoGear()   { return (<svg {...TB_ICON}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" /></svg>); }
function IcoUser()   { return (<svg {...TB_ICON}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg>); }
function IcoLogout() { return (<svg {...TB_ICON}><path d="M14 4H7a2 2 0 00-2 2v12a2 2 0 002 2h7" /><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" /></svg>); }
function IcoSearch() { return (<svg {...TB_ICON}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>); }
function IcoClear()  { return (<svg {...TB_ICON} strokeWidth={2.4}><path d="M7 7l10 10M17 7L7 17" /></svg>); }
function IcoEdit()   { return (<svg {...TB_ICON}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>); }
function IcoTrash()  { return (<svg {...TB_ICON}><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5a1 1 0 001 .9h7a1 1 0 001-.9l1-12.5M9.5 7V4.5h5V7" /></svg>); }
function IcoPrev()   { return (<svg {...TB_ICON}><path d="M15 6l-6 6 6 6" /></svg>); }
function IcoNext()   { return (<svg {...TB_ICON}><path d="M9 6l6 6-6 6" /></svg>); }

// Закрытие выпадающего списка по клику мимо
function useOutsideClose(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Кнопка + панель
function DropdownShell({ label, filtered, width, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useOutsideClose(open, setOpen, ref);
  return (
    <div ref={ref} className={styles.wpDropdownWrap}>
      <button type="button"
        className={cx(styles.wpDropdownBtn, open && styles.wpDropdownBtnActive, filtered && styles.wpDropdownBtnFiltered)}
        onClick={() => setOpen(v => !v)}>
        {label}
        <Chevron open={open} />
      </button>
      {open && (
        <div className={styles.wpDropdownPanel} style={width ? { width } : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}

// Фильтр-список: visibleSet === null → «すべて»
function FilterDropdown({ label, options, visibleSet, onChange }) {
  const allValues = options.map(o => o.value);
  const isOn  = v => visibleSet === null || visibleSet.has(v);
  const onCnt = allValues.filter(isOn).length;
  const allOn = onCnt === allValues.length;
  const filtered = !allOn;

  function toggle(v) {
    const base = visibleSet === null ? new Set(allValues) : new Set(visibleSet);
    base.has(v) ? base.delete(v) : base.add(v);
    onChange(base.size >= allValues.length ? null : base);
  }
  function toggleAll() {
    onChange(allOn ? new Set() : null);
  }

  return (
    <DropdownShell
      width={220}
      filtered={filtered}
      label={<>
        <span>{label}</span>
        {!allOn && <span className={styles.ddValue}>{onCnt === 0 ? "なし" : `${onCnt}件`}</span>}
      </>}>
      <label className={styles.wpDropdownAll}>
        <input type="checkbox" className={styles.colToggleCheck}
          checked={allOn}
          ref={el => { if (el) el.indeterminate = !allOn && onCnt > 0; }}
          onChange={toggleAll} />
        <span>すべて</span>
      </label>
      <div className={styles.wpDropdownDivider} />
      {options.map(o => (
        <label key={o.value} className={styles.wpDropdownItem}>
          <input type="checkbox" className={styles.colToggleCheck}
            checked={isOn(o.value)} onChange={() => toggle(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
      {options.length === 0 && <div className={styles.ddEmpty}>候補がありません</div>}
    </DropdownShell>
  );
}

// Заголовок колонки с сортировкой ⇅
function SortTh({ label, field, sortConfig, onSort, className }) {
  const active = sortConfig.field === field;
  return (
    <th className={cx(styles.th, styles.thSort, active && styles.thSortActive, className)} onClick={() => onSort(field)}>
      <span className={styles.thInner}>
        {label}
        <span className={styles.sortMark}>{active ? (sortConfig.dir === "asc" ? "↑" : "↓") : "⇅"}</span>
      </span>
    </th>
  );
}

const ROLE_CLASS = { STAFF: "roleStaff", MANAGER: "roleManager", ADMIN: "roleAdmin", KIOSK: "roleKiosk" };
const PAGE_SIZES = [10, 20, 50];

// Номера страниц: 1 … 4 5 6 … 12
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1);
  if (from > 2) out.push("…l");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…r");
  out.push(total);
  return out;
}

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
  customRoleId: null,
  sortOrder: "",
};

export default function EmployeesPage({ view, onNavigate, onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";

  const [items, setItems]             = useState([]);
  const [positions, setPositions]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");

  const [modalOpen, setModalOpen]     = useState(false);
  const [editId, setEditId]           = useState(null); // null = создание
  const [form, setForm]               = useState(emptyForm);
  const [formErr, setFormErr]         = useState("");
  const [saving, setSaving]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function load() {
    setErr(""); setLoading(true);
    try {
      const [data, pos, deps, rls] = await Promise.all([
        api.managerEmployeesList(),
        api.settingsPositionsList(),
        api.settingsDepartmentsList(),
        api.settingsRolesList().catch(() => []), // 403 для не-ADMIN — просто нет списка ролей на выбор
      ]);
      setItems(Array.isArray(data) ? data : []);
      setPositions(Array.isArray(pos) ? pos : []);
      setDepartments(Array.isArray(deps) ? deps : []);
      setRoles(Array.isArray(rls) ? rls : []);
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
      customRoleId: emp.customRoleId || null,
      sortOrder: emp.sortOrder != null ? String(emp.sortOrder) : "",
    });
    setEditingLockInfo({ accountLocked: !!emp.accountLocked, lockLevel: emp.lockLevel || 0 });
    setFormErr("");
    setModalOpen(true);
  }

  // Esc — закрыть окно формы (клик по фону окно НЕ закрывает, чтобы не потерять ввод)
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e) { if (e.key === "Escape") closeModal(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeModal() {
    setShowPassword(false);
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
    if (form.sortOrder === undefined || form.sortOrder === null || String(form.sortOrder).trim() === "")
      return "順番№を入力してください";
    if (!/^\d+$/.test(String(form.sortOrder).trim())) return "順番№は半角数字で入力してください";
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
      customRoleId: form.customRoleId || null,
      sortOrder: Number(form.sortOrder),
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
  const [deleting, setDeleting] = useState(false);
  const [unlocking, setUnlocking] = useState(null);
  const [editingLockInfo, setEditingLockInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [sortConfig, setSortConfig] = useState({ field: "sortOrder", dir: "asc" });
  const [visiblePositions, setVisiblePositions]     = useState(null);   // null = すべて表示
  const [visibleDepartments, setVisibleDepartments] = useState(null);
  const [visibleRoles, setVisibleRoles]             = useState(null);
  const [visibleStatuses, setVisibleStatuses]       = useState(null);
  const [pageSize, setPageSize] = useState(() => {
    const v = Number(localStorage.getItem("empPageSize"));
    return PAGE_SIZES.includes(v) ? v : 10;
  });
  const [page, setPage] = useState(1);

  useEffect(() => { try { localStorage.setItem("empPageSize", String(pageSize)); } catch { /* ignore */ } }, [pageSize]);

  function handleSort(field) {
    setSortConfig(prev => ({
      field,
      dir: prev.field === field ? (prev.dir === "asc" ? "desc" : "asc") : "asc",
    }));
  }

  function handleResetFilters() {
    setVisiblePositions(null);
    setVisibleDepartments(null);
    setVisibleRoles(null);
    setVisibleStatuses(null);
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
    if (!deleteConfirm || deleting) return;
    setErr("");
    setDeleting(true);
    try {
      await api.managerEmployeesDelete(deleteConfirm);
      setDeleteConfirm(null);
      await load();
    } catch (e2) {
      setErr(e2.message || "Delete error");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  // Esc — закрыть подтверждение удаления
  useEffect(() => {
    if (!deleteConfirm) return;
    function onKey(e) { if (e.key === "Escape" && !deleting) setDeleteConfirm(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteConfirm, deleting]);

  const positionOptions = [...new Set(items.map(e => e.position || "").filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .map(p => ({ value: p, label: p }));

  // Порядок отделов — как в 設定 (sortOrder), только те, что есть у сотрудников
  const usedDeptNames = new Set(items.flatMap(e => (e.departments || []).map(d => d.name)));
  const departmentOptions = [
    ...departments.filter(d => usedDeptNames.has(d.name)).map(d => d.name),
    ...[...usedDeptNames].filter(n => !departments.some(d => d.name === n)),
  ].map(d => ({ value: d, label: d }));

  const ROLE_ORDER = ["ADMIN", "MANAGER", "STAFF", "KIOSK"];
  const roleOptions = [...new Set(items.map(e => e.role).filter(Boolean))]
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
    .map(r => ({ value: r, label: r }));

  const statusOptions = [
    { value: "ON",  label: "有効" },
    { value: "OFF", label: "無効" },
  ];

  const isFiltered = [visiblePositions, visibleDepartments, visibleRoles, visibleStatuses].some(v => v !== null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sortKey = emp => {
      switch (sortConfig.field) {
        case "sortOrder":  return emp.sortOrder ?? 0;
        case "name":       return `${emp.lastNameKana || ""}${emp.firstNameKana || ""}` || `${emp.lastName || ""}${emp.firstName || ""}`;
        case "login":      return emp.login || "";
        case "department": return (emp.departments || [])[0]?.name || "";
        case "position":   return emp.position || "";
        case "role":       return String(ROLE_ORDER.indexOf(emp.role));
        case "status":     return emp.active ? "0" : "1";
        default:           return 0;
      }
    };
    return items
      .filter(emp => {
        if (q) {
          const fullName     = `${emp.lastName || ""} ${emp.firstName || ""}`.toLowerCase();
          const fullNameKana = `${emp.lastNameKana || ""} ${emp.firstNameKana || ""}`.toLowerCase();
          const login        = (emp.login || "").toLowerCase();
          const depts        = (emp.departments || []).map(d => d.name).join(" ").toLowerCase();
          if (!fullName.includes(q) && !fullName.replace(/\s/g, "").includes(q)
            && !fullNameKana.includes(q) && !login.includes(q) && !depts.includes(q)) return false;
        }
        if (visiblePositions && !visiblePositions.has(emp.position || "")) return false;
        if (visibleDepartments) {
          const names = (emp.departments || []).map(d => d.name);
          if (!names.some(n => visibleDepartments.has(n))) return false;
        }
        if (visibleRoles && !visibleRoles.has(emp.role)) return false;
        if (visibleStatuses && !visibleStatuses.has(emp.active ? "ON" : "OFF")) return false;
        return true;
      })
      .sort((a, b) => {
        if (!sortConfig.field) return 0;
        const va = sortKey(a), vb = sortKey(b);
        const sign = sortConfig.dir === "asc" ? 1 : -1;
        if (typeof va === "number") return sign * (va - vb);
        return sign * String(va).localeCompare(String(vb), "ja");
      });
  }, [items, searchQuery, visiblePositions, visibleDepartments, visibleRoles, visibleStatuses, sortConfig]);

  // Пагинация
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const curPage    = Math.min(page, totalPages);
  const pageItems  = filteredItems.slice((curPage - 1) * pageSize, curPage * pageSize);
  // при смене фильтров/поиска/размера — на первую страницу
  useEffect(() => { setPage(1); }, [searchQuery, visiblePositions, visibleDepartments, visibleRoles, visibleStatuses, pageSize]);

  /* ── DepartmentCheckboxes ── */
  function DepartmentCheckboxes({ selectedIds, onChange }) {
    function toggle(id) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id];
      onChange(next);
    }
    if (departments.length === 0) {
      return <div className={styles.fmHint}>設定 → 部署 で追加してください</div>;
    }
    return (
      <div className={styles.fmDepts}>
        {departments.map(d => (
          <label key={d.id} className={styles.fmDept}>
            <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => toggle(d.id)} />
            <span>{d.name}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <ManagerLayout name={name} view={view} onNavigate={onNavigate} onLogout={onLogout}>
      <div className={styles.page}>

        {/* ══ Шапка ══ */}
        <div className={styles.headRow}>
          <div className={styles.headTitle}>
            <span className={styles.headIcon}><IcoUsers /></span>
            <div>
              <div className={styles.title}>従業員管理</div>
              <div className={styles.subtitle}>従業員の情報を確認・編集・管理できます。</div>
            </div>
          </div>

          <div className={styles.headActions}>
            <button type="button" className={styles.createBtn} onClick={openCreate}>
              <IcoPlus />新規作成
            </button>
            <span className={styles.headSep} />
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

        {/* ══ Строка инструментов ══ */}
        <div className={styles.filterRow}>
          <label className={styles.search}>
            <IcoSearch />
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="氏名・ID・部署で検索..." />
            <button type="button"
              className={cx(styles.searchClear, !searchQuery && styles.searchClearHidden)}
              onClick={e => { e.preventDefault(); setSearchQuery(""); }}
              tabIndex={searchQuery ? 0 : -1}
              aria-label="検索をクリア">
              <IcoClear />
            </button>
          </label>

          <FilterDropdown label="部署"       options={departmentOptions} visibleSet={visibleDepartments} onChange={setVisibleDepartments} />
          <FilterDropdown label="職種・役職" options={positionOptions}   visibleSet={visiblePositions}   onChange={setVisiblePositions} />
          <FilterDropdown label="ロール"     options={roleOptions}       visibleSet={visibleRoles}       onChange={setVisibleRoles} />
          <FilterDropdown label="ステータス" options={statusOptions}     visibleSet={visibleStatuses}    onChange={setVisibleStatuses} />

          {isFiltered && (
            <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>リセット</button>
          )}

          <span className={styles.countText}>
            {loading ? "読み込み中..." : <>表示中: <b>{filteredItems.length}</b> / {items.length} 人</>}
          </span>
        </div>

        {err && <div className={styles.errBar}>{err}</div>}

        {/* ══ Таблица ══ */}
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh label="No."        field="sortOrder"  sortConfig={sortConfig} onSort={handleSort} className={styles.colNo} />
                  <SortTh label="氏名"       field="name"       sortConfig={sortConfig} onSort={handleSort} />
                  <SortTh label="ログインID" field="login"      sortConfig={sortConfig} onSort={handleSort} />
                  <SortTh label="部署"       field="department" sortConfig={sortConfig} onSort={handleSort} />
                  <SortTh label="職種・役職" field="position"   sortConfig={sortConfig} onSort={handleSort} />
                  <SortTh label="ロール"     field="role"       sortConfig={sortConfig} onSort={handleSort} />
                  <SortTh label="ステータス" field="status"     sortConfig={sortConfig} onSort={handleSort} />
                  <th className={cx(styles.th, styles.colOps)}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(emp => (
                  <tr key={emp.id} className={styles.row}>
                    <td className={cx(styles.td, styles.colNo, styles.tdNo)}>{emp.sortOrder ?? "—"}</td>
                    <td className={styles.td}>
                      <div className={styles.empName}>{emp.lastName} {emp.firstName}</div>
                      {(emp.lastNameKana || emp.firstNameKana) && (
                        <div className={styles.empKana}>{emp.lastNameKana} {emp.firstNameKana}</div>
                      )}
                    </td>
                    <td className={cx(styles.td, styles.tdLogin)}>{emp.login}</td>
                    <td className={styles.td}>
                      {(emp.departments || []).length > 0
                        ? <div className={styles.chips}>
                            {emp.departments.map(d => <span key={d.id} className={styles.chipDept}>{d.name}</span>)}
                          </div>
                        : <span className={styles.dash}>—</span>}
                    </td>
                    <td className={styles.td}>
                      {emp.position
                        ? <span className={styles.chipPos}>{emp.position}</span>
                        : <span className={styles.dash}>—</span>}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.stack}>
                        <span className={cx(styles.badge, styles[ROLE_CLASS[emp.role] || "roleStaff"])}>{emp.role}</span>
                        {emp.customRoleName && <span className={styles.chipCustomRole}>{emp.customRoleName}</span>}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.stack}>
                        <span className={cx(styles.badge, emp.active ? styles.statusOn : styles.statusOff)}>
                          {emp.active ? "有効" : "無効"}
                        </span>
                        {emp.accountLocked && <span className={cx(styles.badge, styles.lockBadge)}>🔒 ロック中</span>}
                        {!emp.accountLocked && emp.lockLevel > 0 && (
                          <span className={cx(styles.badge, styles.lockTemp)}>⚠ 一時ロック（{lockLevelLabel(emp.lockLevel)}）</span>
                        )}
                      </div>
                    </td>
                    <td className={cx(styles.td, styles.colOps)}>
                      <div className={styles.ops}>
                        <button type="button" className={styles.opBtn} onClick={() => openEdit(emp)}
                          data-tip="編集" aria-label="編集">
                          <IcoEdit />
                        </button>
                        <button type="button" className={cx(styles.opBtn, styles.opBtnDanger)} onClick={() => setDeleteConfirm(emp.id)}
                          data-tip="削除" aria-label="削除">
                          <IcoTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && !loading && (
                  <tr><td colSpan={8} className={styles.empty}>
                    {items.length === 0 ? "スタッフがいません" : "該当するスタッフが見つかりません"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ══ Пагинация ══ */}
          <div className={styles.pager}>
            <label className={styles.pageSize}>
              <select className={styles.pageSizeSelect} value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>件を表示</span>
            </label>

            <div className={styles.pages}>
              <button type="button" className={styles.pageBtn} disabled={curPage <= 1}
                onClick={() => setPage(curPage - 1)} aria-label="前のページ"><IcoPrev /></button>
              {pageList(curPage, totalPages).map(p => typeof p === "number" ? (
                <button key={p} type="button"
                  className={cx(styles.pageBtn, p === curPage && styles.pageBtnActive)}
                  onClick={() => setPage(p)}>{p}</button>
              ) : (
                <span key={p} className={styles.pageGap}>…</span>
              ))}
              <button type="button" className={styles.pageBtn} disabled={curPage >= totalPages}
                onClick={() => setPage(curPage + 1)} aria-label="次のページ"><IcoNext /></button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Окно создания / редактирования сотрудника ── */}
      {modalOpen && (
        <div className={styles.fmOverlay}>
          <div className={styles.fmModal} role="dialog" aria-modal="true"
            aria-label={editId ? "従業員を編集" : "従業員を新規作成"}>

            {/* Шапка */}
            <div className={styles.fmHead}>
              <span className={styles.fmHeadIcon}><FmIcoPerson /></span>
              <div className={styles.fmHeadText}>
                <div className={styles.fmTitle}>{editId ? "従業員を編集" : "従業員を新規作成"}</div>
                <div className={styles.fmSub}>必須項目には <span className={styles.req}>*</span> が付いています</div>
              </div>
              <button type="button" className={styles.fmClose} onClick={closeModal} aria-label="閉じる"><IcoClear /></button>
            </div>

            <div className={styles.fmBody}>
              {/* ── Левая колонка ── */}
              <div className={styles.fmCol}>
                <FmSection icon={<FmIcoPerson />} title="基本情報">
                  <div className={styles.fmGrid2}>
                    <FmField label="姓" required>
                      <input className={styles.fmInput} value={form.lastName} placeholder="例：山田"
                        onChange={e => setForm({ ...form, lastName: e.target.value })} />
                    </FmField>
                    <FmField label="名" required>
                      <input className={styles.fmInput} value={form.firstName} placeholder="例：太郎"
                        onChange={e => setForm({ ...form, firstName: e.target.value })} />
                    </FmField>
                    <FmField label="姓（フリガナ）" required>
                      <input className={styles.fmInput} value={form.lastNameKana} placeholder="例：ヤマダ"
                        onChange={e => setForm({ ...form, lastNameKana: e.target.value })} />
                    </FmField>
                    <FmField label="名（フリガナ）" required>
                      <input className={styles.fmInput} value={form.firstNameKana} placeholder="例：タロウ"
                        onChange={e => setForm({ ...form, firstNameKana: e.target.value })} />
                    </FmField>
                    <FmField label="生年月日">
                      <FmIconInput icon={<FmIcoCalendar />}>
                        <input type="date" className={styles.fmInput} value={form.birthDate}
                          onChange={e => setForm({ ...form, birthDate: e.target.value })} />
                      </FmIconInput>
                    </FmField>
                    <FmField label="性別" asGroup>
                      <div className={styles.fmRadios}>
                        <label className={styles.fmRadio}>
                          <input type="radio" name="gender" checked={form.gender === "MALE"}
                            onChange={() => setForm({ ...form, gender: "MALE" })} />
                          男性
                        </label>
                        <label className={styles.fmRadio}>
                          <input type="radio" name="gender" checked={form.gender === "FEMALE"}
                            onChange={() => setForm({ ...form, gender: "FEMALE" })} />
                          女性
                        </label>
                      </div>
                    </FmField>
                  </div>
                </FmSection>

                <FmSection icon={<FmIcoPhone />} title="連絡先">
                  <div className={styles.fmGrid2}>
                    <FmField label="メールアドレス">
                      <FmIconInput icon={<FmIcoMail />}>
                        <input type="email" className={styles.fmInput} value={form.email} placeholder="例：mail@example.com"
                          onChange={e => setForm({ ...form, email: e.target.value })} />
                      </FmIconInput>
                    </FmField>
                    <FmField label="電話番号">
                      <FmIconInput icon={<FmIcoPhone />}>
                        <input className={styles.fmInput} value={form.phone} placeholder="090-1234-5678"
                          onChange={e => setForm({ ...form, phone: e.target.value })} />
                      </FmIconInput>
                    </FmField>
                  </div>
                </FmSection>

                <FmSection icon={<FmIcoPin />} title="住所">
                  <div className={styles.fmGrid2}>
                    <FmField label="郵便番号">
                      <FmIconInput icon={<FmIcoPost />}>
                        <input className={styles.fmInput} value={form.postalCode} placeholder="例：123-4567"
                          onChange={e => setForm({ ...form, postalCode: e.target.value })} />
                      </FmIconInput>
                    </FmField>
                    <FmField label="都道府県">
                      <select className={styles.fmSelect} value={form.region}
                        onChange={e => setForm({ ...form, region: e.target.value })}>
                        <option value="">— 未選択 —</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </FmField>
                    <FmField label="市区町村" wide>
                      <input className={styles.fmInput} value={form.municipality} placeholder="例：飯能市〇〇1-2-3"
                        onChange={e => setForm({ ...form, municipality: e.target.value })} />
                    </FmField>
                    <FmField label="番地">
                      <input className={styles.fmInput} value={form.blockNumber}
                        onChange={e => setForm({ ...form, blockNumber: e.target.value })} />
                    </FmField>
                    <FmField label="建物名">
                      <input className={styles.fmInput} value={form.building} placeholder="例：〇〇マンション101"
                        onChange={e => setForm({ ...form, building: e.target.value })} />
                    </FmField>
                  </div>
                </FmSection>
              </div>

              {/* ── Правая колонка ── */}
              <div className={styles.fmCol}>
                <FmSection icon={<FmIcoLock />} title="アカウント">
                  <div className={styles.fmGrid2}>
                    <FmField label="ログインID" required>
                      <FmIconInput icon={<FmIcoPerson />}>
                        <input className={styles.fmInput} value={form.login} placeholder="例：manager"
                          autoComplete="off"
                          onChange={e => setForm({ ...form, login: e.target.value })} />
                      </FmIconInput>
                    </FmField>
                    <FmField label={editId ? "新しいパスワード" : "パスワード"} required={!editId}>
                      <FmIconInput icon={<FmIcoLock />}
                        right={
                          <button type="button" className={styles.fmEye} onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}>
                            {showPassword ? <FmIcoEyeOff /> : <FmIcoEye />}
                          </button>
                        }>
                        <input type={showPassword ? "text" : "password"} className={styles.fmInput}
                          value={form.password} autoComplete="new-password"
                          placeholder={editId ? "変更しない場合は空欄" : "8文字以上"}
                          onChange={e => setForm({ ...form, password: e.target.value })} />
                      </FmIconInput>
                    </FmField>
                  </div>

                  {editId && (
                    <div className={styles.fmToggles}>
                      <label className={styles.fmToggle}>
                        <input type="checkbox" checked={form.active}
                          onChange={e => setForm({ ...form, active: e.target.checked })} />
                        <span className={styles.fmSwitch} />
                        <span className={styles.fmToggleText}>
                          アクティブ
                          <small>{form.active ? "ログイン・シフト提出が可能です" : "無効：ログインできません"}</small>
                        </span>
                      </label>
                      {editingLockInfo && (editingLockInfo.accountLocked || editingLockInfo.lockLevel > 0) && (
                        <label className={cx(styles.fmToggle, styles.fmToggleWarn)}>
                          <input type="checkbox" checked={form.unlockAccount}
                            onChange={e => setForm({ ...form, unlockAccount: e.target.checked })} />
                          <span className={styles.fmSwitch} />
                          <span className={styles.fmToggleText}>
                            ロックを解除する
                            <small>現在：{editingLockInfo.accountLocked ? "永久ロック" : `一時ロック（${lockLevelLabel(editingLockInfo.lockLevel)}）`}</small>
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </FmSection>

                <FmSection icon={<FmIcoBag />} title="業務情報">
                  <div className={styles.fmGrid2}>
                    <FmField label="順番No" required>
                      <input type="number" min="1" className={styles.fmInput} value={form.sortOrder} placeholder="例：1"
                        onChange={e => setForm({ ...form, sortOrder: e.target.value })} />
                    </FmField>
                    <FmField label="職種・役職">
                      <select className={styles.fmSelect} value={form.position}
                        onChange={e => setForm({ ...form, position: e.target.value })}>
                        <option value="">— 未選択 —</option>
                        {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </FmField>
                    <FmField label="ロール" required>
                      <select className={styles.fmSelect} value={form.role}
                        onChange={e => setForm({ ...form, role: e.target.value })}>
                        <option value="STAFF">STAFF</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="KIOSK">KIOSK</option>
                      </select>
                    </FmField>
                    <FmField label="権限ロール（カスタム）">
                      <select className={styles.fmSelect} value={form.customRoleId ?? ""}
                        onChange={e => setForm({ ...form, customRoleId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">— 未設定（権限なし） —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </FmField>
                  </div>
                  {roles.length === 0 && (
                    <div className={styles.fmHint}>設定 → 権限 でロールを作成してください（ADMINのみ作成可能）</div>
                  )}
                </FmSection>

                <FmSection icon={<IcoUsers />} title="部署">
                  <DepartmentCheckboxes
                    selectedIds={form.departmentIds}
                    onChange={ids => setForm({ ...form, departmentIds: ids })}
                  />
                </FmSection>
              </div>
            </div>

            {/* Кнопки + ошибка */}
            <div className={styles.fmFoot}>
              <div className={styles.fmErr}>{formErr}</div>
              <button type="button" className={styles.fmCancel} onClick={closeModal}>キャンセル</button>
              <button type="button" className={styles.fmSave} onClick={handleSave} disabled={saving}>
                <FmIcoSave />{saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Подтверждение удаления ── */}
      {deleteConfirm && (() => {
        const emp = items.find(x => x.id === deleteConfirm);
        return (
          <div className={styles.dlOverlay}
            onMouseDown={e => { if (e.target === e.currentTarget && !deleting) setDeleteConfirm(null); }}>
            <div className={styles.dlModal} role="alertdialog" aria-modal="true" aria-label="従業員の削除">
              <span className={styles.dlIcon}><IcoTrash /></span>
              <div className={styles.dlTitle}>本当に削除しますか？</div>
              {emp && (
                <div className={styles.dlEmp}>
                  <span className={styles.dlEmpName}>{emp.lastName} {emp.firstName}</span>
                  <span className={styles.dlEmpLogin}>{emp.login}</span>
                </div>
              )}
              <div className={styles.dlWarn}>
                このスタッフを削除すると、<br />
                <b>すべてのシフトデータと打刻記録</b>も完全に削除されます。<br />
                この操作は取り消せません。
              </div>
              <div className={styles.dlFoot}>
                <button type="button" className={styles.dlCancel} onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                  キャンセル
                </button>
                <button type="button" className={styles.dlDelete} onClick={handleDeleteConfirmed} disabled={deleting}>
                  <IcoTrash />{deleting ? "削除中..." : "完全に削除する"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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

/* ─── Форма сотрудника: иконки и мелкие компоненты ─── */
function FmIcoPerson()   { return (<svg {...TB_ICON}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg>); }
function FmIcoPhone()    { return (<svg {...TB_ICON}><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 006.2 6.2l1.3-2 4 1.5v3a2 2 0 01-2.2 2A16.5 16.5 0 014.5 5.7a2 2 0 012-2.2z" /></svg>); }
function FmIcoPin()      { return (<svg {...TB_ICON}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></svg>); }
function FmIcoLock()     { return (<svg {...TB_ICON}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>); }
function FmIcoBag()      { return (<svg {...TB_ICON}><rect x="3.5" y="7.5" width="17" height="12.5" rx="2" /><path d="M9 7.5V5.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5.5v2M3.5 12.5h17" /></svg>); }
function FmIcoMail()     { return (<svg {...TB_ICON}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></svg>); }
function FmIcoPost()     { return (<svg {...TB_ICON}><path d="M6 5h12M6 9.5h12M12 9.5V20" /></svg>); }
function FmIcoCalendar() { return (<svg {...TB_ICON}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>); }
function FmIcoEye()      { return (<svg {...TB_ICON}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>); }
function FmIcoEyeOff()   { return (<svg {...TB_ICON}><path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0112 6c6 0 9.5 6 9.5 6a16 16 0 01-3.2 3.9M6.4 7.4A15.6 15.6 0 002.5 12s3.5 6 9.5 6a9 9 0 004.1-1" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></svg>); }
function FmIcoSave()     { return (<svg {...TB_ICON}><path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>); }

function FmSection({ icon, title, children }) {
  return (
    <section className={styles.fmSection}>
      <div className={styles.fmSectionHead}>
        <span className={styles.fmSectionIcon}>{icon}</span>
        {title}
      </div>
      <div className={styles.fmSectionBody}>{children}</div>
    </section>
  );
}

// label-обёртка: клик по подписи ставит фокус в поле; asGroup — для радиокнопок (div вместо label)
function FmField({ label, required, wide, asGroup, children }) {
  const Tag = asGroup ? "div" : "label";
  return (
    <Tag className={cx(styles.fmField, wide && styles.fmWide)}>
      <span className={styles.fmLabel}>{label}{required && <span className={styles.req}>*</span>}</span>
      {children}
    </Tag>
  );
}

function FmIconInput({ icon, right, children }) {
  return (
    <div className={cx(styles.fmIconInput, right && styles.fmIconInputRight)}>
      <span className={styles.fmInputIcon}>{icon}</span>
      {children}
      {right}
    </div>
  );
}