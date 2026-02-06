import { useEffect, useState } from "react";
import { clearToken, getRole, getToken } from "../shared/api/api";
import Login from "../pages/auth/LoginPage";
import ManagerMonth from "../pages/manager/ManagerMonthPage";
import StaffMonth from "../pages/staff/StaffMonthPage";

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [role, setRole] = useState(getRole());

  useEffect(() => {
    setTokenState(getToken());
    setRole(getRole());
  }, []);

  function onLogout() {
    clearToken();
    setTokenState(null);
    setRole(null);
  }

  function onLoggedIn() {
    setTokenState(getToken());
    setRole(getRole());
  }

  if (!token) return <Login onLoggedIn={onLoggedIn} />;
  if (role === "STAFF") return <StaffMonth onLogout={onLogout} />;

  return <ManagerMonth onLogout={onLogout} />;
}
