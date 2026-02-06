import ManagerLayout from "../../app/layouts/ManagerLayout";
import ManagerMonth from "../../features/managerShift/components/ManagerMonth";

export default function ManagerMonthPage({ onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";
  return (
    <ManagerLayout name={name}>
      <ManagerMonth onLogout={onLogout} />
    </ManagerLayout>
  );
}
