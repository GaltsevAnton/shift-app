import StaffLayout from "../../app/layouts/StaffLayout";
import StaffMonth from "../../features/staffShift/components/StaffMonth";

export default function StaffMonthPage({ onLogout }) {
  const name = localStorage.getItem("staffName") || "";
  return (
    <StaffLayout name={name}>
      <StaffMonth onLogout={onLogout} />
    </StaffLayout>
  );
}
