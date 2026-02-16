const API_BASE = "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function setToken(token) {
  localStorage.setItem("accessToken", token);
}

export function clearToken() {
  localStorage.removeItem("accessToken");
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

  // ===== MANAGER SHIFTS (таблица смен) =====
  managerShifts: (from, to) => request(`/api/manager/shifts?from=${from}&to=${to}`),

  bulkShifts: (shifts) =>
    request("/api/manager/shifts/bulk", { method: "POST", body: { shifts } }),

  copyWeek: (fromWeekStart, toWeekStart, overwrite) =>
    request("/api/manager/shifts/copy-week", {
      method: "POST",
      body: { fromWeekStart, toWeekStart, overwrite },
    }),

  // ===== STAFF (желания) =====
  staffWeeks: (month) => request(`/api/staff/weeks?month=${month}`),

  staffWeek: (weekStart) => request(`/api/staff/week?weekStart=${weekStart}`),

  staffWeekSave: (weekStart, days) =>
    request(`/api/staff/week/save`, { method: "POST", body: { weekStart, days } }),

  staffCopyPrev: (weekStart) =>
    request(`/api/staff/week/copy-prev?weekStart=${weekStart}`, { method: "POST" }),

  // ===== MANAGER: edit staff week (если ты добавил ManagerStaffWeekController) =====
  managerStaffWeek: (userId, weekStart) =>
    request(`/api/manager/staff-week?userId=${userId}&weekStart=${weekStart}`),

  managerStaffWeekSave: (userId, weekStart, days) =>
    request(`/api/manager/staff-week/save?userId=${userId}`, {
      method: "POST",
      body: { weekStart, days },
    }),
};
