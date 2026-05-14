package com.shiftapp.weeks.dto;
 
import com.shiftapp.weeks.WeekStatusType;
 
import java.time.LocalDate;
import java.util.List;
 
public class ManagerWeekResponse {
 
    private LocalDate weekStart;
    private LocalDate weekEnd;
    private WeekStatusType status;
    private List<ManagerStaffWeekRow> rows;
 
    public LocalDate getWeekStart() { return weekStart; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }
 
    public LocalDate getWeekEnd() { return weekEnd; }
    public void setWeekEnd(LocalDate weekEnd) { this.weekEnd = weekEnd; }
 
    public WeekStatusType getStatus() { return status; }
    public void setStatus(WeekStatusType status) { this.status = status; }
 
    public List<ManagerStaffWeekRow> getRows() { return rows; }
    public void setRows(List<ManagerStaffWeekRow> rows) { this.rows = rows; }
}
 