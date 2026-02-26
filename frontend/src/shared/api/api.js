const API_BASE = "http://localhost:8080";

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

  // ===== MANAGER: staff week =====
  managerStaffWeek: (userId, weekStart) =>
    request(`/api/manager/staff-week?userId=${userId}&weekStart=${weekStart}`),

  managerStaffWeekSave: (userId, weekStart, days) =>
    request(`/api/manager/staff-week/save?userId=${userId}`, {
      method: "POST",
      body: { weekStart, days },
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
};