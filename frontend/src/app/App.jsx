import { useEffect, useState } from "react";
import { clearToken, getToken } from "../shared/api/api";
import Login from "../pages/auth/LoginPage";
import ManagerTablePage from "../pages/manager/ManagerTablePage";
import ManagerWeekPage from "../pages/manager/ManagerWeekPage";
import StaffMonthPage from "../pages/staff/StaffMonthPage";
import EmployeesPage from "../pages/manager/EmployeesPage";

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [managerView, setManagerView] = useState(
    localStorage.getItem("managerView") || "SHIFTS"
  );

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

  // STAFF — только свои смены, без sidebar
  if (role === "STAFF") return <StaffMonthPage onLogout={onLogout} />;

  // MANAGER / ADMIN — с sidebar
  // PREFS = личные смены менеджера (через стафф-эндпоинты, обычный StaffMonthPage)
  if (managerView === "PREFS") {
    return (
      <StaffMonthPage
        onLogout={onLogout}
        managerNav={{ view: managerView, onNavigate: go }}
      />
    );
  }
  if (managerView === "EMPLOYEES") return <EmployeesPage        view={managerView} onNavigate={go} onLogout={onLogout} />;
  return                                  <ManagerTablePage     view={managerView} onNavigate={go} onLogout={onLogout} />;
}