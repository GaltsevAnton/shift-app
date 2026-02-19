import { useEffect, useState } from "react";
import { clearToken, getToken } from "../shared/api/api";
import Login from "../pages/auth/LoginPage";
import ManagerTable from "../pages/manager/ManagerTablePage";
import ManagerWeekPage from "../pages/manager/ManagerWeekPage";
import StaffMonth from "../pages/staff/StaffMonthPage";
import EmployeesPage from "../pages/manager/EmployeesPage";

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [managerView, setManagerView] = useState(localStorage.getItem("managerView") || "SHIFTS");

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  function onLogout() {
    clearToken();
    setTokenState(null);
  }

  function go(view) {
    localStorage.setItem("managerView", view);
    setManagerView(view);
  }

  if (!token) return <Login onLoggedIn={() => setTokenState(getToken())} />;

  const role = localStorage.getItem("appRole") || "MANAGER";
  if (role === "STAFF") return <StaffMonth onLogout={onLogout} />;

  // ===== MANAGER =====
  const menu = (
    <div style={{ display: "flex", gap: 8, padding: 10, justifyContent: "center" }}>
      <button onClick={() => go("SHIFTS")}>Shifts</button>
      <button onClick={() => go("PREFS")}>Preferences</button>
      <button onClick={() => go("EMPLOYEES")}>Employees</button>
    </div>
  );

  if (managerView === "PREFS") {
    return (
      <div>
        {menu}
        <ManagerWeekPage onLogout={onLogout} />
      </div>
    );
  }

  if (managerView === "EMPLOYEES") {
    return (
      <div>
        {menu}
        <EmployeesPage />
      </div>
    );
  }

  // SHIFTS
  return (
    <div>
      {menu}
      <ManagerTable onLogout={onLogout} />
    </div>
  );
}
