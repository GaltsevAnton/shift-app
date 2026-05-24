import { useEffect, useState } from "react";
import { clearToken, getToken } from "../shared/api/api";
import Login from "../pages/auth/LoginPage";
import ManagerTablePage from "../pages/manager/ManagerTablePage";
import ManagerWeekPage from "../pages/manager/ManagerWeekPage";
import StaffMonthPage from "../pages/staff/StaffMonthPage";
import EmployeesPage from "../pages/manager/EmployeesPage";
import SettingsPage from "../pages/manager/SettingsPage";

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
  
  // Автологаут через 30 минут бездействия
  useEffect(() => {
    if (!token) return;
  
    const TIMEOUT = 30 * 60 * 1000; // 30 минут
    let timer = setTimeout(onLogout, TIMEOUT);
  
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(onLogout, TIMEOUT);
    }
  
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset));
  
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [token]);

  function go(view) {
    localStorage.setItem("managerView", view);
    setManagerView(view);
  }

  if (!token) return <Login onLoggedIn={() => setTokenState(getToken())} />;

  const role = localStorage.getItem("appRole") || "MANAGER";

  // STAFF — только свои смены, без sidebar
  if (role === "STAFF") return <StaffMonthPage onLogout={onLogout} />;

  // MANAGER / ADMIN — с sidebar
  if (managerView === "PREFS") {
    return (
      <StaffMonthPage
        onLogout={onLogout}
        managerNav={{ view: managerView, onNavigate: go }}
      />
    );
  }
  if (managerView === "EMPLOYEES")
    return <EmployeesPage    view={managerView} onNavigate={go} onLogout={onLogout} />;
  if (managerView === "SETTINGS")
    return <SettingsPage     view={managerView} onNavigate={go} onLogout={onLogout} />;

  // SHIFTS — default
  return <ManagerTablePage   view={managerView} onNavigate={go} onLogout={onLogout} />;
}