const API_BASE = import.meta.env.VITE_API_BASE;

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function setToken(token) {
  localStorage.setItem("accessToken", token);
}

export function clearToken() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("appRole");
  localStorage.removeItem("staffName");
  localStorage.removeItem("managerView");
  localStorage.removeItem("staffSelectedMonth");
  localStorage.removeItem("staffSelectedWeek");
  localStorage.removeItem("managerSelectedMonth");
  localStorage.removeItem("mgrFilterPos");
  localStorage.removeItem("mgrFilterDept");
  localStorage.removeItem("mgrFilterWp");
  localStorage.removeItem("mgrColVisibility");
  localStorage.removeItem("managerViewMode");
  localStorage.removeItem("managerSelectedWeek");
  localStorage.removeItem("managerRangeFrom");
  localStorage.removeItem("managerRangeTo");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // токен протух или невалиден — разлогиниваем
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchBlob(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}) };
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body || undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*=UTF-8''(.+)/);
  const filename = match ? decodeURIComponent(match[1]) : "report.xlsx";

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const api = {
  // ===== AUTH =====
  login: (login, password) =>
    request("/api/auth/login", { method: "POST", auth: false, body: { login, password } }),

  // ===== MANAGER USERS =====
  managerUsers: () => request("/api/manager/users"),

  // ===== MANAGER SHIFTS =====
  managerShifts: (from, to) => request(`/api/manager/shifts?from=${from}&to=${to}`),

  bulkShifts: (shifts) =>
    request("/api/manager/shifts/bulk", { method: "POST", body: { shifts } }),

  copyWeek: (fromWeekStart, toWeekStart, overwrite) =>
    request("/api/manager/shifts/copy-week", {
      method: "POST",
      body: { fromWeekStart, toWeekStart, overwrite },
    }),

  // ===== MANAGER WEEKS =====
  managerWeeks: (month) => request(`/api/manager/weeks?month=${month}`),

  // ===== STAFF =====
  staffWeeks: (month) => request(`/api/staff/weeks?month=${month}`),

  staffWeek: (weekStart) => request(`/api/staff/week?weekStart=${weekStart}`),

  staffWeekSave: (weekStart, days) =>
    request(`/api/staff/week/save`, { method: "POST", body: { weekStart, days } }),

  staffCopyPrev: (weekStart) =>
    request(`/api/staff/week/copy-prev?weekStart=${weekStart}`, { method: "POST" }),

  // ===== MANAGER: staff week (с слотами) =====
  managerStaffWeek: (userId, weekStart) =>
    request(`/api/manager/staff-week?userId=${userId}&weekStart=${weekStart}`),

  // days: [{date, off, slots:[{startTime,endTime,last,workplace}]}]
  managerStaffWeekSave: (userId, weekStart, days) =>
    request(`/api/manager/staff-week/save?userId=${userId}`, {
      method: "POST",
      body: { weekStart, days },
    }),

  // 1日単位の保存 — 実際に変更があった日だけ監査ログに記録される
  managerStaffDaySave: (userId, day) =>
    request(`/api/manager/staff-day/save?userId=${userId}`, {
      method: "POST",
      body: day, // {date, off, slots}
    }),

  // ===== MANAGER WEEK EDITOR =====
  managerWeek: (weekStart) =>
    request(`/api/manager/week?weekStart=${weekStart}`),

  managerWeekSave: (weekStart, userId, days) =>
    request(`/api/manager/week/save`, {
      method: "POST",
      body: { weekStart, userId, days },
    }),

  setWeekStatus: (weekStart, status) =>
    request(`/api/manager/week-status?weekStart=${weekStart}&status=${status}`, {
      method: "POST",
    }),

  // ===== MANAGER EMPLOYEES =====
  managerEmployeesList: () => request("/api/manager/employees"),

  managerEmployeesCreate: (payload) =>
    request("/api/manager/employees", { method: "POST", body: payload }),

  managerEmployeesUpdate: (id, payload) =>
    request(`/api/manager/employees/${id}`, { method: "PUT", body: payload }),

  managerEmployeesDelete: (id) =>
    request(`/api/manager/employees/${id}`, { method: "DELETE" }),

  managerEmployeesUnlock: (id) =>
    request(`/api/manager/employees/${id}/unlock`, { method: "POST" }),

  managerMonth: (month) => request(`/api/manager/month?month=${month}`),

  managerRange: (from, to) =>
    request(`/api/manager/month?from=${from}&to=${to}`),

  // ===== SETTINGS: WORKPLACES =====
  settingsWorkplacesList: () =>
    request("/api/manager/settings/workplaces"),

  settingsWorkplacesCreate: (payload) =>
    request("/api/manager/settings/workplaces", { method: "POST", body: payload }),

  settingsWorkplacesUpdate: (id, payload) =>
    request(`/api/manager/settings/workplaces/${id}`, { method: "PUT", body: payload }),

  settingsWorkplacesDelete: (id) =>
    request(`/api/manager/settings/workplaces/${id}`, { method: "DELETE" }),

  // ===== SETTINGS: POSITIONS =====
  settingsPositionsList: () =>
    request("/api/manager/settings/positions"),

  settingsPositionsCreate: (payload) =>
    request("/api/manager/settings/positions", { method: "POST", body: payload }),

  settingsPositionsUpdate: (id, payload) =>
    request(`/api/manager/settings/positions/${id}`, { method: "PUT", body: payload }),

  settingsPositionsDelete: (id) =>
    request(`/api/manager/settings/positions/${id}`, { method: "DELETE" }),

  // ===== SETTINGS: DEPARTMENTS =====
  settingsDepartmentsList: () =>
    request("/api/manager/settings/departments"),

  settingsDepartmentsCreate: (payload) =>
    request("/api/manager/settings/departments", { method: "POST", body: payload }),

  settingsDepartmentsUpdate: (id, payload) =>
    request(`/api/manager/settings/departments/${id}`, { method: "PUT", body: payload }),

  settingsDepartmentsDelete: (id) =>
    request(`/api/manager/settings/departments/${id}`, { method: "DELETE" }),

  settingsDepartmentsReorder: (orderedIds) =>
    request("/api/manager/settings/departments/reorder", { method: "PUT", body: orderedIds }),

  // ===== SETTINGS: ROLES (権限, ADMIN専用) =====
  settingsRolesList: () =>
    request("/api/manager/settings/roles"),

  settingsRolesCreate: (payload) =>
    request("/api/manager/settings/roles", { method: "POST", body: payload }),

  settingsRolesUpdate: (id, payload) =>
    request(`/api/manager/settings/roles/${id}`, { method: "PUT", body: payload }),

  settingsRolesDelete: (id) =>
    request(`/api/manager/settings/roles/${id}`, { method: "DELETE" }),

  settingsPermissionsList: () =>
    request("/api/manager/settings/permissions"),

  // ===== ME: права текущего пользователя =====
  mePermissions: () =>
    request("/api/manager/me/permissions"),

  // ===== REPORTS =====
  reportShiftAll: (ym) =>
    fetchBlob(`/api/manager/reports/shift/all?ym=${ym}`),

  reportShiftDept: (ym, department) =>
    fetchBlob(`/api/manager/reports/shift/dept?ym=${ym}&department=${encodeURIComponent(department)}`),

  reportTimesheet: (ym) =>
    fetchBlob(`/api/manager/reports/timesheet?ym=${ym}`),

  reportShiftFiltered: (ym, userIds) =>
    fetchBlob(`/api/manager/reports/shift/filtered?ym=${ym}`, {
      method: "POST",
      body: JSON.stringify(userIds),
    }),

  reportShiftAllRange: (from, to) =>
    fetchBlob(`/api/manager/reports/shift/all/range?from=${from}&to=${to}`),

  reportShiftDeptRange: (from, to, department) =>
    fetchBlob(`/api/manager/reports/shift/dept/range?from=${from}&to=${to}&department=${encodeURIComponent(department)}`),

  reportTimesheetRange: (from, to) =>
    fetchBlob(`/api/manager/reports/timesheet/range?from=${from}&to=${to}`),

  reportShiftFilteredRange: (from, to, userIds) =>
    fetchBlob(`/api/manager/reports/shift/filtered/range?from=${from}&to=${to}`, {
      method: "POST",
      body: JSON.stringify(userIds),
    }),
  
  // Excel シフト管理 «как на экране»: { userIds, columns, workplaces }
  reportShiftScreen: (from, to, { userIds, columns, workplaces } = {}) =>
    fetchBlob(`/api/manager/reports/shift/screen?from=${from}&to=${to}`, {
      method: "POST",
      body: JSON.stringify({
        userIds:    userIds || [],
        columns:    columns ?? null,
        workplaces: workplaces ?? null,
      }),
    }),

  reportAttendanceTimesheet: (ym) =>
    fetchBlob(`/api/manager/reports/attendance/timesheet?ym=${ym}`),

  reportAttendanceList: (ym) =>
    fetchBlob(`/api/manager/reports/attendance/list?ym=${ym}`),

  reportAttendanceSessions: (from, to, userIds, visibleColumns) =>
    fetchBlob(`/api/manager/reports/attendance/sessions?from=${from}&to=${to}`, {
      method: "POST",
      body: JSON.stringify({ userIds: userIds || [], visibleColumns: visibleColumns || [] }),
    }),

  // options: { columns: [...], rows: [...], showColors } — настройки отображения экрана
  reportAttendanceTimesheetFiltered: (from, to, userIds, options = {}) =>
    fetchBlob(`/api/manager/reports/attendance/timesheet/filtered?from=${from}&to=${to}`, {
      method: "POST",
      body: JSON.stringify({
        userIds:    userIds || [],
        columns:    options.columns ?? null,
        rows:       options.rows ?? null,
        showColors: options.showColors ?? true,
      }),
    }),
    
  // ===== ATTENDANCE =====
  attendanceRecords: (from, to) =>
    request(`/api/manager/attendance?from=${from}&to=${to}`),

  attendanceEdit: (id, payload) =>
    request(`/api/manager/attendance/${id}`, { method: "PUT", body: payload }),

  attendanceDelete: (id) =>
    request(`/api/manager/attendance/${id}`, { method: "DELETE" }),

  // ===== ATTENDANCE: 勤務状況 (пометки по дням) =====
  attendanceNotes: (from, to) =>
    request(`/api/manager/attendance-notes?from=${from}&to=${to}`),

  // statusId = null — снять пометку
  attendanceNoteSet: ({ userId, workDate, statusId }) =>
    request("/api/manager/attendance-notes", { method: "PUT", body: { userId, workDate, statusId } }),

  // ===== SETTINGS: 勤務状況リスト =====
  settingsAttendanceStatusesList: () =>
    request("/api/manager/settings/attendance-statuses"),

  settingsAttendanceStatusesCreate: (payload) =>
    request("/api/manager/settings/attendance-statuses", { method: "POST", body: payload }),

  settingsAttendanceStatusesUpdate: (id, payload) =>
    request(`/api/manager/settings/attendance-statuses/${id}`, { method: "PUT", body: payload }),

  settingsAttendanceStatusesDelete: (id) =>
    request(`/api/manager/settings/attendance-statuses/${id}`, { method: "DELETE" }),

  // ===== SETTINGS: BREAK RULES =====
  settingsBreakRulesList: () =>
    request("/api/manager/settings/break-rules"),

  settingsBreakRulesCreate: (payload) =>
    request("/api/manager/settings/break-rules", { method: "POST", body: payload }),

  settingsBreakRulesUpdate: (id, payload) =>
    request(`/api/manager/settings/break-rules/${id}`, { method: "PUT", body: payload }),

  settingsBreakRulesDelete: (id) =>
    request(`/api/manager/settings/break-rules/${id}`, { method: "DELETE" }),

  // ===== STAFF MONTH =====
  staffMonth: (month) =>
    request(`/api/staff/month?month=${month}`),

  staffMonthSave: (month, days) =>
    request("/api/staff/month/save", { method: "POST", body: { month, days } }),

  // ===== MONTH STATUS =====
  managerMonthStatus: (month) =>
    request(`/api/manager/month-status?month=${month}`),
  
  managerMonthStatusSet: (month, status, half) =>
    request(`/api/manager/month-status?month=${month}&status=${status}&half=${half}`, { method: "POST" }),

  // ===== NOTIFICATIONS =====
  notificationPreferencesGet: () =>
    request("/api/manager/notifications/preferences"),

  notificationPreferencesSet: (prefs) =>
    request("/api/manager/notifications/preferences", { method: "POST", body: prefs }),

  notificationSettingsGet: () =>
    request("/api/manager/notifications/settings"),

  notificationSettingsSet: (time) =>
    request(`/api/manager/notifications/settings?time=${time}`, { method: "POST" }),

  // ===== AUDIT LOG =====
  // from/to: "YYYY-MM-DD" | undefined、targetUserId・entityType: 未指定でフィルターなし
  auditLogSearch: ({ from, to, targetUserId, entityType } = {}) => {
    const params = new URLSearchParams();
    if (from)         params.set("from", from);
    if (to)           params.set("to", to);
    if (targetUserId) params.set("targetUserId", targetUserId);
    if (entityType)   params.set("entityType", entityType);
    const qs = params.toString();
    return request(`/api/manager/audit-log${qs ? `?${qs}` : ""}`);
  },
};