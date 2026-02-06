import StaffLayout from "../../app/layouts/StaffLayout";
import StaffWeek from "../../features/staffShift/components/StaffWeek";

export default function StaffWeekPage({ weekStart, onBack, onLogout }) {
  const name = localStorage.getItem("staffName") || "";
  return (
    <StaffLayout name={name}>
      <StaffWeek weekStart={weekStart} onBack={onBack} onLogout={onLogout} />
    </StaffLayout>
  );
}
