// стало
import ManagerLayout from "../../app/layouts/ManagerLayout";
import StaffMonth from "../../features/staffShift/components/StaffMonth";

export default function StaffMonthPage({ onLogout, managerNav }) {
  const name = localStorage.getItem("staffName") || "";

  if (managerNav) {
    return (
      <ManagerLayout
        name={name}
        view={managerNav.view}
        onNavigate={managerNav.onNavigate}
        onLogout={onLogout}
      >
        <StaffMonth onLogout={onLogout} />
      </ManagerLayout>
    );
  }

  // Обычный сотрудник — StaffMonth сам рендерит шапку
  return <StaffMonth onLogout={onLogout} />;
}