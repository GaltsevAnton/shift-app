import ManagerLayout from "../../app/layouts/ManagerLayout";
import ManagerTable from "../../features/managerShift/components/ManagerTable";

export default function ManagerTablePage({ onLogout }) {
  const name = localStorage.getItem("staffName") || "manager";
  return (
    <ManagerLayout name={name}>
      <ManagerTable onLogout={onLogout} />
    </ManagerLayout>
  );
}