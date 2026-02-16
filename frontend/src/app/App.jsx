import { useEffect, useState } from "react";
import { clearToken, getToken } from "../shared/api/api";
import Login from "../pages/auth/LoginPage";
import ManagerTable from "../pages/manager/ManagerTablePage";
import ManagerWeekPage from "../pages/manager/ManagerWeekPage";
import StaffMonth from "../pages/staff/StaffMonthPage";

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

  if (!token) return <Login onLoggedIn={() => setTokenState(getToken())} />;

  const role = localStorage.getItem("appRole") || "MANAGER";
  if (role === "STAFF") return <StaffMonth onLogout={onLogout} />;

  // MANAGER
  if (managerView === "PREFS") {
    return (
      <div>
        <div style={{ display: "flex", gap: 8, padding: 10, justifyContent: "center" }}>
          <button
            onClick={() => { localStorage.setItem("managerView", "SHIFTS"); setManagerView("SHIFTS"); }}
          >
            Shifts
          </button>
          <button
            onClick={() => { localStorage.setItem("managerView", "PREFS"); setManagerView("PREFS"); }}
          >
            Preferences
          </button>
        </div>
        <ManagerWeekPage onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: 10, justifyContent: "center" }}>
        <button
          onClick={() => { localStorage.setItem("managerView", "SHIFTS"); setManagerView("SHIFTS"); }}
        >
          Shifts
        </button>
        <button
          onClick={() => { localStorage.setItem("managerView", "PREFS"); setManagerView("PREFS"); }}
        >
          Preferences
        </button>
      </div>
      <ManagerTable onLogout={onLogout} />
    </div>
  );
}
