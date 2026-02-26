// import StaffLayout from "../../app/layouts/StaffLayout";
// import StaffMonth from "../../features/staffShift/components/StaffMonth";

// export default function StaffMonthPage({ onLogout }) {
//   const name = localStorage.getItem("staffName") || "";
//   return (
//     <StaffLayout name={name}>
//       <StaffMonth onLogout={onLogout} />
//     </StaffLayout>
//   );
// }
import StaffLayout from "../../app/layouts/StaffLayout";
import ManagerLayout from "../../app/layouts/ManagerLayout";
import StaffMonth from "../../features/staffShift/components/StaffMonth";

export default function StaffMonthPage({ onLogout, managerNav }) {
  const name = localStorage.getItem("staffName") || "";

  // Если открыт из менеджерского контекста — оборачиваем в ManagerLayout с sidebar
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

  // Обычный сотрудник
  return (
    <StaffLayout name={name}>
      <StaffMonth onLogout={onLogout} />
    </StaffLayout>
  );
}