const API_BASE = "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function getRole() {
  return localStorage.getItem("appRole") || null;
}

// ВАЖНО: не пытаемся парсить роль из JWT (у тебя другой формат клеймов)
// Роль задаём явно при логине (см. LoginForm.jsx)
export function setToken(token, role) {
  localStorage.setItem("accessToken", token);
  if (role) localStorage.setItem("appRole", role);
}

export function clearToken() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("appRole");
  localStorage.removeItem("staffName");
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
  login: (login, password) =>
    request("/api/auth/login", { method: "POST", auth: false, body: { login, password } }),

  // ===== MANAGER =====
  managerWeeks: (month) =>
    request(`/api/manager/weeks?month=${month}`),

  managerUsers: () => request("/api/manager/users"),

  managerPreferences: (from, to) =>
    request(`/api/manager/preferences?from=${from}&to=${to}`),

  setWeekStatus: (weekStart, status) =>
    request(`/api/manager/week-status?weekStart=${weekStart}&status=${status}`, { method: "POST" }),

  managerShifts: (from, to) =>
    request(`/api/manager/shifts?from=${from}&to=${to}`),

  bulkShifts: (shifts) =>
    request("/api/manager/shifts/bulk", { method: "POST", body: { shifts } }),

  copyWeek: (fromWeekStart, toWeekStart, overwrite) =>
    request("/api/manager/shifts/copy-week", {
      method: "POST",
      body: { fromWeekStart, toWeekStart, overwrite },
    }),

  // ===== STAFF =====
  staffWeeks: (month) =>
    request(`/api/staff/weeks?month=${month}`),

  staffWeek: (weekStart) =>
    request(`/api/staff/week?weekStart=${weekStart}`),

  staffWeekSave: (weekStart, days) =>
    request(`/api/staff/week/save`, { method: "POST", body: { weekStart, days } }),

  staffCopyPrev: (weekStart) =>
    request(`/api/staff/week/copy-prev?weekStart=${weekStart}`, { method: "POST" }),
};
